"""
Render the executed DataFrame into a Plotly figure appropriate for the visualization hint.
"""
from __future__ import annotations

from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def render(df: pd.DataFrame, visualization: str) -> Any:
    if df is None or df.empty:
        return go.Figure(layout={"title": "No rows returned", "template": "plotly_dark"})

    viz = (visualization or "table").lower()

    if viz == "kpi":
        # Assume first numeric column holds the KPI.
        numcols = df.select_dtypes(include="number").columns.tolist()
        if not numcols:
            return go.Figure(layout={"title": "No numeric column for KPI", "template": "plotly_dark"})
        val = float(df[numcols[0]].iloc[0])
        fig = go.Figure(go.Indicator(mode="number", value=val))
        fig.update_layout(template="plotly_dark")
        return fig

    if viz == "line":
        x = df.columns[0]
        ys = [c for c in df.columns[1:] if pd.api.types.is_numeric_dtype(df[c])]
        fig = px.line(df, x=x, y=ys, template="plotly_dark")
        return fig

    if viz in ("bar", "stacked_bar"):
        x = df.columns[0]
        ys = [c for c in df.columns[1:] if pd.api.types.is_numeric_dtype(df[c])]
        fig = px.bar(df, x=x, y=ys, barmode="stack" if viz == "stacked_bar" else "group", template="plotly_dark")
        return fig

    if viz == "histogram":
        col = df.select_dtypes(include="number").columns[0]
        fig = px.histogram(df, x=col, template="plotly_dark")
        return fig

    if viz == "pie":
        labels = df.columns[0]; values = df.columns[1]
        fig = px.pie(df, names=labels, values=values, template="plotly_dark", hole=0.4)
        return fig

    if viz == "heatmap":
        fig = px.density_heatmap(df, x=df.columns[0], y=df.columns[1],
                                 z=df.columns[2] if len(df.columns) > 2 else None,
                                 template="plotly_dark")
        return fig

    # Default: nothing fancy, rely on the caller to render df as a table.
    return None
