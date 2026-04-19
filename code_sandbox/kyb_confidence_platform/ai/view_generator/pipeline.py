"""
End-to-end AI View Generator pipeline.

Steps:
  1. parse intent
  2. plan
  3. synthesize SQL (LLM or fallback)
  4. execute via Redshift (or fixtures in demo mode)
  5. render visualization
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from config.settings import SETTINGS
from core.logger import get_logger
from data_access.pii import mask_dataframe
from data_access.redshift import query as rs_query

from .intent import parse
from .planner import plan_from_intent
from .render import render as render_viz
from .sql_synth import synthesize, SynthResult

log = get_logger(__name__)


@dataclass
class GeneratedView:
    intent_summary: str
    sql: str
    sql_notes: list[str] = field(default_factory=list)
    visualization: str = "table"
    dataframe: pd.DataFrame | None = None
    figure: Any = None
    raw_envelope: dict = field(default_factory=dict)
    error: str | None = None


def generate_view(request: str, active_filters: dict | None = None) -> GeneratedView:
    filters = active_filters or {}
    intent = parse(request)
    plan = plan_from_intent(intent)
    synth: SynthResult = synthesize(intent, plan, filters)

    try:
        df = rs_query(synth.sql.sql)
    except Exception as exc:
        log.warning("View generator: execution failed (%s) — fallback to empty frame.", exc)
        df = pd.DataFrame()
        return GeneratedView(
            intent_summary=synth.intent_summary,
            sql=synth.sql.sql,
            sql_notes=list(synth.sql.warnings) + [f"execution_error:{exc}"],
            visualization=synth.visualization,
            dataframe=df,
            figure=None,
            raw_envelope=synth.raw_json,
            error=str(exc),
        )

    df = mask_dataframe(df)
    fig = render_viz(df, synth.visualization)

    return GeneratedView(
        intent_summary=synth.intent_summary,
        sql=synth.sql.sql,
        sql_notes=list(synth.sql.warnings),
        visualization=synth.visualization,
        dataframe=df,
        figure=fig,
        raw_envelope=synth.raw_json,
    )
