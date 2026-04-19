"""Plotly chart helpers with a consistent dark theme."""
from __future__ import annotations

from typing import Iterable

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


_LAYOUT = {"template": "plotly_dark", "margin": dict(l=20, r=20, t=30, b=20)}


def line(df: pd.DataFrame, x: str, y: Iterable[str], *, title: str = "") -> go.Figure:
    fig = px.line(df, x=x, y=list(y), template="plotly_dark", title=title)
    fig.update_traces(mode="lines+markers")
    fig.update_layout(**_LAYOUT)
    return fig


def bar(df: pd.DataFrame, x: str, y: str, *, color: str | None = None,
        title: str = "", barmode: str = "group", horizontal: bool = False) -> go.Figure:
    if horizontal:
        fig = px.bar(df, x=y, y=x, color=color, orientation="h", template="plotly_dark", title=title, barmode=barmode)
    else:
        fig = px.bar(df, x=x, y=y, color=color, template="plotly_dark", title=title, barmode=barmode)
    fig.update_layout(**_LAYOUT)
    return fig


def donut(df: pd.DataFrame, labels: str, values: str, *, title: str = "") -> go.Figure:
    fig = px.pie(df, names=labels, values=values, template="plotly_dark", hole=0.5, title=title)
    fig.update_layout(**_LAYOUT)
    return fig


def histogram(df: pd.DataFrame, col: str, *, title: str = "") -> go.Figure:
    fig = px.histogram(df, x=col, template="plotly_dark", title=title)
    fig.update_layout(**_LAYOUT)
    return fig
