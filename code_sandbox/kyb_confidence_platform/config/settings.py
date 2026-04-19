"""
Centralized settings.

Reads from `st.secrets` first, then from environment variables, then from defaults.
No secrets are ever hard-coded.
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

# Cache the Streamlit secrets dict once so we don't call st.secrets
# on every field — each failed access fires a Streamlit warning, causing
# the "No secrets found" banner to appear dozens of times on startup.
_ST_SECRETS: dict[str, Any] | None = None
_ST_SECRETS_LOADED = False


def _load_st_secrets() -> dict[str, Any]:
    global _ST_SECRETS, _ST_SECRETS_LOADED
    if _ST_SECRETS_LOADED:
        return _ST_SECRETS or {}
    _ST_SECRETS_LOADED = True
    if not _HAS_ST:
        _ST_SECRETS = {}
        return {}
    try:
        # Access .to_dict() to load all secrets in one call.
        # If the file doesn't exist Streamlit raises FileNotFoundError.
        _ST_SECRETS = dict(st.secrets)
    except Exception:
        _ST_SECRETS = {}
    return _ST_SECRETS or {}


def _get(key: str, default: Any = None) -> Any:
    secrets = _load_st_secrets()
    if key in secrets:
        return secrets[key]
    return os.environ.get(key, default)


def _get_bool(key: str, default: bool) -> bool:
    v = _get(key, None)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "t", "yes", "y", "on")


def _get_int(key: str, default: int) -> int:
    v = _get(key, None)
    try:
        return int(v) if v is not None else default
    except (TypeError, ValueError):
        return default


@dataclass
class Settings:
    # --- OpenAI ---
    openai_api_key: str = field(default_factory=lambda: _get("OPENAI_API_KEY", "") or "")
    openai_model_chat: str = field(default_factory=lambda: _get("OPENAI_MODEL_CHAT", "gpt-4o") or "gpt-4o")
    openai_model_mini: str = field(default_factory=lambda: _get("OPENAI_MODEL_MINI", "gpt-4o-mini") or "gpt-4o-mini")

    # --- Redshift ---
    redshift_host: str = field(default_factory=lambda: _get("REDSHIFT_HOST", "") or "")
    redshift_port: int = field(default_factory=lambda: _get_int("REDSHIFT_PORT", 5439))
    redshift_db: str = field(default_factory=lambda: _get("REDSHIFT_DB", "dev") or "dev")
    redshift_user: str = field(default_factory=lambda: _get("REDSHIFT_USER", "") or "")
    redshift_password: str = field(default_factory=lambda: _get("REDSHIFT_PASSWORD", "") or "")

    # --- Safety / limits ---
    statement_timeout_ms: int = field(default_factory=lambda: _get_int("STATEMENT_TIMEOUT_MS", 30_000))
    default_query_limit: int = field(default_factory=lambda: _get_int("DEFAULT_QUERY_LIMIT", 5_000))
    pii_masking: bool = field(default_factory=lambda: _get_bool("PII_MASKING", True))

    # --- Feature flags ---
    enable_ai_copilot: bool = field(default_factory=lambda: _get_bool("ENABLE_AI_COPILOT", True))
    enable_view_generator: bool = field(default_factory=lambda: _get_bool("ENABLE_VIEW_GENERATOR", True))
    enable_python_runner: bool = field(default_factory=lambda: _get_bool("ENABLE_PYTHON_RUNNER", True))

    # --- RAG ---
    chroma_persist_dir: str = field(default_factory=lambda: _get("CHROMA_PERSIST_DIR", "./.chroma") or "./.chroma")

    # --- Deployment ---
    app_mode: str = field(default_factory=lambda: _get("APP_MODE", "local") or "local")  # local | prod
    demo_mode: bool = field(default_factory=lambda: _get_bool("DEMO_MODE", True))   # default True: uses fixtures when Redshift unavailable

    # Derived
    @property
    def is_fake_openai_key(self) -> bool:
        k = (self.openai_api_key or "").strip()
        return (not k) or k.startswith("sk-FAKE") or k.startswith("FAKE") or k == "dummy"

    @property
    def has_redshift(self) -> bool:
        return bool(self.redshift_host and self.redshift_user and self.redshift_password)


SETTINGS = Settings()
