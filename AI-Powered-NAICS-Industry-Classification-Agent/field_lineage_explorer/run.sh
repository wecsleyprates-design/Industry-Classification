#!/bin/bash
# Run the Field Lineage Explorer
cd "$(dirname "$0")"
python3 -m streamlit run app.py --server.port 8501
