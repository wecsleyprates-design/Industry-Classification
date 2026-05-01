"""Entry point — controls exactly which pages appear in the sidebar."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st

pg = st.navigation([
    st.Page("pages/0_How_It_Works.py",          title="How It Works",          icon="📐"),
    st.Page("pages/1_Platform_Winners.py",      title="Platform Winners",      icon="🏆"),
    st.Page("pages/2_Fact_Explorer.py",         title="Fact Explorer",         icon="🔭"),
    st.Page("pages/3_NAICS_Validity.py",        title="NAICS Validity",        icon="🔢"),
    st.Page("pages/4_MCC_Validity.py",          title="MCC Validity",          icon="💳"),
    st.Page("pages/5_Cascade_Analysis.py",      title="Cascade Analysis",      icon="⛓️"),
    st.Page("pages/6_Business_Drilldown.py",    title="Business Drilldown",    icon="🔍"),
    st.Page("pages/8_Customer_Intelligence.py", title="Customer Intelligence", icon="👥"),
    st.Page("pages/9_Misidentification.py",     title="Misidentification",     icon="🎯"),
])

pg.run()
