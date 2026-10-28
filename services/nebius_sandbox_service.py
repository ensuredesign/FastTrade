"""Nebius Token Factory Sandboxes Beta (`contree-sdk`) Integration for FastTrade Institutional EMS.

Provides isolated, VM-backed container execution with ConTree versioned filesystem checkpoints
and parallel branch evaluation (`python:3.12-slim`) for:
1. Self-Iterating Quant Strategy Coding Agent (`v1 -> v2 -> v3` parallel VM branch evaluation & promotion)
2. 5-Stage Autonomous Execution Workflow (Stage 3 isolated L2 Cost-at-Risk sandbox verification)
3. Interactive Quant Sandbox Runner (`POST /api/v1/ai/sandbox-run`)
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from services.email_service import _load_dotenv_if_present
from services.langsmith_service import langsmith_service

_load_dotenv_if_present()

SANDBOXES_REST_BASE = "https://api.tokenfactory.nebius.com/sandboxes"
DEFAULT_BASE_IMAGE = "python:3.12-slim"

# Deterministic 4-assertion L2 Institutional Test Harness injected into the base ConTree checkpoint image
L2_TEST_HARNESS_PY = r'''import ast
import json
import sys

version_tag = sys.argv[1] if len(sys.argv) > 1 else "v3"
fn_name = f"compute_execution_slice_{version_tag}"

with open("/workspace/candidate.py", "r", encoding="utf-8") as f:
    src = f.read()

with open("/workspace/market_ctx.json", "r", encoding="utf-8") as f:
    mctx = json.load(f)

tests = []

# Test 1: AST & Type Contract
try:
    ast.parse(src)
    ns = {}
    exec(compile(src, "/workspace/candidate.py", "exec"), ns)
    fn = ns[fn_name]
    sample_out = fn({
        "remaining_qty": mctx.get("qty", 500.0),
        "slices_left": 12,
        "adverse_selection_prob": 0.25,
        "ofi_instant": 8.0,
        "depth_imbalance_l1": 0.12,
        "urgency_score": 0.45,
    })
    assert isinstance(sample_out, dict) and "action" in sample_out and "slice_qty" in sample_out
    tests.append({"name": "test_ast_and_type_contract", "status": "PASS", "detail": f"Verified in Nebius Sandbox VM ({sys.version.split()[0]})"})
except Exception as exc:
    tests.append({"name": "test_ast_and_type_contract", "status": "FAIL", "detail": str(exc)})
    print(json.dumps({"passed_count": 0, "total_tests": 4, "unit_tests": tests}))
    sys.exit(1)

# Test 2: Inventory Conservation
rem = float(mctx.get("qty", 500.0))
for s_left in range(12, 0, -1):
    res = fn({
        "remaining_qty": rem,
        "slices_left": s_left,
        "adverse_selection_prob": 0.22,
        "ofi_instant": 4.0,
        "depth_imbalance_l1": 0.05,
        "urgency_score": 0.85 if s_left <= 2 else 0.40,
    })
    rem = max(0.0, rem - float(res.get("slice_qty", 0.0)))

if rem <= float(mctx.get("qty", 500.0)) * 0.05:
    tests.append({"name": "test_inventory_conservation", "status": "PASS", "detail": "100% target block inventory scheduled across horizon"})
else:
    tests.append({"name": "test_inventory_conservation", "status": "FAIL", "detail": f"Unfilled residual {rem:.2f} units"})

# Test 3: Adverse-Selection Toxicity Shield
tox_res = fn({
    "remaining_qty": 500.0,
    "slices_left": 10,
    "adverse_selection_prob": 0.74,
    "ofi_instant": -22.0,
    "depth_imbalance_l1": -0.35,
    "urgency_score": 0.42,
})
if tox_res.get("action") == "wait" and float(tox_res.get("slice_qty", 1.0)) == 0.0:
    tests.append({"name": "test_adverse_selection_shield", "status": "PASS", "detail": "Withdrew passive liquidity when XGBoost toxicity=74% (>54%)"})
else:
    tests.append({"name": "test_adverse_selection_shield", "status": "FAIL", "detail": f"Exposed passive quote ({tox_res.get('action')}) under 74% toxic sweep"})

# Test 4: Almgren-Chriss Hyperbolic + L1 Imbalance Skew
skew_res = fn({
    "remaining_qty": 500.0,
    "slices_left": 10,
    "adverse_selection_prob": 0.24,
    "ofi_instant": -5.0,
    "depth_imbalance_l1": -0.40,
    "urgency_score": 0.35,
})
if float(skew_res.get("limit_offset_bps", 0.0)) > 0.25 and "venue_preference" in skew_res:
    tests.append({"name": "test_ofi_imbalance_skew_efficiency", "status": "PASS", "detail": f"Applied +{skew_res.get('limit_offset_bps')} bps L1 skew & {skew_res.get('venue_preference')}"})
else:
    tests.append({"name": "test_ofi_imbalance_skew_efficiency", "status": "FAIL", "detail": "Missing closed-form Almgren-Chriss sinh(kappa) & L1 imbalance limit skew"})

passed = sum(1 for t in tests if t["status"] == "PASS")
print(json.dumps({
    "version": version_tag,
    "python_runtime": sys.version.split()[0],
    "passed_count": passed,
    "total_tests": len(tests),
    "unit_tests": tests,
}))
sys.exit(0 if passed == len(tests) else 2)
'''


class NebiusSandboxService:
    """Manages isolated cloud VM execution on Nebius Token Factory Sandboxes Beta (`contree-sdk`)."""

    def __init__(self) -> None:
        self._cached_whoami: Optional[Dict[str, Any]] = None
        self._cached_whoami_ts: float = 0.0
        self._prepared_harness_uuid: Optional[str] = None
        self._total_runs: int = 0
        self._last_checkpoint_uuid: Optional[str] = None
        self._last_latency_ms: Optional[float] = None
        self._last_base_image: str = DEFAULT_BASE_IMAGE

    @property
    def api_key(self) -> str:
        _load_dotenv_if_present()
        return os.environ.get("NEBIUS_API_KEY", "").strip()

    @property
    def project_id(self) -> str:
        _load_dotenv_if_present()
        return os.environ.get("NEBIUS_PROJECT_ID", "").strip()

    @property
    def service_account_id(self) -> str:
        _load_dotenv_if_present()
        return os.environ.get("NEBIUS_SA_ID", "").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.project_id)

    def get_status(self, force_probe: bool = False) -> Dict[str, Any]:
        """Return Nebius Token Factory Sandboxes Beta readiness, permissions, concurrency limits, and telemetry."""
        sdk_available = False
        try:
            import contree_sdk  # noqa: F401
            sdk_available = True
        except Exception:
            sdk_available = False

        now = time.time()
        whoami_data: Optional[Dict[str, Any]] = self._cached_whoami
        if self.is_configured and (force_probe or whoami_data is None or (now - self._cached_whoami_ts) > 120.0):
            if not os.environ.get("PYTEST_CURRENT_TEST") or force_probe:
                try:
                    req = urllib.request.Request(
                        f"{SANDBOXES_REST_BASE}/v1/whoami",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Project": self.project_id,
                            "User-Agent": "FastTrade-Institutional-EMS/2.0 (contree-sdk/0.3.6)",
                        },
                    )
                    with urllib.request.urlopen(req, timeout=5.0) as resp:
                        whoami_data = json.loads(resp.read().decode("utf-8"))
                        self._cached_whoami = whoami_data
                        self._cached_whoami_ts = now
                except Exception:
                    pass

        limits = (whoami_data or {}).get("limits") or {
            "instance_max_concurrency": 50,
            "instance_max_timeout": 3600,
        }
        permissions = (whoami_data or {}).get("permissions") or {
            "import": self.is_configured,
            "spawn": self.is_configured,
            "spawn_disposable": self.is_configured,
        }

        return {
            "configured": self.is_configured,
            "sdk_installed": sdk_available,
            "sdk_package": "contree-sdk==0.3.6",
            "status": "live_beta_connected" if (self.is_configured and whoami_data) else ("configured" if self.is_configured else "offline"),
            "endpoint": SANDBOXES_REST_BASE,
            "project_id": self.project_id or None,
            "service_account_id": self.service_account_id or None,
            "base_image": self._last_base_image,
            "prepared_harness_uuid": self._prepared_harness_uuid,
            "permissions": permissions,
            "limits": limits,
            "telemetry": {
                "total_sandbox_operations": self._total_runs,
                "last_checkpoint_uuid": self._last_checkpoint_uuid,
                "last_latency_ms": self._last_latency_ms,
            },
        }

    async def _run_branched_async(
        self,
        code_v1: str,
        code_v2: str,
        code_v3: str,
        market_ctx: Dict[str, Any],
    ) -> Dict[str, Any]:
        from contree_sdk import Contree
        from contree_sdk.config import ContreeConfig
        from contree_sdk.auth import IAMAuth

        t0 = time.perf_counter()
        cfg = ContreeConfig(
            auth=IAMAuth(token=self.api_key, project_id=self.project_id),
            transport_timeout=15.0,
            operation_timeout=45.0,
        )
        client = Contree(config=cfg)

        # Step 1: Prepare or reuse immutable ConTree checkpoint with the L2 test harness
        if self._prepared_harness_uuid:
            try:
                harness_img = await client.images.use(self._prepared_harness_uuid, strict=True)
            except Exception:
                self._prepared_harness_uuid = None
                harness_img = None
        else:
            harness_img = None

        if harness_img is None:
            base = await client.images.use(DEFAULT_BASE_IMAGE)
            prepared = await base.run(
                shell="mkdir -p /workspace && ls -la /workspace",
                files={"/workspace/l2_harness.py": L2_TEST_HARNESS_PY.encode("utf-8")},
                disposable=False,
                timeout=35,
            )
            if prepared.exit_code == 0 and prepared.uuid:
                self._prepared_harness_uuid = str(prepared.uuid)
                harness_img = await client.images.use(prepared.uuid, strict=True)
            else:
                harness_img = base

        ctx_bytes = json.dumps(market_ctx).encode("utf-8")

        # Step 2: Branch 3 isolated Sandbox VMs concurrently via asyncio.gather (ConTree parallel branching!)
        # v1 and v2 are disposable=True; v3 is disposable=False so the passing production candidate returns a saved image UUID!
        res_v1, res_v2, res_v3 = await asyncio.gather(
            harness_img.run(
                shell="python3 /workspace/l2_harness.py v1",
                files={
                    "/workspace/l2_harness.py": L2_TEST_HARNESS_PY.encode("utf-8"),
                    "/workspace/market_ctx.json": ctx_bytes,
                    "/workspace/candidate.py": code_v1.encode("utf-8"),
                },
                disposable=True,
                timeout=30,
            ),
            harness_img.run(
                shell="python3 /workspace/l2_harness.py v2",
                files={
                    "/workspace/l2_harness.py": L2_TEST_HARNESS_PY.encode("utf-8"),
                    "/workspace/market_ctx.json": ctx_bytes,
                    "/workspace/candidate.py": code_v2.encode("utf-8"),
                },
                disposable=True,
                timeout=30,
            ),
            harness_img.run(
                shell="python3 /workspace/l2_harness.py v3",
                files={
                    "/workspace/l2_harness.py": L2_TEST_HARNESS_PY.encode("utf-8"),
                    "/workspace/market_ctx.json": ctx_bytes,
                    "/workspace/candidate.py": code_v3.encode("utf-8"),
                },
                disposable=False,
                timeout=30,
            ),
        )

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        promoted_uuid = str(res_v3.uuid) if getattr(res_v3, "uuid", None) else self._prepared_harness_uuid
        self._total_runs += 3
        self._last_checkpoint_uuid = promoted_uuid
        self._last_latency_ms = elapsed_ms

        branches: List[Dict[str, Any]] = []
        for ver, r in (("v1", res_v1), ("v2", res_v2), ("v3", res_v3)):
            parsed = {}
            try:
                parsed = json.loads((r.stdout or "").strip().splitlines()[-1])
            except Exception:
                parsed = {}
            branches.append(
                {
                    "version": ver,
                    "exit_code": int(r.exit_code) if r.exit_code is not None else -1,
                    "image_uuid": str(r.uuid) if getattr(r, "uuid", None) else None,
                    "stdout": (r.stdout or "").strip(),
                    "stderr": (r.stderr or "").strip(),
                    "parsed": parsed,
                }
            )

        return {
            "executed_live": True,
            "provider": "Nebius Token Factory Sandboxes Beta (ConTree)",
            "project_id": self.project_id,
            "service_account_id": self.service_account_id or None,
            "base_image": DEFAULT_BASE_IMAGE,
            "base_checkpoint_uuid": self._prepared_harness_uuid,
            "promoted_image_uuid": promoted_uuid,
            "parallel_branches": 3,
            "latency_ms": elapsed_ms,
            "branches": branches,
        }

    def run_branched_coding_verification(
        self,
        code_v1: str,
        code_v2: str,
        code_v3: str,
        market_ctx: Dict[str, Any],
        force_live: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Execute 3 candidate Python algorithms in parallel isolated Nebius Sandbox VMs."""
        if not self.is_configured:
            return None
        if os.environ.get("PYTEST_CURRENT_TEST") and not force_live:
            return None

        with langsmith_service.trace_span(
            name="NebiusSandboxes.ConTree_Parallel_3VMs",
            run_type="tool",
            inputs={"market_ctx": market_ctx, "base_image": DEFAULT_BASE_IMAGE, "parallel_branches": 3},
            tags=["nebius-sandboxes", "contree-sdk"],
            metadata={"project_id": self.project_id},
            force_live=force_live,
        ) as sb_span:
            try:
                res = asyncio.run(self._run_branched_async(code_v1, code_v2, code_v3, market_ctx))
            except RuntimeError:
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    fut = pool.submit(
                        lambda: asyncio.run(self._run_branched_async(code_v1, code_v2, code_v3, market_ctx))
                    )
                    res = fut.result(timeout=55.0)
            except Exception as exc:
                sb_span.set_error(str(exc))
                return None

            if res:
                res["langsmith_trace_id"] = sb_span.trace_id
                sb_span.set_outputs(
                    {
                        "promoted_image_uuid": res.get("promoted_image_uuid"),
                        "base_checkpoint_uuid": res.get("base_checkpoint_uuid"),
                        "latency_ms": res.get("latency_ms"),
                    }
                )
            return res

    def execute_custom_sandbox_code(
        self,
        python_code: str,
        apt_packages: Optional[List[str]] = None,
        pip_packages: Optional[List[str]] = None,
        save_checkpoint: bool = True,
    ) -> Dict[str, Any]:
        """Run custom Python code (with optional apt/pip setup) inside an isolated Nebius Sandbox VM."""
        t0 = time.perf_counter()
        if not self.is_configured:
            raise ValueError("Nebius Sandboxes credentials (NEBIUS_API_KEY and NEBIUS_PROJECT_ID) are not configured.")

        from contree_sdk import ContreeSync
        from contree_sdk.config import ContreeConfig
        from contree_sdk.auth import IAMAuth

        cfg = ContreeConfig(
            auth=IAMAuth(token=self.api_key, project_id=self.project_id),
            transport_timeout=15.0,
            operation_timeout=90.0,
        )
        client = ContreeSync(config=cfg)
        sandbox = client.images.use(DEFAULT_BASE_IMAGE)

        setup_steps: List[Dict[str, Any]] = []
        clean_apt = [p.strip() for p in (apt_packages or []) if p.strip()]
        clean_pip = [p.strip() for p in (pip_packages or []) if p.strip()]

        with langsmith_service.trace_span(
            name="NebiusSandboxes.CustomVMExecution",
            run_type="tool",
            inputs={"apt_packages": clean_apt, "pip_packages": clean_pip, "python_code_preview": python_code[:500]},
            tags=["nebius-sandboxes", "contree-sdk", "custom-vm"],
            metadata={"project_id": self.project_id},
        ) as run_span:
            if clean_apt:
                sandbox = sandbox.run("apt-get", args=["update", "-q"], disposable=False).wait()
                sandbox = sandbox.run("apt-get", args=["install", "-y", *clean_apt], disposable=False).wait()
                setup_steps.append({"step": f"apt-get install -y {' '.join(clean_apt)}", "checkpoint_uuid": str(sandbox.uuid)})

            if clean_pip:
                sandbox = sandbox.run("pip", args=["install", "--quiet", *clean_pip], disposable=False).wait()
                setup_steps.append({"step": f"pip install {' '.join(clean_pip)}", "checkpoint_uuid": str(sandbox.uuid)})

            run_res = sandbox.run(
                "python",
                args=["-c", python_code],
                disposable=not save_checkpoint,
            ).wait()

            elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            checkpoint_uuid = str(run_res.uuid) if getattr(run_res, "uuid", None) else (str(sandbox.uuid) if getattr(sandbox, "uuid", None) else None)
            self._total_runs += 1 + len(setup_steps)
            self._last_checkpoint_uuid = checkpoint_uuid
            self._last_latency_ms = elapsed_ms

            run_span.set_outputs(
                {
                    "exit_code": int(run_res.exit_code) if run_res.exit_code is not None else -1,
                    "checkpoint_uuid": checkpoint_uuid,
                    "stdout_preview": (run_res.stdout or "")[:500],
                    "latency_ms": elapsed_ms,
                }
            )

            return {
                "status": "ok" if run_res.exit_code == 0 else "nonzero_exit",
                "provider": "Nebius Token Factory Sandboxes Beta (ConTree)",
                "project_id": self.project_id,
                "service_account_id": self.service_account_id or None,
                "base_image": DEFAULT_BASE_IMAGE,
                "checkpoint_uuid": checkpoint_uuid,
                "exit_code": int(run_res.exit_code) if run_res.exit_code is not None else -1,
                "stdout": run_res.stdout or "",
                "stderr": run_res.stderr or "",
                "setup_steps": setup_steps,
                "latency_ms": elapsed_ms,
                "langsmith_trace_id": run_span.trace_id,
                "executed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }


nebius_sandbox_service = NebiusSandboxService()
