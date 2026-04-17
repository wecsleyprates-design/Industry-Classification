# KYB Hub Pro — Next-Generation KYB Intelligence Platform

**Version 2.0** | Built by Team B Data Science

## Overview

KYB Hub Pro is a comprehensive KYB (Know Your Business) intelligence dashboard that provides real-time portfolio monitoring, deep business investigation, AI-powered anomaly detection, and external data cross-referencing. It is a complete redesign and enhancement of the original `kyb_hub_app.py`.

## Architecture

```
kyb_hub_pro/
├── app_pro.py              # Main Streamlit application (routing, pages, rendering)
├── db_connector.py         # Redshift connection, queries, caching layer
├── ui_components.py        # Reusable UI components (KPI cards, badges, charts)
├── check_agent.py          # AI Check-Agent (deterministic + LLM-based auditing)
├── analytics_engine.py     # Anomaly scoring, entity comparison, trend analysis
├── .streamlit/
│   └── config.toml         # Streamlit theme configuration (dark mode)
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## Key Features

### 1. Portfolio Dashboard
- Real-time KPI cards: total businesses, onboarding volume, SOS pass rate, TIN pass rate
- Interactive Plotly charts: onboarding trends, risk distribution, score distribution
- Filterable business portfolio table with search
- Date range filtering

### 2. Business Investigation
Deep-dive into any business entity with 5 sub-tabs:

| Sub-Tab | Content |
|---------|---------|
| **Background** | Legal name, DBA, formation state/date, entity type, NAICS/MCC, SOS status, TIN match |
| **Financials & Score** | Worth Score gauge, risk level, score factors, revenue, employees, bankruptcies, liens |
| **Risk & Watchlist** | Watchlist hits, adverse media, PEP screening, sanctions, compliance flags |
| **Contact & Web** | Primary address, USPS deliverability, registered agent check, website analysis |
| **Fact Explorer** | Browse all 80+ facts grouped by category, with vendor attribution and confidence |

### 3. AI Check-Agent (NEW)
Three-layer anomaly detection system:

- **Multi-Dimensional Anomaly Scorer**: Radar chart across 6 dimensions (Identity, Financial, Compliance, Data Quality, Consistency, External) with weighted composite score
- **Deterministic Cross-Field Checks**: 14 rule-based checks that run instantly (no AI needed)
- **AI Deep Audit**: GPT-4.1-mini powered comprehensive compliance analysis with structured findings
- **External Data Check**: AI-recommended external verification sources
- **AI Chat Agent**: Conversational interface to ask questions about any business

### 4. Data Connectors (NEW)
- Upload CSV/Excel datasets for cross-referencing
- Map uploaded columns to KYB data fields
- Automatic discrepancy detection
- Downloadable results

## Improvements Over Original App

| Feature | Original (`kyb_hub_app.py`) | KYB Hub Pro |
|---------|---------------------------|-------------|
| UI Theme | Light, basic Streamlit | Dark professional theme with custom CSS |
| Navigation | Tab-based (flat) | Sidebar radio with clear sections |
| KPI Cards | Basic `st.metric` | Custom gradient cards with icons |
| Charts | Matplotlib/basic | Interactive Plotly with dark theme |
| Anomaly Detection | Manual flag counting | 6-dimension radar scorer + 14 deterministic rules |
| AI Agent | Simple Q&A | Full audit + external check + chat |
| Data Upload | None | CSV/Excel cross-referencing |
| Entity Comparison | None | Side-by-side comparison engine |
| Vendor Attribution | Basic PID display | Color-coded vendor pills with 20-vendor registry |
| Error Handling | Basic try/except | Graceful degradation with user-friendly messages |

## Setup & Running

### Prerequisites
- Python 3.10+
- Access to WorthAI Redshift cluster (VPN/VPC required)
- OpenAI API key

### Installation
```bash
pip install -r requirements.txt
```

### Running
```bash
streamlit run app_pro.py --server.port 8501
```

### Environment Variables (Optional)
The app has built-in defaults but supports environment variable overrides:

```bash
export REDSHIFT_HOST="your-redshift-endpoint"
export REDSHIFT_USER="your-user"
export REDSHIFT_PASSWORD="your-password"
export REDSHIFT_DB="dev"
export REDSHIFT_PORT="5439"
export OPENAI_API_KEY="sk-..."
```

## Data Sources

The app reads from the following Redshift schemas:

| Schema | Tables | Purpose |
|--------|--------|---------|
| `rds_warehouse_public` | `facts` | All KYB facts (80+ fields per business) |
| `rds_manual_score_public` | `data_current_scores`, `business_scores`, `score_factors` | Worth Score and risk assessment |
| `rds_case_public` | `data_onboarding_counts` | Onboarding volume metrics |

## AI Check-Agent Details

### Deterministic Checks (14 rules)
1. SOS Inactive — entity not in good standing
2. TIN Mismatch — EIN verification failed
3. IDV Failed — owner identity not verified
4. SOS Active + TIN Failed — cross-field inconsistency
5. SOS Inactive + TIN Passed — dissolved entity anomaly
6. Revenue/Employee Ratio — shell entity detection
7. Bankruptcy on Record — financial risk flag
8. Watchlist Hit — sanctions/PEP screening
9. Adverse Media — negative news detection
10. Registered Agent Address — address risk
11. Tax Haven Formation — DE/NV/WY formation state
12. NAICS Fallback Code — industry unknown
13. Low Data Fill Rate — incomplete KYB data
14. Score vs SOS Mismatch — model input anomaly

### AI Audit Dimensions
- **Identity**: SOS, TIN, name match verification
- **Financial**: Revenue/employee ratio, bankruptcies, liens
- **Compliance**: Watchlist, sanctions, PEP, adverse media
- **Data Quality**: Fill rate, missing critical fields
- **Consistency**: Cross-field logical checks
- **External**: Formation state, registered agent, website status

## License

Internal use only — WorthAI proprietary.
