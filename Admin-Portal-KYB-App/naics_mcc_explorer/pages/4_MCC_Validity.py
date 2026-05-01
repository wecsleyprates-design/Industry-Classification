"""Page 4 — MCC Code Validity & Source Analysis with alternatives + SQL runner."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import platform_label, platform_color, CATCH_ALL_MCC, KNOWN_INVALID_MCC
from utils.validators import validate_mcc, STATUS_COLORS, STATUS_ICONS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import get_data, data_source_banner
from db.queries import load_mcc_lookup, _onboarded_cte

st.set_page_config(page_title="MCC Validity", page_icon="💳", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust    = filters["customer_id"]
f_client  = filters.get("client_name")
f_biz     = filters["business_id"]

st.markdown("# 💳 MCC Code Validity & Source Analysis")
st.markdown(
    "MCC (Merchant Category Code) is a 4-digit payment industry code. "
    "Worth AI generates it in one of two ways:\n\n"
    "- **`mcc_code_found`** — the AI reads the business name and description and picks the most fitting payment category code directly\n"
    "- **`mcc_code_from_naics`** — the system converts the business's NAICS industry code into a payment category code using an official mapping table\n\n"
    "The AI-assigned `mcc_code_found` takes priority. If no AI code exists, `mcc_code_from_naics` is used as the fallback. "
    "**If the NAICS code is missing or wrong, the `mcc_code_from_naics` will also be wrong.**"
)
platform_legend_panel()
data_source_banner()
st.markdown("---")

with st.spinner("Loading MCC facts…"):
    df = get_data('mcc_facts', date_from=f_from, date_to=f_to, customer_id=f_cust, client_name=f_client, business_id=f_biz)
with st.spinner("Loading MCC lookup…"):
    mcc_lookup = load_mcc_lookup()

if df.empty:
    no_data("No MCC facts found.")
    st.stop()

df["eff_pid"] = df.apply(
    lambda r: r["platform_id"] if str(r["platform_id"]) not in ("unknown","","None")
              else (r.get("legacy_source_name") or "unknown"), axis=1
).astype(str)
df["platform_name"] = df["eff_pid"].apply(platform_label)
df[["validity_status","validity_reason"]] = df["mcc_value"].apply(
    lambda v: pd.Series(validate_mcc(v, mcc_lookup))
)

def _alt_summary(raw):
    alts = parse_alternatives(raw)
    if not alts: return "", "", ""
    return (" | ".join(str(a["alt_value"]) for a in alts),
            " | ".join(a["alt_platform"] for a in alts),
            " | ".join(str(a["alt_confidence"]) for a in alts))

df[["alt_values","alt_platforms","alt_confidences"]] = df["raw_json"].apply(
    lambda r: pd.Series(_alt_summary(r))
)

mcc_final     = df[df["fact_name"]=="mcc_code"].copy()
mcc_found     = df[df["fact_name"]=="mcc_code_found"].copy()
mcc_fromnaics = df[df["fact_name"]=="mcc_code_from_naics"].copy()

total_biz  = df["business_id"].nunique()
n_final    = mcc_final["business_id"].nunique()
n_ai       = len(set(mcc_found["business_id"]) - set(mcc_fromnaics["business_id"]))
n_naics_d  = len(set(mcc_fromnaics["business_id"]) - set(mcc_found["business_id"]))
n_both     = len(set(mcc_found["business_id"]) & set(mcc_fromnaics["business_id"]))
n_neither  = total_biz - len(set(mcc_found["business_id"]) | set(mcc_fromnaics["business_id"]))

def sc(df_, k): return int(df_["validity_status"].value_counts().get(k, 0))
n_valid   = sc(mcc_final,"valid")
n_ca      = sc(mcc_final,"catch_all")
n_bad     = sc(mcc_final,"known_invalid")
n_not_lk  = sc(mcc_final,"not_in_lookup")
n_null    = sc(mcc_final,"null")
n_5614    = int((mcc_final["mcc_value"]=="5614").sum())

# ── KPIs ──────────────────────────────────────────────────────────────────────
section_header("📊 MCC Coverage & Validity")

c1,c2,c3,c4 = st.columns(4)
with c1: kpi("Businesses w/ mcc_code", f"{n_final:,}", f"of {total_biz:,} total", "#3b82f6")
with c2: kpi("mcc_code_found only",       f"{n_ai:,}",    "AI assigned the code directly", "#8b5cf6")
with c3: kpi("mcc_code_from_naics only", f"{n_naics_d:,}","Converted from NAICS industry code", "#6366f1")
with c4: kpi("Both Paths Ran",         f"{n_both:,}",  "AI + NAICS-derived",        "#22c55e")
st.markdown("")
c5,c6,c7,c8 = st.columns(4)
with c5: kpi("✅ Valid MCC",           f"{n_valid:,}",  f"{100*n_valid/n_final:.1f}%" if n_final else "", "#22c55e")
with c6: kpi("⚠️ Generic Fallback 7399", f"{n_ca:,}", f"{100*n_ca/n_final:.1f}% — no specific category found" if n_final else "", "#f59e0b")
with c7: kpi("❌ Invalid Code (5614)",  f"{n_5614:,}",  "Not a real payment category — AI error",    "#ef4444")
with c8: kpi("⬜ Null mcc_code",       f"{n_null:,}",  "No winning value",          "#64748b")

analyst_note(
    "Interpreting MCC coverage metrics",
    "The final `mcc_code` fact is produced in two independent ways and the best one wins. "
    "`mcc_code_found` (AI-assigned) takes priority; `mcc_code_from_naics` is the backup.",
    level="info",
    bullets=[
        "<strong>mcc_code_found only</strong>: the AI assigned the code directly — not affected by NAICS quality",
        "<strong>mcc_code_from_naics only</strong>: code came from converting the NAICS code — if NAICS is wrong, this code is wrong too",
        "<strong>Both ran</strong>: AI won (higher priority). mcc_code_from_naics stored as a backup reference",
        "<strong>Neither</strong>: business has no MCC at all — cannot be used in payment routing or risk rules",
        f"<strong>Code 5614 (AI error)</strong>: {n_5614:,} businesses received code 5614, which is not a valid payment category. The AI returns this as a last resort when it cannot identify the business type. These businesses need their payment category reassigned.",
    ],
)
st.markdown("---")

# ── Source donut + top MCC bar ────────────────────────────────────────────────
section_header("🥧 MCC Source Distribution + Top MCC Codes")
col_d, col_b = st.columns(2)

with col_d:
    src_df = pd.DataFrame({
        "Category":["mcc_code_found only","mcc_code_from_naics only","Both ran","No MCC"],
        "Count":   [n_ai, n_naics_d, n_both, n_neither],
        "Color":   ["#8b5cf6","#3b82f6","#22c55e","#64748b"],
    }).query("Count > 0")
    fig_d = go.Figure(go.Pie(
        labels=src_df["Category"], values=src_df["Count"],
        marker_colors=src_df["Color"].tolist(),
        textinfo="label+percent", hole=0.4,
        hovertemplate="<b>%{label}</b><br>Businesses: %{value:,}<extra></extra>",
    ))
    fig_d.update_layout(height=310, margin=dict(l=0,r=0,t=10,b=0),
                         paper_bgcolor="#0f172a", font_color="#cbd5e1", showlegend=False)
    st.plotly_chart(fig_d, use_container_width=True, key="mcc_src_donut")
    analyst_note(
        "What this donut reveals",
        "A large <strong>mcc_code_from_naics only</strong> slice means MCC quality is directly chained to NAICS quality. "
        "Every NAICS bug cascades into a wrong MCC. "
        "A large <strong>No MCC</strong> slice means those businesses are invisible to payment-level risk rules.",
        level="warning",
    )

with col_b:
    top_mcc = (mcc_final.groupby(["mcc_value","validity_status"]).size()
               .reset_index(name="count").sort_values("count",ascending=False).head(20))
    top_mcc["color"] = top_mcc["validity_status"].map(STATUS_COLORS)
    top_mcc["label"] = top_mcc["mcc_value"].fillna("null")
    top_mcc = top_mcc.sort_values("count", ascending=True)
    fig_t = go.Figure(go.Bar(
        x=top_mcc["count"], y=top_mcc["label"], orientation="h",
        marker_color=top_mcc["color"].tolist(),
        text=top_mcc["count"].apply(lambda v: f"{v:,}"), textposition="outside",
        hovertemplate="<b>MCC %{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_t.update_layout(title="Top 20 MCC codes (final mcc_code)",
                         height=380, margin=dict(l=0,r=50,t=30,b=0),
                         paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
                         xaxis=dict(showgrid=True, gridcolor="#1e293b"),
                         yaxis=dict(showgrid=False, type="category"))
    st.plotly_chart(fig_t, use_container_width=True, key="mcc_top20")
    st.caption("🟢 Valid  🟡 Generic fallback (7399 — no specific category)  🔴 Invalid code (5614 — AI error)  🔵 Not in reference table  ⚫ Missing")
    analyst_note(
        "Reading the Top MCC chart",
        "Codes should be specific industry codes (e.g. 8011=Physicians, 5812=Restaurants). "
        "<strong>7399</strong> (Business Services, Not Elsewhere Classified) is a generic fallback — it means no specific payment category was found. Businesses with this code cannot be accurately categorized for payment routing or risk decisioning. "
        "<strong>5614</strong> appearing frequently is a serious data quality issue — this code is not recognized by payment networks and was produced by an AI error.",
        level="info",
    )

sql_panel("MCC Facts Query",
          f"""{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT f.business_id, o.customer_id, f.name AS fact_name,
       JSON_EXTRACT_PATH_TEXT(f.value,'value') AS mcc_value,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS platform_id,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0') AS confidence,
       f.received_at
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name IN ('mcc_code','mcc_code_found','mcc_code_from_naics')
  AND LENGTH(f.value) < 60000
ORDER BY f.business_id, f.name""", key_suffix="mcc_facts")
st.markdown("---")

# ── 5614 callout ───────────────────────────────────────────────────────────────
if n_5614 > 0:
    st.error(f"🚨 **{n_5614:,} businesses have payment category code 5614** — this is not a valid code. The AI assigned it as a last resort when it could not identify the business type.", icon="🚨")
    analyst_note(
        "Why is code 5614 a problem?",
        "Code <strong>5614</strong> is not recognized by Visa, Mastercard, or any major payment network. "
        "It does not belong to any standard merchant category. The AI assigned it as a last resort when it "
        "could not determine what type of business it was looking at. "
        "Any business with this code will likely fail payment routing, interchange fee calculation, and risk scoring rules "
        "that rely on having a valid payment category.",
        level="danger",
        bullets=[
            f"{n_5614:,} businesses currently have this invalid code",
            "Root cause: the AI's fallback output is not a real payment category code",
            "Fix: re-run the AI classification for these businesses with an updated prompt",
        ],
        action="Re-run payment category classification for all businesses with code 5614.",
    )
    bug_df = mcc_final[mcc_final["mcc_value"]=="5614"][[
        "business_id","customer_id","platform_name","confidence","winner_updated_at","alt_values","alt_platforms"
    ]].copy()
    bug_df.columns = ["Business ID","Customer ID","Platform","Confidence","Last Updated","Alt MCC Values","Alt Platforms"]
    with st.expander(f"View {n_5614:,} businesses with invalid code 5614"):
        st.dataframe(bug_df, hide_index=True, use_container_width=True)
else:
    st.success("✅ No businesses with invalid code 5614 found in this selection.")
st.markdown("---")

# ── AI vs NAICS-derived confidence ────────────────────────────────────────────
section_header("📊 mcc_code_found vs mcc_code_from_naics — Score Comparison",
               "Compares the confidence distribution of the two MCC derivation paths")

if not mcc_found.empty and not mcc_fromnaics.empty:
    mcc_found["conf_f"]     = pd.to_numeric(mcc_found["confidence"], errors="coerce").fillna(0)
    mcc_fromnaics["conf_f"] = pd.to_numeric(mcc_fromnaics["confidence"], errors="coerce").fillna(0)

    # Summary stats
    ai_avg  = mcc_found["conf_f"].mean()
    nd_avg  = mcc_fromnaics["conf_f"].mean()
    ai_zero = int((mcc_found["conf_f"] == 0).sum())
    nd_zero = int((mcc_fromnaics["conf_f"] == 0).sum())

    c1, c2, c3, c4 = st.columns(4)
    with c1: kpi("AI Avg Confidence",    f"{ai_avg:.3f}", f"{len(mcc_found):,} records", "#8b5cf6")
    with c2: kpi("mcc_code_from_naics Avg", f"{nd_avg:.3f}", f"{len(mcc_fromnaics):,} records", "#3b82f6")
    with c3: kpi("AI Zero-Confidence",   f"{ai_zero:,}",  "records with conf=0", "#ef4444" if ai_zero>0 else "#22c55e")
    with c4: kpi("mcc_code_from_naics Zero", f"{nd_zero:,}", "records with score=0 (normal for lookup)", "#22c55e")

    analyst_note(
        "What the confidence scores mean for MCC",
        "<strong>mcc_code_found</strong> (AI-assigned) produces a confidence score showing how certain the AI was. "
        "A score near 1.0 means high certainty; near 0 means low certainty or no result. "
        "<strong>mcc_code_from_naics</strong> always shows a score of zero — this is expected and normal, "
        "because it is a direct table lookup (it converts a code mechanically, not a prediction).",
        level="info",
        bullets=[
            "Many mcc_code_found records at score 0 → the AI was uncertain or returned no result for those businesses",
            "mcc_code_from_naics at score 0 → correct behavior — the NAICS→MCC conversion table does not produce confidence scores",
            "Both averaging near 0.15 → the AI fallback (mcc_code_found) is running for most businesses because data vendors did not provide NAICS codes",
        ],
    )

    # Grouped bar: conf distribution
    bins = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1.01]
    labels = ["0","0–0.05","0.05–0.1","0.1–0.15","0.15–0.2","0.2–0.3","0.3–0.5","0.5–1.0"]
    ai_hist  = pd.cut(mcc_found["conf_f"], bins=bins, labels=labels[1:], right=False).value_counts().sort_index()
    nd_hist  = pd.cut(mcc_fromnaics["conf_f"], bins=bins, labels=labels[1:], right=False).value_counts().sort_index()

    fig_conf = go.Figure()
    fig_conf.add_trace(go.Bar(name="mcc_code_found (AI-assigned)",
                               x=ai_hist.index.astype(str), y=ai_hist.values, marker_color="#8b5cf6"))
    fig_conf.add_trace(go.Bar(name="mcc_code_from_naics (NAICS conversion)",
                               x=nd_hist.index.astype(str), y=nd_hist.values, marker_color="#3b82f6"))
    fig_conf.update_layout(
        barmode="group", height=300, margin=dict(l=0,r=0,t=10,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis_title="Confidence Range", yaxis_title="Record Count",
        legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")),
    )
    st.plotly_chart(fig_conf, use_container_width=True, key="mcc_conf_bar")
st.markdown("---")

# ── Full records table (mcc_final) with alternatives ──────────────────────────
section_header("📋 Final MCC Records — Winner + Alternatives")
display_f = mcc_final[[
    "business_id","customer_id","mcc_value","platform_name","confidence",
    "winner_updated_at","validity_status","validity_reason",
    "alt_values","alt_platforms","alt_confidences",
]].copy()
display_f.columns = [
    "Business ID","Customer ID","MCC (Winner)","Platform","Confidence",
    "Last Updated (source.updatedAt)","Status","Reason",
    "Alternative MCC Values","Alternative Platforms","Alt Confidences",
]
st.dataframe(display_f, use_container_width=True, hide_index=True,
             column_config={"Confidence": st.column_config.NumberColumn(format="%.3f"),
                            "Last Updated (source.updatedAt)": st.column_config.TextColumn()})
st.download_button("⬇️ Download CSV", display_f.to_csv(index=False).encode(),
                   "mcc_validity.csv","text/csv")
