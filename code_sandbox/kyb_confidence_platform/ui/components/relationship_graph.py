"""
Relationship graph renderer (Plotly scatter w/ lines).

Input: a list of node dicts {id, label, type, x, y} and link dicts {s, t, warn}.
"""
from __future__ import annotations

from typing import Iterable

import plotly.graph_objects as go


_COLORS = {
    "business-main": "#60A5FA",
    "business":      "#334155",
    "identifier":    "#f59e0b",
    "address":       "#22c55e",
    "person":        "#a855f7",
    "phone":         "#06b6d4",
}


def build(nodes: list[dict], links: list[dict]) -> go.Figure:
    by_id = {n["id"]: n for n in nodes}
    edge_x, edge_y = [], []
    for l in links:
        a, b = by_id.get(l["s"]), by_id.get(l["t"])
        if not a or not b:
            continue
        edge_x.extend([a["x"], b["x"], None])
        edge_y.extend([a["y"], b["y"], None])
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y, mode="lines",
        line=dict(color="#475569", width=1.5),
        hoverinfo="skip", showlegend=False,
    )

    node_trace = go.Scatter(
        x=[n["x"] for n in nodes],
        y=[n["y"] for n in nodes],
        mode="markers+text",
        marker=dict(
            color=[_COLORS.get(n.get("type","business"), "#334155") for n in nodes],
            size=[24 if n.get("type") == "business-main" else 16 for n in nodes],
            line=dict(color="#0F172A", width=2),
        ),
        text=[n["label"] for n in nodes],
        textposition="bottom center",
        textfont=dict(color="#F1F5F9", size=11),
        hoverinfo="text",
        showlegend=False,
    )

    fig = go.Figure([edge_trace, node_trace])
    fig.update_layout(
        template="plotly_dark",
        margin=dict(l=10, r=10, t=10, b=10),
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        height=380,
    )
    return fig


def default_demo() -> tuple[list[dict], list[dict]]:
    """Fallback demo dataset so the graph always renders something reasonable."""
    nodes = [
        {"id":"E1", "label":"Northgate Logistics LLC", "type":"business-main", "x": 0, "y": 0},
        {"id":"E2", "label":"Northgate Freight Inc.",  "type":"business",      "x":-2.5, "y": 1.6},
        {"id":"E3", "label":"Gate North Shipping",     "type":"business",      "x":-2.5, "y":-1.6},
        {"id":"E4", "label":"North Freight Holdings",  "type":"business",      "x": 2.5, "y": 1.6},
        {"id":"E5", "label":"NorthGate Distribution",  "type":"business",      "x": 2.5, "y":-1.6},
        {"id":"T1", "label":"EIN XX-4821",             "type":"identifier",    "x":-1.0, "y": 2.6},
        {"id":"A1", "label":"123 Dock St, Trenton NJ", "type":"address",       "x":-1.0, "y":-2.6},
        {"id":"U1", "label":"UBO: Rita Chen",          "type":"person",        "x": 1.0, "y": 2.6},
        {"id":"P1", "label":"Phone (***) ***-4420",    "type":"phone",         "x": 1.0, "y":-2.6},
    ]
    links = [
        {"s":"E1","t":"T1","warn":True}, {"s":"E2","t":"T1","warn":True},
        {"s":"E1","t":"A1","warn":False},{"s":"E3","t":"A1","warn":True},
        {"s":"E1","t":"U1","warn":False},{"s":"E4","t":"U1","warn":True},
        {"s":"E1","t":"P1","warn":False},{"s":"E5","t":"P1","warn":False},
    ]
    return nodes, links
