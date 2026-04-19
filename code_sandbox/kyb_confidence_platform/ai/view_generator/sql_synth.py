"""
SQL synthesis.

The LLM produces a JSON envelope. We then:
  * ensure it's valid JSON
  * validate the SQL via `data_access.sql_safety.ensure_safe`
  * fall back to a deterministic template if anything fails
"""
from __future__ import annotations

import json
import textwrap
from dataclasses import dataclass

from ai.client import chat_completion, openai_status
from ai.prompts import VIEW_GEN_SYSTEM, VIEW_GEN_USER_TEMPLATE
from config.settings import SETTINGS
from core.logger import get_logger
from data_access.sql_safety import SafeSQL, SQLSafetyError, ensure_safe
from knowledge.metadata_catalog import TABLES, COLUMNS

from .intent import Intent
from .planner import Plan

log = get_logger(__name__)


@dataclass
class SynthResult:
    intent_summary: str
    sql: SafeSQL
    visualization: str
    raw_json: dict


def _catalog_hint() -> str:
    lines = ["TABLES:"]
    for t in TABLES[:8]:
        lines.append(f"  - {t.schema}.{t.table} ({t.rows_est}) — {t.description}")
    lines.append("COLUMNS (selected):")
    for c in COLUMNS[:12]:
        tag = " [PII-MASKED]" if c.sensitive else ""
        lines.append(f"  - {c.table}.{c.column} {c.dtype}{tag} — {c.description}")
    return "\n".join(lines)


def _template_sql(plan: Plan) -> str:
    if plan.metric == "score_psi":
        return textwrap.dedent("""
            SELECT week, psi FROM datascience.score_psi_weekly
            WHERE score_name = 'confidence_score'
            ORDER BY week
            LIMIT 52
        """).strip()
    if plan.metric == "decision_mix":
        return textwrap.dedent("""
            SELECT decision, COUNT(*) AS n
            FROM rds_cases_public.cases
            GROUP BY 1 ORDER BY 2 DESC
            LIMIT 100
        """).strip()
    if plan.metric == "red_flag_count":
        return textwrap.dedent("""
            SELECT pattern, COUNT(*) AS cases
            FROM datascience.red_flag_events
            GROUP BY 1 ORDER BY 2 DESC
            LIMIT 100
        """).strip()
    # default: confidence trend
    return textwrap.dedent("""
        SELECT DATE_TRUNC('week', received_at) AS week,
               AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT)) AS avg_confidence
        FROM rds_warehouse_public.facts
        WHERE name='confidence_score'
        GROUP BY 1 ORDER BY 1
        LIMIT 500
    """).strip()


def synthesize(intent: Intent, plan: Plan, filters_dict: dict) -> SynthResult:
    # Deterministic path when LLM is not available
    if openai_status() != "live":
        raw = _template_sql(plan)
        safe = ensure_safe(raw, default_limit=SETTINGS.default_query_limit)
        return SynthResult(
            intent_summary=plan.summary,
            sql=safe,
            visualization=plan.visualization,
            raw_json={"intent": plan.summary, "metric": plan.metric,
                      "segment": plan.segment, "time_grain": plan.time_grain,
                      "filters": filters_dict, "sql": safe.sql,
                      "visualization": plan.visualization, "_fallback": True},
        )

    # LLM path
    messages = [
        {"role": "system", "content": VIEW_GEN_SYSTEM},
        {"role": "user", "content": VIEW_GEN_USER_TEMPLATE.format(
            catalog=_catalog_hint(),
            filters=json.dumps(filters_dict, indent=2),
            request=intent.raw,
        )},
    ]
    text = chat_completion(messages, model=SETTINGS.openai_model_chat, temperature=0.1)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        log.warning("View generator: LLM returned non-JSON, using template fallback.")
        raw = _template_sql(plan)
        safe = ensure_safe(raw, default_limit=SETTINGS.default_query_limit)
        return SynthResult(plan.summary, safe, plan.visualization,
                           {"intent": plan.summary, "sql": safe.sql, "_fallback_reason":"bad_json"})

    sql_str = obj.get("sql", "")
    try:
        safe = ensure_safe(sql_str, default_limit=SETTINGS.default_query_limit)
    except SQLSafetyError as exc:
        log.warning("View generator: unsafe SQL rejected (%s), using template fallback.", exc)
        raw = _template_sql(plan)
        safe = ensure_safe(raw, default_limit=SETTINGS.default_query_limit)
        obj["_fallback_reason"] = f"unsafe_sql:{exc}"

    return SynthResult(
        intent_summary=obj.get("intent", plan.summary),
        sql=safe,
        visualization=obj.get("visualization", plan.visualization),
        raw_json=obj,
    )
