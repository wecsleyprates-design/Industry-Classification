"""Entry point — controls exactly which pages appear in the sidebar.

Uses st.navigation() to define the page list explicitly.
Only the pages passed to st.navigation() appear in the sidebar nav.
Pages not listed here are hidden (they still exist and can be reached
programmatically, but do not show as nav items).

Currently visible:
  Platform Winners, Fact Explorer, NAICS Validity, MCC Validity,
  Cascade Analysis, Business Drilldown

Hidden (accessible via direct URL but not in sidebar):
  Overview, Canonical Pairs, Customer Intelligence, Misidentification
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st

pg = st.navigation([
    st.Page("pages/1_Platform_Winners.py",  title="Platform Winners",  icon="🏆"),
    st.Page("pages/2_Fact_Explorer.py",     title="Fact Explorer",     icon="🔭"),
    st.Page("pages/3_NAICS_Validity.py",    title="NAICS Validity",    icon="🔢"),
    st.Page("pages/4_MCC_Validity.py",      title="MCC Validity",      icon="💳"),
    st.Page("pages/5_Cascade_Analysis.py",  title="Cascade Analysis",  icon="⛓️"),
    st.Page("pages/6_Business_Drilldown.py",title="Business Drilldown",icon="🔍"),
])

pg.run()
