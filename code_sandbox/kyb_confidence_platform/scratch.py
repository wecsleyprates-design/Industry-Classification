import streamlit as st

st.set_page_config(layout="wide")

st.markdown("""
<style>
.kyb-kpi {
    background: #1E293B; border-radius: 10px; padding: 12px 16px;
    border-left: 4px solid #3B82F6; margin-bottom: 6px;
    color: white;
    height: 100px;
}
</style>
<div class='kyb-kpi'>
    <div style='font-size: 12px;'>TOTAL KYB CASES</div>
    <div style='font-size: 24px; font-weight: bold;'>24,716</div>
</div>
""", unsafe_allow_html=True)

st.markdown("<span class='hook'></span>", unsafe_allow_html=True)

st.markdown("""
<style>
div[data-testid="stVerticalBlock"] > div:has(.hook) + div {
    margin-top: -95px;
    margin-bottom: 55px;
    width: 120px;
    float: right;
    margin-right: 15px;
    position: relative;
    z-index: 10;
}
</style>
""", unsafe_allow_html=True)

c1, c2, c3 = st.columns(3)
with c1: st.button("🪄", help="Ask AI")
with c2: st.button("🛡", help="Check-Agent")
with c3: st.button("🌳", help="Lineage")

