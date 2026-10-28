"""
FastTrade FastAPI Main Application.
Serves the REST API for the React + Plotly Institutional Execution Terminal
and the Nebius Token Factory + NVIDIA Nemotron Multi-Tier AI Copilot.
Run with:
    uvicorn api.main:app --reload
Base URL:
    http://127.0.0.1:8000
Docs:
    http://127.0.0.1:8000/docs
Dashboard snapshot:
    http://127.0.0.1:8000/api/v1/dashboard/snapshot
"""

import sys
from pathlib import Path

# Add project root to sys.path so project modules resolve reliably
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from api.routes.dashboard import router as dashboard_router
from api.routes.ai_copilot import router as ai_copilot_router
from api.routes.auth import router as auth_router

app = FastAPI(
    title="FastTrade Institutional Execution & Nebius NVIDIA Nemotron API",
    description="FastAPI Backend for FastTrade Quantitative SOR, Almgren-Chriss Execution, Pre-Trade Monte Carlo Stress Testing, and Nebius Token Factory NVIDIA Nemotron Multi-Tier Agent.",
    version="2.0.0",
)

# Configure CORS for local Vite development and Vercel production deployment
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8501",
    "http://127.0.0.1:8501",
    "https://fasttrade.vercel.app",
    "https://fasttrade-smoky.vercel.app",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Enforce OWASP institutional HTTP security headers on all API responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


# Register API routes
app.include_router(dashboard_router)
app.include_router(ai_copilot_router)
app.include_router(auth_router)

# Serve built React SPA assets when running in unified / Vercel FastAPI mode
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa_or_root(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    if FRONTEND_DIST.exists():
        if full_path:
            candidate = (FRONTEND_DIST / full_path).resolve()
            if str(candidate).startswith(str(FRONTEND_DIST.resolve())) and candidate.is_file():
                return FileResponse(str(candidate))
        index_html = FRONTEND_DIST / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html))
    return {
        "service": "FastTrade Institutional SOR Terminal v2.0",
        "status": "online",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
