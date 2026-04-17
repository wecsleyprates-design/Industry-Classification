# KYB Hub Pro — Architecture & Design Document

## 1. Overview
The **KYB Hub Pro** is a next-generation Streamlit application designed to replace the existing `kyb_hub_app.py`. It serves the Data Science, Underwriting, and KYB operations teams. The core objective is to provide the same comprehensive per-business intelligence but with vastly improved UI/UX, richer analytics, and a powerful new **Check-Agent** capable of deep anomaly detection and cross-referencing.

## 2. Key Improvements over Legacy App
1. **Modernized UI/UX**: Moving away from long scrolling pages to a clean, tabbed interface with collapsible sidebars, distinct metric cards, and better use of Plotly for visualizations.
2. **The Check-Agent**: A new AI-powered module that doesn't just answer questions (like the old RAG agent) but actively *audits* the business. It cross-references SOS data, TIN data, Watchlists, and Financials to find contradictions (e.g., "Entity is active in TX but formed in DE, and TIN name doesn't match DBA").
3. **Data Connectors Tab**: A dedicated section allowing analysts to upload custom datasets (e.g., external watchlist CSVs, manual financial exports) to cross-reference against the Redshift warehouse data.
4. **Enhanced Analytics**: Better portfolio-level monitoring with date-range filters, cohort analysis, and clear pass/fail funnels for onboarding.

## 3. Application Architecture

### 3.1. Tech Stack
- **Frontend**: Streamlit (Python)
- **Visualizations**: Plotly Express & Graph Objects
- **Database**: Amazon Redshift (via `psycopg2` / `pandas`)
- **AI/LLM**: OpenAI GPT-4o (via `openai` python package)
- **Data Processing**: Pandas, NumPy

### 3.2. Core Modules
1. **`app_pro.py`**: The main entry point. Handles routing, session state, and layout.
2. **`db_connector.py`**: Handles all Redshift connections, connection pooling, and query execution with Streamlit caching (`@st.cache_data`).
3. **`queries.py`**: Centralizes all SQL queries (Portfolio stats, single business facts, score lookups).
4. **`check_agent.py`**: The brain of the new Check-Agent. Contains the logic to pull facts, feed them to the LLM with a strict prompt, and parse the anomaly report.
5. **`ui_components.py`**: Reusable UI elements (KPI cards, status badges, anomaly flags, dark-themed charts).

## 4. User Interface Layout

### Sidebar
- **Search & Navigation**: Search by Business ID (UUID).
- **Date Filters**: Global date range picker for portfolio views.
- **Navigation Menu**:
  - 📊 Portfolio Dashboard
  - 🏢 Business Investigation (Deep Dive)
  - 🤖 AI Check-Agent
  - 🔌 Data Connectors (New!)

### Tab 1: Portfolio Dashboard
- **Top KPIs**: Total Onboarded, Red Flags, SOS Pass Rate, TIN Pass Rate, IDV Pass Rate.
- **Charts**: 
  - Onboarding funnel (Submitted -> SOS Passed -> TIN Passed -> Approved).
  - Red flag distribution by type (Watchlist vs. Bankruptcies vs. SOS Inactive).
- **Recent Alerts Table**: Top 10 businesses needing immediate manual review based on risk score.

### Tab 2: Business Investigation
*Only visible when a Business ID is selected.*
- **Header**: Business Name, UUID, Overall Risk Status, Worth Score.
- **Sub-tabs**:
  - **Background & Registration**: Legal name, DBA, SOS status, Formation State vs. Operating State, TIN match.
  - **Financials & Score**: Revenue, Employees, Worth Score breakdown, Model probability.
  - **Risk & Watchlist**: Sanctions hits, PEP hits, Adverse Media, Bankruptcies, Liens.
  - **Contact & Web**: Address verification (USPS), deliverability, Website, AI NAICS enrichment.

### Tab 3: AI Check-Agent
*The crown jewel of the Pro app.*
- **One-Click Audit**: Analyst clicks "Run Full Audit" for a selected business.
- **Process**:
  1. Gathers all facts, alternatives, and scores from Redshift.
  2. Sends structured JSON to the LLM.
  3. LLM evaluates cross-field consistency (e.g., Revenue = $10M but Employees = 1; SOS active but TIN failed; Watchlist hit but low confidence).
- **Output**:
  - **Red Flags**: Critical blockers (e.g., Sanctions hit).
  - **Yellow Flags**: Discrepancies needing review (e.g., DE formation state but operating in CA).
  - **Green Flags**: Verified strong signals.
  - **Recommended Actions**: Clear next steps for the underwriter.

### Tab 4: Data Connectors
- File uploader for CSV/Excel.
- Allows users to map uploaded columns to Redshift schemas.
- Useful for cross-referencing a manual "Do Not Do Business With" list against the onboarded portfolio.

## 5. Security & Credentials
- Uses existing environment variables (`REDSHIFT_DB`, `REDSHIFT_USER`, `REDSHIFT_PASSWORD`, `REDSHIFT_HOST`, `REDSHIFT_PORT`).
- Uses `OPENAI_API_KEY` for the Check-Agent.
- Read-only access to Redshift (`readonly_all_access`).

## 6. Implementation Plan
1. Scaffold the Streamlit app structure and UI components.
2. Port and optimize Redshift connection and query logic from the legacy app.
3. Build the Portfolio Dashboard with Plotly charts.
4. Build the Business Investigation deep-dive views.
5. Develop the Check-Agent prompt engineering and integration.
6. Add the Data Connectors tab.
7. Final testing and styling polish.
