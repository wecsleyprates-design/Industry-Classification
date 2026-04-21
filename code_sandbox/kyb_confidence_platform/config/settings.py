"""
Centralized settings.

Reads from environment variables at module-import time (safe — no Streamlit
calls). After `st.set_page_config()` has been called, `SETTINGS.refresh()`
overlays any values found in `st.secrets` without triggering Streamlit errors.

Key rule: NEVER call `st.secrets` (or any st.* command) at module-import time.
That happens before `st.set_page_config()` and raises
`StreamlitSetPageConfigMustBeFirstCommandError`.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

from dotenv import load_dotenv

load_dotenv()

try:
    import streamlit as st  # type: ignore
    _HAS_ST = True
except Exception:  # pragma: no cover
    _HAS_ST = False


# ── Env-only helpers (safe at import time) ────────────────────────────────────

def _env(key: str, default: Any = None) -> Any:
    """Read from env vars only. Never touches st.secrets."""
    return os.environ.get(key, default)


def _env_bool(key: str, default: bool) -> bool:
    v = _env(key, None)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "t", "yes", "y", "on")


def _env_int(key: str, default: int) -> int:
    v = _env(key, None)
    try:
        return int(v) if v is not None else default
    except (TypeError, ValueError):
        return default


# ── Settings dataclass ────────────────────────────────────────────────────────

@dataclass
class Settings:
    # --- OpenAI ---
    openai_api_key:    str = field(default_factory=lambda: _env("OPENAI_API_KEY", "") or "")
    openai_model_chat: str = field(default_factory=lambda: _env("OPENAI_MODEL_CHAT", "gpt-4o") or "gpt-4o")
    openai_model_mini: str = field(default_factory=lambda: _env("OPENAI_MODEL_MINI", "gpt-4o-mini") or "gpt-4o-mini")

    # --- Redshift ---
    redshift_host:     str = field(default_factory=lambda: _env("REDSHIFT_HOST", "") or "")
    redshift_port:     int = field(default_factory=lambda: _env_int("REDSHIFT_PORT", 5439))
    redshift_db:       str = field(default_factory=lambda: _env("REDSHIFT_DB", "dev") or "dev")
    redshift_user:     str = field(default_factory=lambda: _env("REDSHIFT_USER", "") or "")
    redshift_password: str = field(default_factory=lambda: _env("REDSHIFT_PASSWORD", "") or "")

    # --- Safety / limits ---
    statement_timeout_ms: int  = field(default_factory=lambda: _env_int("STATEMENT_TIMEOUT_MS", 30_000))
    default_query_limit:  int  = field(default_factory=lambda: _env_int("DEFAULT_QUERY_LIMIT", 5_000))
    pii_masking:          bool = field(default_factory=lambda: _env_bool("PII_MASKING", True))

    # --- Feature flags ---
    enable_ai_copilot:     bool = field(default_factory=lambda: _env_bool("ENABLE_AI_COPILOT", True))
    enable_view_generator: bool = field(default_factory=lambda: _env_bool("ENABLE_VIEW_GENERATOR", True))
    enable_python_runner:  bool = field(default_factory=lambda: _env_bool("ENABLE_PYTHON_RUNNER", True))

    # --- RAG ---
    chroma_persist_dir: str = field(default_factory=lambda: _env("CHROMA_PERSIST_DIR", "./.chroma") or "./.chroma")

    # --- Deployment ---
    app_mode:  str  = field(default_factory=lambda: _env("APP_MODE", "local") or "local")
    demo_mode: bool = field(default_factory=lambda: _env_bool("DEMO_MODE", True))  # True = use fixtures when Redshift unavailable

    # Derived
    @property
    def is_fake_openai_key(self) -> bool:
        k = (self.openai_api_key or "").strip()
        return (not k) or k.startswith("sk-FAKE") or k.startswith("FAKE") or k == "dummy"

    @property
    def has_redshift(self) -> bool:
        return bool(self.redshift_host and self.redshift_user and self.redshift_password)

    def refresh(self) -> None:
        """
        Overlay settings from st.secrets.

        Call this ONCE from main(), AFTER st.set_page_config() has been called.
        It is safe to call multiple times (idempotent) and is a no-op when
        st.secrets is unavailable.
        """
        if not _HAS_ST:
            return
        try:
            secrets = dict(st.secrets)   # safe here — set_page_config already ran
        except Exception:
            return  # no secrets.toml — keep env-var / default values

        def _s(key: str, default: Any = None) -> Any:
            return secrets.get(key, _env(key, default))

        def _sb(key: str, default: bool) -> bool:
            v = secrets.get(key, _env(key, None))
            if v is None:
                return default
            if isinstance(v, bool):
                return v
            return str(v).strip().lower() in ("1", "true", "t", "yes", "y", "on")

        def _si(key: str, default: int) -> int:
            v = secrets.get(key, _env(key, None))
            try:
                return int(v) if v is not None else default
            except (TypeError, ValueError):
                return default

        self.openai_api_key       = _s("OPENAI_API_KEY", "") or ""
        self.openai_model_chat    = _s("OPENAI_MODEL_CHAT", "gpt-4o") or "gpt-4o"
        self.openai_model_mini    = _s("OPENAI_MODEL_MINI", "gpt-4o-mini") or "gpt-4o-mini"
        self.redshift_host        = _s("REDSHIFT_HOST", "") or ""
        self.redshift_port        = _si("REDSHIFT_PORT", 5439)
        self.redshift_db          = _s("REDSHIFT_DB", "dev") or "dev"
        self.redshift_user        = _s("REDSHIFT_USER", "") or ""
        self.redshift_password    = _s("REDSHIFT_PASSWORD", "") or ""
        self.statement_timeout_ms = _si("STATEMENT_TIMEOUT_MS", 30_000)
        self.default_query_limit  = _si("DEFAULT_QUERY_LIMIT", 5_000)
        self.pii_masking          = _sb("PII_MASKING", True)
        self.enable_ai_copilot    = _sb("ENABLE_AI_COPILOT", True)
        self.enable_view_generator= _sb("ENABLE_VIEW_GENERATOR", True)
        self.enable_python_runner = _sb("ENABLE_PYTHON_RUNNER", True)
        self.chroma_persist_dir   = _s("CHROMA_PERSIST_DIR", "./.chroma") or "./.chroma"
        self.app_mode             = _s("APP_MODE", "local") or "local"
        self.demo_mode            = _sb("DEMO_MODE", True)


# Module-level singleton — populated from env vars only (no st.* calls).
# Call SETTINGS.refresh() inside main() after st.set_page_config().
SETTINGS = Settings()
