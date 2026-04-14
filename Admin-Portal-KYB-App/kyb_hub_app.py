"""
KYB Intelligence Hub — kyb_hub_app.py
Full per-business KYB investigation app.
Run: streamlit run kyb_hub_app.py
Set: export OPENAI_API_KEY=your-key
"""

import os, json, re, math
from datetime import datetime, timezone
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

st.set_page_config(page_title="KYB Intelligence Hub", page_icon="🔬", layout="wide")
BASE = Path(__file__).parent

st.markdown("# 🔬 KYB Intelligence Hub")
st.info("App file was cleaned during git history rewrite. Please run: git pull origin main && streamlit run kyb_hub_app.py")
st.markdown("The full app is being restored. Check Admin-Portal-KYB-App/kyb_hub_app.py after next push.")
