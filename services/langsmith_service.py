"""LangSmith Agentic Observability, Hierarchical Run-Tree Tracing & Public Audit Service for FastTrade.

Traces multi-tier NVIDIA Nemotron-3 LLM calls on Nebius Token Factory, Tavily Financial Search/Extract,
Nebius Sandboxes Beta (`contree-sdk`) parallel Cloud VM executions, and 5-Stage Autonomous Workflows
into unified hierarchical Run Trees (`smith.langchain.com`), with 1-click public read-only audit links
for hackathon judges and institutional CRO governance.
"""

from __future__ import annotations

import contextlib
import os
import time
import warnings
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, Iterator, List, Literal, Optional


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE_PATH = PROJECT_ROOT / ".env"

RunType = Literal["chain", "llm", "tool", "retriever", "prompt"]


def _load_dotenv_if_present(dotenv_path: Path = ENV_FILE_PATH) -> None:
    if not dotenv_path.exists():
        return
    try:
        for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv_if_present()


@dataclass
class SpanHandle:
    """Lightweight handle yielded by `langsmith_service.trace_span(...)`."""

    name: str
    run_type: str
    run_id: Optional[str] = None
    trace_id: Optional[str] = None
    outputs: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def set_outputs(self, data: Dict[str, Any]) -> None:
        self.outputs.update(data)

    def set_error(self, err_msg: str) -> None:
        self.error = err_msg


class LangSmithObservabilityService:
    """Zero-bloat LangSmith RunTree tracing & public trace-sharing service."""

    def __init__(self) -> None:
        self._client: Any = None
        self._total_root_traces: int = 0
        self._total_child_spans: int = 0
        self._last_trace_id: Optional[str] = None
        self._last_trace_name: Optional[str] = None
        self._last_public_url: Optional[str] = None
        self._public_urls: Dict[str, str] = {}
        self._recent_traces: Deque[Dict[str, Any]] = deque(maxlen=15)

    @property
    def api_key(self) -> str:
        _load_dotenv_if_present()
        return (
            os.environ.get("LANGSMITH_API_KEY")
            or os.environ.get("LANGCHAIN_API_KEY")
            or ""
        ).strip()

    @property
    def project_name(self) -> str:
        _load_dotenv_if_present()
        return (
            os.environ.get("LANGSMITH_PROJECT")
            or os.environ.get("LANGCHAIN_PROJECT")
            or "FastTrade-Nebius-EMS"
        ).strip()

    @property
    def endpoint(self) -> str:
        _load_dotenv_if_present()
        return (
            os.environ.get("LANGSMITH_ENDPOINT")
            or os.environ.get("LANGCHAIN_ENDPOINT")
            or "https://api.smith.langchain.com"
        ).strip().rstrip("/")

    @property
    def is_configured(self) -> bool:
        key = self.api_key
        return bool(key and not key.startswith("your_") and not key.startswith("lsv2_your_"))

    def _get_sdk_version(self) -> Optional[str]:
        try:
            import langsmith
            return getattr(langsmith, "__version__", "installed")
        except Exception:
            return None

    def _get_client(self) -> Any:
        if not self.is_configured:
            return None
        if self._client is None:
            try:
                from langsmith import Client
                os.environ.setdefault("LANGSMITH_TRACING", "true")
                os.environ.setdefault("LANGSMITH_PROJECT", self.project_name)
                self._client = Client(
                    api_key=self.api_key,
                    api_url=self.endpoint,
                    auto_batch_tracing=True,
                )
            except Exception:
                self._client = None
        return self._client

    def get_status(self) -> Dict[str, Any]:
        sdk_ver = self._get_sdk_version()
        return {
            "configured": self.is_configured,
            "sdk_installed": sdk_ver is not None,
            "sdk_package": f"langsmith=={sdk_ver}" if sdk_ver else "langsmith (not installed)",
            "status": "live_tracing_enabled" if (self.is_configured and sdk_ver) else "offline",
            "project_name": self.project_name,
            "endpoint": self.endpoint,
            "telemetry": {
                "total_root_traces": self._total_root_traces,
                "total_child_spans": self._total_child_spans,
                "last_trace_id": self._last_trace_id,
                "last_trace_name": self._last_trace_name,
                "last_public_url": self._last_public_url,
            },
            "recent_traces": list(self._recent_traces),
        }

    @contextlib.contextmanager
    def trace_span(
        self,
        name: str,
        run_type: RunType = "chain",
        inputs: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        force_live: bool = False,
    ) -> Iterator[SpanHandle]:
        """Trace a parent chain or child LLM/tool/retriever span in LangSmith."""
        handle = SpanHandle(name=name, run_type=run_type)

        if not self.is_configured or (os.environ.get("PYTEST_CURRENT_TEST") and not force_live):
            yield handle
            return

        client = self._get_client()
        if client is None:
            yield handle
            return

        try:
            import langsmith as ls
        except Exception:
            yield handle
            return

        t0 = time.perf_counter()
        parent_rt = None
        try:
            parent_rt = ls.get_current_run_tree()
        except Exception:
            parent_rt = None

        had_parent = parent_rt is not None
        merged_tags = ["fasttrade-ems", "nebius-token-factory", *(tags or [])]
        merged_meta = {
            "application": "FastTrade Institutional EMS",
            "orchestrator": "Nebius Token Factory + NVIDIA Nemotron-3",
            **(metadata or {}),
        }

        cm = None
        rt = None
        try:
            cm = ls.trace(
                name=name,
                run_type=run_type,
                inputs=inputs or {},
                project_name=self.project_name,
                client=client,
                tags=merged_tags,
                metadata=merged_meta,
            )
            rt = cm.__enter__()
            handle.run_id = str(rt.id)
            handle.trace_id = str(getattr(rt, "trace_id", None) or rt.id)
        except Exception:
            cm = None
            rt = None

        if cm is None or rt is None:
            yield handle
            return

        exc_info = (None, None, None)
        try:
            yield handle
        except BaseException as inner_exc:
            exc_info = (type(inner_exc), inner_exc, inner_exc.__traceback__)
            try:
                rt.end(error=f"{type(inner_exc).__name__}: {inner_exc}")
            except Exception:
                pass
            raise
        else:
            try:
                rt.end(
                    outputs=handle.outputs or {"status": "ok"},
                    error=handle.error,
                )
            except Exception:
                pass
        finally:
            try:
                cm.__exit__(*exc_info)
            except Exception:
                pass

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        if had_parent:
            self._total_child_spans += 1
        else:
            self._total_root_traces += 1
            self._last_trace_id = handle.trace_id
            self._last_trace_name = name
            self._recent_traces.appendleft(
                {
                    "trace_id": handle.trace_id,
                    "name": name,
                    "run_type": run_type,
                    "project_name": self.project_name,
                    "latency_ms": elapsed_ms,
                    "public_url": self._public_urls.get(handle.trace_id or ""),
                    "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                }
            )
            # On Vercel Serverless, flush immediately before container freeze
            if os.environ.get("VERCEL") or force_live:
                try:
                    client.flush(timeout=2.0)
                except Exception:
                    pass

    def share_trace_publicly(self, trace_id: str) -> Dict[str, Any]:
        """Publish a read-only LangSmith trace URL so judges/auditors can inspect without login."""
        clean_id = (trace_id or "").strip()
        if not clean_id:
            raise ValueError("trace_id is required")

        if clean_id in self._public_urls:
            return {
                "trace_id": clean_id,
                "public_url": self._public_urls[clean_id],
                "project_name": self.project_name,
                "cached": True,
            }

        client = self._get_client()
        if client is None:
            raise ValueError("LangSmith is not configured on this server")

        try:
            client.flush(timeout=2.5)
        except Exception:
            pass

        last_err: Optional[Exception] = None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=DeprecationWarning)
            for wait_sec in (0.0, 1.0, 1.8, 2.5):
                if wait_sec > 0:
                    time.sleep(wait_sec)
                try:
                    try:
                        public_url = client.read_run_shared_link(clean_id)
                    except Exception:
                        public_url = None
                    if not public_url:
                        public_url = client.share_run(clean_id)
                    if public_url:
                        self._public_urls[clean_id] = str(public_url)
                        self._last_public_url = str(public_url)
                        for item in self._recent_traces:
                            if item.get("trace_id") == clean_id:
                                item["public_url"] = str(public_url)
                        return {
                            "trace_id": clean_id,
                            "public_url": str(public_url),
                            "project_name": self.project_name,
                            "cached": False,
                        }
                except Exception as exc:
                    last_err = exc

        raise RuntimeError(f"LangSmith trace {clean_id} is still indexing or unavailable: {last_err}")


langsmith_service = LangSmithObservabilityService()
