"""FastAPI Routes for Institutional Auth, Password Recovery, User Profile Management, Resend Email, and Admin Panel."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from services.auth_service import auth_service
from services.email_service import email_service
from services.nebius_ai import nebius_ai_service

router = APIRouter(tags=["auth_and_admin"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization: str = "Institutional Execution Desk"
    title: str = "Quantitative Execution Trader"
    role: str = "trader"


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoLoginRequest(BaseModel):
    role: str = Field(default="trader", pattern="^(trader|admin)$")


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    reset_code: str
    new_password: str
    reset_token: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = ""
    new_password: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    send_confirmation_email: bool = False
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class SystemConfigUpdateRequest(BaseModel):
    max_parent_order_size: Optional[int] = None
    global_toxicity_ceiling: Optional[float] = None
    default_ai_routing_policy: Optional[str] = None
    auto_email_tca_reports: Optional[bool] = None
    maintenance_mode: Optional[bool] = None


class SendEmailRequest(BaseModel):
    to_email: str
    subject: str = "FastTrade Institutional SOR Executive Briefing"
    message: str = "Attached is your live FastTrade Quantitative SOR telemetry and TCA executive summary."
    order_id: Optional[str] = None
    scenario: Optional[str] = None
    shortfall_bps: Optional[float] = None
    savings_usd: Optional[float] = None
    report_markdown: Optional[str] = None


def _require_user(authorization: Optional[str]) -> Dict[str, Any]:
    user = auth_service.get_user_by_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")
    return user


@router.post("/api/v1/auth/register")
def register_account(req: RegisterRequest) -> Dict[str, Any]:
    try:
        return auth_service.register_user(
            email=req.email,
            password=req.password,
            full_name=req.full_name,
            organization=req.organization,
            title=req.title,
            role=req.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/v1/auth/login")
def login_account(req: LoginRequest) -> Dict[str, Any]:
    try:
        return auth_service.login_user(email=req.email, password=req.password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/api/v1/auth/demo-login")
def oneclick_demo_login(req: DemoLoginRequest) -> Dict[str, Any]:
    return auth_service.demo_login(role=req.role)


@router.post("/api/v1/auth/forgot-password")
def forgot_password_endpoint(req: ForgotPasswordRequest) -> Dict[str, Any]:
    try:
        return auth_service.request_password_reset(email=req.email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/v1/auth/reset-password")
def reset_password_endpoint(req: ResetPasswordRequest) -> Dict[str, Any]:
    try:
        return auth_service.reset_password_with_code(
            email=req.email,
            reset_code=req.reset_code,
            new_password=req.new_password,
            reset_token=req.reset_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/v1/auth/change-password")
def change_password_endpoint(
    req: ChangePasswordRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    try:
        return auth_service.change_password(
            user_id=int(user["id"]),
            current_password=req.current_password,
            new_password=req.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/v1/auth/me")
def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = _require_user(authorization)
    return {"user": user}


@router.put("/api/v1/auth/profile")
def update_user_profile(
    req: ProfileUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    try:
        return auth_service.update_profile(
            user_id=int(user["id"]),
            full_name=req.full_name,
            title=req.title,
            organization=req.organization,
            preferences=req.preferences,
            send_confirmation_email=req.send_confirmation_email,
            current_password=req.current_password,
            new_password=req.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/v1/admin/overview")
def get_admin_overview(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = auth_service.get_user_by_token(authorization)
    actor = user["email"] if user else "admin@fasttrade.ai"
    users = auth_service.list_users()
    return {
        "actor": actor,
        "users": users,
        "system_config": auth_service.get_system_config(),
        "audit_logs": auth_service.get_audit_logs(limit=40),
        "email_logs": email_service.get_logs(limit=30),
        "resend_status": {
            "configured": email_service.is_configured,
            "from_email": email_service.from_email,
        },
        "database_status": auth_service.get_database_status(),
        "nebius_status": nebius_ai_service.get_status(),
    }


@router.post("/api/v1/admin/supabase-sync")
def sync_to_self_hosted_supabase(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = auth_service.get_user_by_token(authorization)
    actor_email = user["email"] if user else "admin@fasttrade.ai"
    sync_res = auth_service.sync_schema_and_data_to_supabase()
    auth_service.log_audit(
        actor_email,
        "SUPABASE_SCHEMA_SYNC",
        f"Triggered schema & table sync to {auth_service.supabase_url} -> status={sync_res.get('status')}",
    )
    return {
        "sync_result": sync_res,
        "database_status": auth_service.get_database_status(),
    }


@router.put("/api/v1/admin/users/{target_user_id}")
def admin_update_user_endpoint(
    target_user_id: int,
    req: AdminUserUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = auth_service.get_user_by_token(authorization)
    actor_email = user["email"] if user else "admin@fasttrade.ai"
    try:
        updated = auth_service.admin_update_user(
            actor_email=actor_email,
            target_user_id=target_user_id,
            role=req.role,
            is_active=req.is_active,
        )
        return {"user": updated}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/api/v1/admin/config")
def admin_update_system_config(
    req: SystemConfigUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = auth_service.get_user_by_token(authorization)
    actor_email = user["email"] if user else "admin@fasttrade.ai"
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    updated = auth_service.update_system_config(actor_email=actor_email, updates=updates)
    return {"system_config": updated}


@router.post("/api/v1/admin/send-email")
def dispatch_transactional_email(
    req: SendEmailRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = auth_service.get_user_by_token(authorization)
    actor_email = user["email"] if user else "admin@fasttrade.ai"

    if req.report_markdown and req.order_id:
        result = email_service.send_tca_report_email(
            email=req.to_email,
            order_id=req.order_id,
            scenario=req.scenario or "normal_market",
            shortfall_bps=req.shortfall_bps or 0.0,
            savings_usd=req.savings_usd or 0.0,
            report_markdown=req.report_markdown,
        )
    else:
        html = email_service._wrap_genesis_template(
            title=req.subject,
            badge="FASTTRADE EXECUTIVE DISPATCH",
            content_html=f"<p style='white-space: pre-wrap;'>{req.message}</p>",
        )
        result = email_service.send_email(
            to_email=req.to_email,
            subject=req.subject,
            html_body=html,
            category="executive_dispatch",
        )

    auth_service.log_audit(
        actor_email,
        "RESEND_EMAIL_DISPATCH",
        f"Dispatched '{req.subject}' to {req.to_email} -> status={result.get('status')}",
    )
    return {"email_result": result, "email_logs": email_service.get_logs(limit=20)}
