"""
OpenAI client with fake-key offline fallback.

If the key is missing or starts with 'sk-FAKE', all LLM calls return
deterministic placeholder responses so the app is always usable.
"""
from __future__ import annotations

from typing import Any, Iterable

from config.settings import SETTINGS
from core.logger import get_logger

log = get_logger(__name__)


def openai_status() -> str:
    """Return one of 'live', 'fake', 'missing'."""
    if not SETTINGS.openai_api_key:
        return "missing"
    if SETTINGS.is_fake_openai_key:
        return "fake"
    return "live"


class LLMFallback:
    """Deterministic responses used when OPENAI_API_KEY is absent/fake."""

    @staticmethod
    def chat(messages: list[dict]) -> str:
        """Return a simple, grounded-sounding answer based on the last user message."""
        last_user = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = str(m.get("content", ""))
                break
        return (
            "Offline fallback mode (no OpenAI key configured).\n\n"
            "Your question was:\n"
            f"> {last_user[:400]}\n\n"
            "In this mode I cannot call an LLM, but the deterministic rule engine, the "
            "Redshift analytics, the SQL safety validator, and the lineage catalog "
            "are all active. Add `OPENAI_API_KEY` to `.streamlit/secrets.toml` "
            "to unlock full AI responses grounded in your RAG index."
        )

    @staticmethod
    def synth_sql(intent_summary: str) -> str:
        return (
            "-- Offline fallback SQL (no OpenAI key configured)\n"
            f"-- Intent: {intent_summary}\n"
            "SELECT DATE_TRUNC('week', received_at) AS week,\n"
            "       AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT)) AS avg_confidence\n"
            "FROM rds_warehouse_public.facts\n"
            "WHERE name = 'confidence_score'\n"
            "  AND received_at BETWEEN :start AND :end\n"
            "GROUP BY 1\n"
            "ORDER BY 1\n"
            "LIMIT 5000;\n"
        )


def chat_completion(messages: list[dict], *, model: str | None = None, temperature: float = 0.2) -> str:
    if openai_status() != "live":
        return LLMFallback.chat(messages)
    try:
        from openai import OpenAI
        client = OpenAI(api_key=SETTINGS.openai_api_key)
        resp = client.chat.completions.create(
            model=model or SETTINGS.openai_model_chat,
            messages=messages,   # type: ignore[arg-type]
            temperature=temperature,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:
        log.warning("OpenAI error — falling back: %s", exc)
        return LLMFallback.chat(messages)


def stream_chat(messages: list[dict], *, model: str | None = None, temperature: float = 0.2) -> Iterable[str]:
    """Yields tokens. Falls back to a single offline chunk if no key."""
    if openai_status() != "live":
        yield LLMFallback.chat(messages)
        return
    try:
        from openai import OpenAI
        client = OpenAI(api_key=SETTINGS.openai_api_key)
        stream = client.chat.completions.create(
            model=model or SETTINGS.openai_model_chat,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            stream=True,
        )
        for chunk in stream:
            try:
                delta = chunk.choices[0].delta.content  # type: ignore[union-attr]
                if delta:
                    yield delta
            except Exception:  # pragma: no cover
                continue
    except Exception as exc:  # pragma: no cover
        log.warning("OpenAI stream error — falling back: %s", exc)
        yield LLMFallback.chat(messages)
