"""Entry point — immediately switches to the Home page.
This file is the Streamlit entry point (streamlit run app.py).
It is intentionally minimal so no sidebar entry appears for it.
All content lives in pages/0_Home.py and pages/1–7_*.py.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st

st.set_page_config(
    page_title="NAICS/MCC Quality Explorer",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)
# Redirect immediately to the Home page.
# This entry file (app.py) has no visible content so it won't show
# as a meaningful page in the sidebar — only the pages/ files appear.
st.switch_page("pages/0_🏠_Overview.py")
