"""
Build a Google-Docs-compatible .docx Worthopedia.

Principles:
- NO complex CSS / HTML — uses only Word paragraph styles
- Tables with explicit column widths and light fills (not dark headers that paste as black)
- Code blocks as shaded 1-cell tables with Courier New
- Callouts / warning boxes as shaded 1-cell tables with a left border
- All inline colour via RGBColor on Run objects (survives Google Docs import)
"""

from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os

doc = Document()

# ── Page margins ──────────────────────────────────────────────────────────────
s = doc.sections[0]
s.page_width   = Inches(8.5)
s.page_height  = Inches(11)
s.left_margin  = Inches(1.0)
s.right_margin = Inches(1.0)
s.top_margin   = Inches(0.8)
s.bottom_margin= Inches(0.8)

# ── Colour palette ────────────────────────────────────────────────────────────
PURPLE = RGBColor(0x5B, 0x21, 0xB6)
BLUE   = RGBColor(0x1E, 0x40, 0xAF)
GREEN  = RGBColor(0x06, 0x5F, 0x46)
RED    = RGBColor(0x99, 0x1B, 0x1B)
AMBER  = RGBColor(0x78, 0x35, 0x00)
SLATE  = RGBColor(0x33, 0x41, 0x55)
DARK   = RGBColor(0x0F, 0x17, 0x2A)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
LTBLUE = RGBColor(0x1D, 0x4E, 0xD8)

# ── Low-level helpers ─────────────────────────────────────────────────────────

def _shade(cell, hex6: str):
    """Fill cell background with a solid hex colour (e.g. 'EFF6FF')."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex6)
    tcPr.append(shd)


def _left_border(cell, hex6: str, sz: int = 24):
    """Add a thick left border to a cell."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    b = OxmlElement('w:left')
    b.set(qn('w:val'), 'single')
    b.set(qn('w:sz'), str(sz))
    b.set(qn('w:space'), '0')
    b.set(qn('w:color'), hex6)
    tcBorders.append(b)
    tcPr.append(tcBorders)


def _cell_margins(cell, top=40, right=80, bottom=40, left=80):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for side, val in [('top', top), ('right', right), ('bottom', bottom), ('left', left)]:
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:w'), str(val))
        el.set(qn('w:type'), 'dxa')
        tcMar.append(el)
    tcPr.append(tcMar)


def _remove_table_border(tbl):
    """Remove all outer/inner borders from a table."""
    tblPr = tbl._tbl.tblPr
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr')
        tbl._tbl.insert(0, tblPr)
    tblBorders = OxmlElement('w:tblBorders')
    for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        b = OxmlElement(f'w:{side}')
        b.set(qn('w:val'), 'none')
        tblBorders.append(b)
    tblPr.append(tblBorders)


# ── High-level builder helpers ────────────────────────────────────────────────

PAGE_WIDTH_IN = 6.5  # printable width in inches (8.5 - 2 * margins)


def spacer(pts=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after  = Pt(pts)


def heading1(text, colour=PURPLE, page_break=False):
    if page_break:
        doc.add_page_break()
    p = doc.add_paragraph()
    p.style = doc.styles['Heading 1']
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after  = Pt(6)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = colour


def heading2(text, colour=BLUE):
    p = doc.add_paragraph()
    p.style = doc.styles['Heading 2']
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(4)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = colour


def heading3(text, colour=SLATE):
    p = doc.add_paragraph()
    p.style = doc.styles['Heading 3']
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(3)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = colour


def body(text, size=10.5, colour=SLATE, space_after=5):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.size  = Pt(size)
    r.font.color.rgb = colour
    p.paragraph_format.space_after  = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    return p


def bullet(prefix: str, text: str, bold_prefix=True, size=10.5, level=0):
    style = 'List Bullet' if level == 0 else 'List Bullet 2'
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after  = Pt(2)
    p.paragraph_format.space_before = Pt(0)
    if prefix:
        rb = p.add_run(prefix)
        rb.bold = bold_prefix
        rb.font.size  = Pt(size)
        rb.font.color.rgb = DARK
    r = p.add_run(text)
    r.font.size  = Pt(size)
    r.font.color.rgb = SLATE


def code_block(lines: list, size=9):
    """Render a code block as a shaded 1-cell borderless table."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    _remove_table_border(tbl)
    cell = tbl.rows[0].cells[0]
    _shade(cell, 'F1F5F9')
    cell.width = Inches(PAGE_WIDTH_IN)
    _cell_margins(cell, top=60, right=100, bottom=60, left=100)
    first = True
    for line in lines:
        if first:
            cp = cell.paragraphs[0]
            first = False
        else:
            cp = cell.add_paragraph()
        cp.paragraph_format.space_before = Pt(0)
        cp.paragraph_format.space_after  = Pt(0)
        r = cp.add_run(line)
        r.font.name  = 'Courier New'
        r.font.size  = Pt(size)
        r.font.color.rgb = DARK
    spacer(4)


def callout(text: str, bg='EFF6FF', border='1D4ED8', text_colour=None):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    _remove_table_border(tbl)
    cell = tbl.rows[0].cells[0]
    _shade(cell, bg)
    _left_border(cell, border, sz=24)
    cell.width = Inches(PAGE_WIDTH_IN)
    _cell_margins(cell, top=60, right=100, bottom=60, left=140)
    cp = cell.paragraphs[0]
    cp.paragraph_format.space_before = Pt(0)
    cp.paragraph_format.space_after  = Pt(0)
    r = cp.add_run(text)
    r.font.size = Pt(10)
    r.font.color.rgb = text_colour or RGBColor.from_string(border)
    spacer(6)


def warning(text: str):
    callout(text, bg='FFFBEB', border='D97706',
            text_colour=RGBColor(0x78, 0x35, 0x00))


def gap_box(text: str):
    callout(text, bg='FEE2E2', border='DC2626',
            text_colour=RGBColor(0x7F, 0x1D, 0x1D))


def info_table(rows_data, col_widths=None, header_bg='DBEAFE', header_fg=DARK):
    """
    A labelled key→value table with light-blue header row.
    rows_data = list of (key, value) tuples.
    """
    tbl = doc.add_table(rows=len(rows_data), cols=2)
    tbl.style = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    if not col_widths:
        col_widths = [1.6, 4.9]
    for ri, (k, v) in enumerate(rows_data):
        left  = tbl.rows[ri].cells[0]
        right = tbl.rows[ri].cells[1]
        if ri == 0:
            _shade(left,  header_bg)
            _shade(right, header_bg)
        elif ri % 2 == 1:
            _shade(left,  'F8FAFF')
            _shade(right, 'F8FAFF')
        _cell_margins(left)
        _cell_margins(right)
        left.width  = Inches(col_widths[0])
        right.width = Inches(col_widths[1])
        lp = left.paragraphs[0]
        rk = lp.add_run(k)
        rk.bold = True
        rk.font.size = Pt(9.5)
        rk.font.color.rgb = DARK if ri == 0 else SLATE

        rp = right.paragraphs[0]
        rv = rp.add_run(v)
        rv.font.size = Pt(9.5)
        rv.font.color.rgb = DARK if ri == 0 else SLATE
    spacer(8)


def data_table(headers, rows, col_widths=None):
    """
    Multi-column table with a light blue header row.
    Alternating light-grey data rows.
    Values starting with YES/NO/WARN get coloured automatically.
    """
    ncols = len(headers)
    tbl   = doc.add_table(rows=1, cols=ncols)
    tbl.style  = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT

    # header
    hrow = tbl.rows[0]
    for ci, h in enumerate(headers):
        cell = hrow.cells[ci]
        _shade(cell, 'DBEAFE')
        _cell_margins(cell)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = DARK

    # data rows
    for ri, row_data in enumerate(rows):
        row = tbl.add_row()
        for ci, val in enumerate(row_data):
            cell = row.cells[ci]
            if ri % 2 == 1:
                _shade(cell, 'F8FAFF')
            _cell_margins(cell)
            p = cell.paragraphs[0]
            # colour coding
            v = str(val)
            if v.startswith('YES') or v.startswith('✅'):
                rgb = GREEN
                bold = True
            elif v.startswith('NO') or v.startswith('❌'):
                rgb = RED
                bold = True
            elif v.startswith('WARN') or v.startswith('⚠️'):
                rgb = AMBER
                bold = True
            else:
                rgb = SLATE
                bold = False
            r = p.add_run(v)
            r.font.size  = Pt(9.5)
            r.font.color.rgb = rgb
            r.bold = bold

    # column widths
    if col_widths:
        for ri2 in range(len(tbl.rows)):
            for ci2, w in enumerate(col_widths):
                tbl.rows[ri2].cells[ci2].width = Inches(w)
    spacer(8)


# ═════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ═════════════════════════════════════════════════════════════════════════════

spacer(24)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Industry Classification Facts')
r.bold = True
r.font.size = Pt(26)
r.font.color.rgb = PURPLE
p.paragraph_format.space_after = Pt(4)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Complete End-to-End Reference')
r.bold = True
r.font.size = Pt(16)
r.font.color.rgb = BLUE
p.paragraph_format.space_after = Pt(16)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run(
    'A step-by-step guide to how Worth AI classifies businesses into industries — '
    'where the data comes from, how the rules work, and what customers see.'
)
r.font.size = Pt(11)
r.font.color.rgb = SLATE
p.paragraph_format.space_after = Pt(8)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run(
    'Content verified against: SIC-UK-Codes (warehouse-service, integration-service, '
    'case-service) and Entity-Matching source code'
)
r.font.size = Pt(9)
r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
p.paragraph_format.space_after = Pt(24)

heading2('Document Contents')
data_table(
    ['Tab', 'Section Name', 'What it covers'],
    [
        ['Tab 1', 'Overview & Goals',
         'The two pipelines, what they do, what customers see'],
        ['Tab 2', 'Full Timeline',
         'Day 0 to business submitted to fact delivered — step by step'],
        ['Tab 3', 'Pipeline B — Batch Redshift',
         'XGBoost entity matching, winner-takes-all SQL rule, gaps'],
        ['Tab 4', 'Pipeline A — Real-Time Fact Engine',
         '6 sources, 6 winner rules, AI enrichment, all scenarios'],
        ['Tab 5', 'The 8 Classification Facts',
         'Every fact: source, JSONB payload, storage, queries'],
        ['Tab 6', 'API & Storage Reference',
         'Endpoints, Kafka events, Redshift queries'],
    ],
    col_widths=[0.7, 1.8, 4.0],
)

doc.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# TAB 1 — OVERVIEW
# ═════════════════════════════════════════════════════════════════════════════

heading1('Tab 1 — Overview: The Two Pipelines', colour=PURPLE)

callout(
    'Worth AI runs TWO completely separate pipelines for industry classification. '
    'They share some input data but have different goals, logic, outputs, and audiences. '
    'The customer ONLY ever sees Pipeline A output. Pipeline B is internal-only.'
)

heading2('Pipeline A — Integration Service (Real-Time)')
data_table(
    ['Attribute', 'Detail'],
    [
        ['Goal',
         'Deliver the best possible industry classification to the customer in real time, '
         'using ALL available sources.'],
        ['Runs when',
         'Every time a business is submitted — real-time, per business.'],
        ['Sources',
         'ZoomInfo, Equifax, OpenCorporates, Middesk, Trulioo, AI/GPT (6+ sources)'],
        ['Confidence method',
         'XGBoost model (most sources) + task-based (Middesk) + '
         'heuristic similarity_index/55 (Trulioo fallback)'],
        ['Output table',
         'rds_warehouse_public.facts — JSONB key-value, 217 facts total'],
        ['Customer sees?',
         'YES — REST API, Worth 360 Report, Worth AI UI'],
    ],
    col_widths=[1.6, 4.9],
)

heading2('Pipeline B — Warehouse Service (Batch Redshift)')
data_table(
    ['Attribute', 'Detail'],
    [
        ['Goal',
         'Build a wide denormalized analytics table in Redshift for risk scoring, '
         'model training, and bulk data exports.'],
        ['Runs when',
         'Scheduled batch job — not triggered by each business submission.'],
        ['Sources',
         'ZoomInfo + Equifax ONLY (historical design limitation — see Tab 3)'],
        ['Confidence method',
         'XGBoost entity matching model (zi_probability, efx_probability) '
         '+ heuristic similarity_index/55 fallback'],
        ['Output table',
         'datascience.customer_files — wide denormalized table'],
        ['Customer sees?',
         'NO — internal Redshift analytics, not exposed via any API'],
        ['Internal use',
         'Risk model training, data exports, analytics dashboards'],
    ],
    col_widths=[1.6, 4.9],
)

heading2('How Confidence Is Computed per Source (Pipeline A)')
data_table(
    ['Source', 'Confidence method', 'Platform ID'],
    [
        ['OpenCorporates', 'XGBoost oc_probability from ml_model_matches', '23'],
        ['Equifax', 'XGBoost efx_probability from ml_model_matches', '17'],
        ['ZoomInfo', 'XGBoost zi_probability OR similarity_index/55 fallback', '24'],
        ['Middesk', 'XGBoost confidenceScoreMany() OR 0.15 + 0.20 per passing task', '16'],
        ['Trulioo', 'Heuristic ONLY: match.index / 55 (MAX_CONFIDENCE_INDEX)', '38'],
        ['AI (GPT-5-mini)', 'Self-reported: HIGH~0.70 / MED~0.50 / LOW~0.30', '31'],
    ],
    col_widths=[1.5, 3.6, 1.4],
)

callout(
    'GET /facts/business/{id}/details returns source.confidence for all 6 sources. '
    'For OC, ZI, and EFX this is the XGBoost entity-matching probability. '
    'For Trulioo it is purely heuristic. For AI it is GPT self-reported.',
    bg='F0FDF4', border='059669',
)

heading2('When Pipeline A and Pipeline B Show Different NAICS')
callout(
    'Both pipelines can assign different NAICS codes for the same business. '
    'Pipeline A includes OC, Middesk, and AI — if any of them produced a '
    'better match, the API response will differ from the Redshift analytics table. '
    'This is most common for non-US companies (OC excels here) and recently '
    'registered businesses (Middesk SOS data is more current than ZI/EFX bulk files).'
)

doc.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# TAB 2 — FULL TIMELINE
# ═════════════════════════════════════════════════════════════════════════════

heading1('Tab 2 — Full Timeline: Day 0 to Fact Delivery', colour=PURPLE)

callout(
    'This section tells the complete story of how an industry classification '
    'fact goes from raw vendor data loaded into Redshift all the way to a '
    'customer API response — step by step.'
)

heading2('Step 1: Loading Vendor Data into Redshift (Day 0, Offline)')
body(
    'Before any business is submitted, the data engineering team loads bulk data '
    'from vendors. This is offline, scheduled work.'
)
data_table(
    ['Vendor', 'Redshift table', 'Key industry column', 'Cadence'],
    [
        ['ZoomInfo',
         'zoominfo.comp_standard_global\n→ datascience.zoominfo_standard_ml_2',
         'zi_c_naics6 (6-digit NAICS)',
         'Regular bulk ingestion'],
        ['Equifax',
         'warehouse.equifax_us_latest\n→ warehouse.equifax_us_standardized',
         'efx_primnaicscode (6-digit NAICS)\nefx_primsic (4-digit SIC)',
         'WARN: Unknown cadence — documented weakness'],
        ['OpenCorporates',
         'datascience.open_corporates_standard_ml_2',
         'industry_code_uids (pipe-delimited:\nus_naics-541110|gb_sic-62012)',
         'Regular bulk ingestion'],
        ['Liberty',
         'dev.liberty.einmst_20260218',
         'NAICS, SIC columns',
         'Bulk ingestion'],
    ],
    col_widths=[1.1, 2.1, 2.0, 1.3],
)

heading2('Step 2: Building Heuristic Similarity Tables (Pipeline B)')
body(
    'Before the XGBoost model runs, Worth AI scores candidate vendor records '
    'for each business using Levenshtein string distance.'
)
heading3('What similarity_index means')
code_block([
    'similarity_index =',
    '    (20 - levenshtein(company_name_submitted, vendor_name))   <- max 20',
    '  + (20 - levenshtein(address_submitted, vendor_address))     <- max 20',
    '  + state_match    (1 if state matches, else 0)',
    '  + city_match     (1 if city matches, else 0)',
    '  + zipcode_match  (1 if ZIP matches, else 0)',
    '',
    'Maximum achievable: ~43-45',
    'MAX_CONFIDENCE_INDEX = 55   (sources.ts in integration-service)',
    'Normalised confidence  = similarity_index / 55',
    'Minimum threshold kept: similarity_index >= 45  (= 0.82 confidence)',
])
body(
    'Output tables: smb_zoominfo_standardized_joined, smb_equifax_standardized_joined, '
    'smb_open_corporate_standardized_joined — top 1,000 candidate matches per business, '
    'ranked by similarity_index.'
)

heading2('Step 3: XGBoost Entity Matching Model Runs (Pipeline B)')
callout(
    '"Is this submitted business the same real-world entity as this vendor record?"  '
    '— This is the question the XGBoost model answers for every candidate pair.'
)
body('Model: entity_matching_20250127 v1.  33 pairwise features per candidate pair:')
bullet('', 'Jaccard k-gram similarities on business name (k=1,2,3,4 and word-level)', bold_prefix=False)
bullet('', 'Jaccard k-gram similarities on street name and short name (city-stripped)', bold_prefix=False)
bullet('', 'Exact match flags: city, ZIP, street number, address line 2', bold_prefix=False)
bullet('', 'Street number distance: |submitted_num - vendor_num|', bold_prefix=False)
bullet('', 'Block-level match: submitted_num // 100 == vendor_num // 100', bold_prefix=False)
spacer(4)
body('Output written to datascience.ml_model_matches:')
data_table(
    ['Column', 'Meaning'],
    [
        ['zi_probability',
         'Probability (0–1) that matched ZoomInfo record is the same business'],
        ['efx_probability',
         'Probability (0–1) that matched Equifax record is the same business'],
        ['oc_probability',
         'Probability (0–1) that matched OC record is the same business'],
    ],
    col_widths=[2.0, 4.5],
)

heading2('Step 4: Building zi_match_confidence and efx_match_confidence (Pipeline B)')
body(
    'smb_zi_oc_efx_combined.sql builds the final confidence scores used in '
    'customer_table.sql. XGBoost score takes priority; heuristic is the fallback:'
)
code_block([
    '-- ZoomInfo combined confidence:',
    'zi_match_confidence =',
    '  CASE',
    '    WHEN zi_probability   IS NOT NULL  THEN zi_probability',
    '    WHEN similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0',
    '    ELSE 0',
    '  END',
    '',
    '-- Equifax combined confidence (same pattern):',
    'efx_match_confidence =',
    '  CASE',
    '    WHEN efx_probability  IS NOT NULL  THEN efx_probability',
    '    WHEN similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0',
    '    ELSE 0',
    '  END',
])

heading2('Step 5: Winner-Takes-All SQL Rule (Pipeline B)')
body(
    'sp_recreate_customer_files() runs customer_table.sql. '
    'This single comparison controls every firmographic field in customer_files:'
)
code_block([
    '-- From customer_table.sql (actual production SQL):',
    'WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)',
    '  THEN zi_c_naics6           -- ZoomInfo NAICS + ALL ZI firmographic fields',
    'ELSE efx_primnaicscode        -- Equifax NAICS + ALL EFX firmographic fields',
    '',
    '-- The SAME comparison controls: NAICS, employee count, revenue,',
    '-- company name, address, city, ZIP, website URL — everything.',
])

heading2('Step 6: Business Submitted (Pipeline A — Real-Time)')
body(
    'A customer calls POST /businesses/customers/{customerID}. '
    'Worth AI creates a business_id (UUID) and triggers the integration-service pipeline. '
    'The central store for all live API responses is integration_data.request_response:'
)
data_table(
    ['Column', 'What it stores'],
    [
        ['request_id',  'UUID for this API call'],
        ['platform_id',
         '16=Middesk  17=Equifax  22=SERP  23=OC  24=ZoomInfo  31=AI  38=Trulioo'],
        ['business_id', 'The submitted business UUID'],
        ['response',    'JSONB — raw API response from the vendor'],
        ['confidence',
         'Computed score for this response (XGBoost / task-based / GPT-reported)'],
        ['request_type', 'e.g. perform_business_enrichment'],
    ],
    col_widths=[1.5, 5.0],
)

heading2('Step 7: Fact Engine Selects Winner, Publishes to Kafka')
body(
    'After all 6 sources respond, the Fact Engine runs the 6 winner-selection rules '
    '(see Tab 4) and publishes to Kafka topic facts.v1.'
)
body('Key Kafka events in order:')
bullet('CALCULATE_BUSINESS_FACTS', ' — initial fact calculation for all 217 facts')
bullet('UPDATE_NAICS_CODE', ' — case-service updates data_businesses.naics_id FK')
bullet('PROCESS_COMPLETION_FACTS', ' — final recalculation with full context')
spacer(4)
body('The warehouse-service FactService.consume() upserts the winner into:')
bullet('rds_warehouse_public.facts', ' — JSONB key-value, one row per fact per business')
bullet('rds_cases_public.data_businesses', ' — naics_id / mcc_id / industry (FK IDs)')

doc.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# TAB 3 — PIPELINE B DEEP DIVE
# ═════════════════════════════════════════════════════════════════════════════

heading1('Tab 3 — Pipeline B: Batch Redshift (Deep Dive)', colour=PURPLE)

heading2('Why Only ZoomInfo and Equifax?')
callout(
    'This is a historical design limitation, not a technical impossibility. '
    'Pipeline B was built when only ZoomInfo and Equifax had pre-loaded Redshift '
    'tables with clean numeric NAICS fields. OC, Liberty, Middesk, and Trulioo '
    'were added to Pipeline A later and were never backfilled into Pipeline B.'
)
data_table(
    ['Source', 'XGBoost score exists?', 'NAICS in Redshift?', 'In Pipeline B?', 'Why excluded'],
    [
        ['OpenCorporates',
         'YES — oc_probability',
         'YES — industry_code_uids',
         'NO',
         'industry_code_uids is a pipe-delimited string never parsed in customer_table.sql'],
        ['Liberty',
         'NO — never run through XGBoost',
         'YES — NAICS/SIC columns',
         'NO',
         'Never joined into smb_zi_oc_efx_combined'],
        ['Middesk',
         'YES — via confidenceScoreMany()',
         'NO — live API only',
         'NO',
         'Live API source — not available for batch processing'],
        ['Trulioo',
         'NO — heuristic only',
         'NO — live API only',
         'NO',
         'Live API source — not available for batch processing'],
    ],
    col_widths=[1.2, 1.5, 1.5, 0.9, 2.4],
)

gap_box(
    'GAP: OC\'s oc_match_confidence already exists in smb_zi_oc_efx_combined. '
    'The only missing piece is parsing industry_code_uids in customer_table.sql. '
    'This is a moderate SQL change that would bring OC (weight 0.9 — highest vendor weight) '
    'into Pipeline B, with the largest benefit for non-US companies.'
)

heading2('Pipeline B — All Scenarios')
data_table(
    ['Situation', 'Stored in customer_files', 'Impact'],
    [
        ['ZI confidence > EFX confidence',
         'ALL fields from ZoomInfo (zi_c_naics6, name, address, revenue...)',
         'ZoomInfo data wins analytics row'],
        ['EFX confidence >= ZI confidence',
         'ALL fields from Equifax (efx_primnaicscode, name, address, revenue...)',
         'Equifax data wins analytics row'],
        ['Both confidences = 0 (no match)',
         'COALESCE fallback to existing value or NULL',
         'NULL — no industry code for this business'],
        ['OC had a stronger match than ZI/EFX',
         'WARN: OC ignored — SQL never reads oc_match_confidence for NAICS',
         'Weaker ZI or EFX code used'],
        ['Liberty/Middesk/Trulioo had best match',
         'WARN: Ignored — live API sources not in batch pipeline',
         'Same ZI vs EFX result'],
        ['customer_files rebuilt on schedule',
         'Entire table overwritten by the latest batch run',
         'Latest batch result always replaces previous row'],
    ],
    col_widths=[1.8, 2.6, 2.1],
)

doc.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# TAB 4 — PIPELINE A DEEP DIVE
# ═════════════════════════════════════════════════════════════════════════════

heading1('Tab 4 — Pipeline A: Real-Time Fact Engine (Deep Dive)', colour=PURPLE)

heading2('The 6 Sources and Their Industry Code Fields')
data_table(
    ['Source', 'Industry code field', 'Weight', 'Confidence method'],
    [
        ['OpenCorporates',
         'industry_code_uids → parse entries prefixed us_naics-',
         '0.9 (highest vendor)',
         'XGBoost oc_probability from ml_model_matches'],
        ['Middesk',
         'NAICS from SOS filing',
         '2.0 (heaviest overall)',
         'XGBoost via confidenceScoreMany() OR 0.15 + 0.20 per passing task'],
        ['ZoomInfo',
         'zi_c_naics6',
         '0.8',
         'XGBoost zi_probability OR similarity_index/55 fallback'],
        ['Equifax',
         'efx_primnaicscode, efx_primsic',
         '0.7',
         'XGBoost efx_probability OR similarity_index/55 fallback'],
        ['Trulioo',
         'sicCode (4-digit triggers POLLUTED flag)',
         '0.8',
         'Heuristic ONLY: match.index / 55 (no XGBoost for Trulioo)'],
        ['AI (GPT-5-mini)',
         'AI-generated NAICS + MCC',
         '0.1 (lowest)',
         'Self-reported: HIGH~0.70 / MED~0.50 / LOW~0.30'],
    ],
    col_widths=[1.2, 1.9, 0.85, 2.55],
)

heading2('The 6 Winner-Selection Rules (from rules.ts)')

heading3('Rule 1 — factWithHighestConfidence()')
body(
    'Sort all source candidates by confidence (0–1). If the gap between the top '
    'and second-highest confidence exceeds WEIGHT_THRESHOLD = 0.05, the highest wins outright.'
)
code_block([
    '-- From integration-service/lib/facts/rules.ts:',
    'factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1',
    '',
    'if |top_confidence - second_confidence| > 0.05 (WEIGHT_THRESHOLD):',
    '  -> highest confidence wins',
    'else:',
    '  -> go to Rule 2 (tie-break by source weight)',
])

heading3('Rule 2 — weightedFactSelector() — tie-break')
body(
    'If two sources are within 0.05 confidence of each other, source weight decides:'
)
body('Middesk (2.0) > OC (0.9) > ZoomInfo (0.8) = Trulioo (0.8) > Equifax (0.7) > AI (0.1)')

heading3('Rule 3 — manualOverride() — always wins')
body(
    'An analyst override set via PATCH /facts/business/{id}/override/{factName} '
    'ALWAYS wins, regardless of any model or AI result. '
    'Stored with an override:{...} field for full audit trail.'
)

heading3('Rule 4 — No minimum confidence cutoff')
body(
    'There is NO minimum confidence threshold. If only one source returned a NAICS '
    'code at confidence 0.05, it wins. Low confidence is visible in the API response '
    'under source.confidence — it is never automatically suppressed.'
)

heading3('Rule 5 — AI safety net (aiNaicsEnrichment.ts)')
body('AI enrichment triggers when:')
bullet('maximumSources: 3', ' — fewer than 3 vendor sources returned a NAICS')
bullet('minimumSources: 1', ' — at least 1 source returned something for context')
bullet('ignoreSources: [\'AINaicsEnrichment\']',
       ' — AI does not count itself toward the minimum')
body(
    'AI result participates in selection with weight = 0.1 — it rarely wins '
    'unless vendors found nothing.'
)

heading3('Rule 6 — Last resort: NAICS 561499')
code_block([
    '// From aiNaicsEnrichment.ts executePostProcessing():',
    'const naicsInfo = await internalGetNaicsCode(winner.naics_code)',
    'if (!naicsInfo?.[0]?.naics_label) {',
    '  // Code not found in core_naics_code table -> replace with last resort',
    '  await removeNaicsCode(taskId, response)',
    '  response.naics_code = "561499"  // All Other Business Support Services',
    '}',
])

heading2('What GPT-5-mini Receives and Returns')
data_table(
    ['Input to GPT', 'Output from GPT', 'Post-processing'],
    [
        ['Business name\nAddress\nWebsite URL (GPT uses web_search)\nDBA names (if any)\n'
         'Existing codes from other sources',
         'naics_code (6-digit NAICS 2022)\nnaics_description\nuk_sic_code (if GB)\n'
         'mcc_code + mcc_description\nconfidence: HIGH / MED / LOW\nreasoning text\n'
         'tools_used (e.g. web_search)\nwebsite_summary',
         'Validate naics_code against core_naics_code.\nIf NOT found: removeNaicsCode()\n'
         '-> replace with 561499.\nResend task-complete for re-processing.'],
    ],
    col_widths=[2.0, 2.2, 2.3],
)
body('Stored in integration_data.request_response with platform_id = 31.')

heading2('Pipeline A — All Scenarios')
data_table(
    ['Situation', 'What gets stored', 'What the customer sees'],
    [
        ['2–6 sources return NAICS and agree',
         'Winner in rds_warehouse_public.facts + data_businesses.naics_id updated',
         'Strong classification, all source confidences, alternatives listed'],
        ['Sources disagree (different codes)',
         'Highest-confidence source wins',
         'Winner + confidence + alternatives showing the disagreement'],
        ['Only 1 source returned a NAICS',
         'That source wins; AI also runs (<3 sources)',
         'Code with possibly low confidence; AI result in alternatives'],
        ['No source returned any NAICS',
         'AI triggers and stores GPT-generated code if valid',
         'AI-generated code or 561499 with confidence=LOW'],
        ['Winning code not in core_naics_code',
         'WARN: Replaced with 561499 via removeNaicsCode()',
         '561499 placeholder — signals no reliable classification'],
        ['All sources at very low confidence (e.g. 0.10)',
         'Highest available wins — NO minimum cutoff',
         'Code shown with low confidence visible — analyst should verify'],
        ['Analyst set a manual override',
         'Override stored in facts with override:{...} audit field',
         'Override code with override field populated in response'],
        ['AI also fails / hallucinates code',
         'WARN: 561499 stored as absolute last resort',
         '561499 — analyst override required'],
    ],
    col_widths=[1.8, 2.3, 2.4],
)

doc.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# TAB 5 — THE 8 CLASSIFICATION FACTS
# ═════════════════════════════════════════════════════════════════════════════

heading1('Tab 5 — The 8 Classification Facts', colour=PURPLE)

callout(
    'All 8 facts are stored in rds_warehouse_public.facts (PostgreSQL + Redshift mirror). '
    'Schema: (business_id, name) -> value (JSONB), received_at. '
    'Upsert: INSERT ON CONFLICT (business_id, name) DO UPDATE SET value = EXCLUDED.value. '
    'One row per fact per business — always the latest value.'
)

# ── Fact 1 ────────────────────────────────────────────────────────────────────
heading2('Fact 1: naics_code')
data_table(
    ['Field', 'Detail'],
    [
        ['What it is',
         'The single best 6-digit NAICS 2022 code for this business\'s primary activity'],
        ['Winner priority',
         'Middesk (2.0) > OC (0.9) > ZoomInfo (0.8) > Trulioo (0.8) > Equifax (0.7) > AI (0.1)'],
        ['OC source field', 'industry_code_uids — parse entries prefixed us_naics-'],
        ['EFX source field', 'equifax_us_standardized.efx_primnaicscode'],
        ['ZI source field',  'zoominfo_standard_ml_2.zi_c_naics6'],
        ['Storage',
         'rds_warehouse_public.facts (name=\'naics_code\')\n'
         'rds_cases_public.data_businesses.naics_id -> FK to core_naics_code.id'],
        ['Customer API',
         'GET /facts/business/{id}/details — full fact with confidence + alternatives[]'],
    ],
    col_widths=[1.6, 4.9],
)
heading3('JSONB payload example')
code_block([
    '{',
    '  "code": "722511",',
    '  "description": "Full-Service Restaurants",',
    '  "source": { "confidence": 0.95, "platformId": 16 },',
    '  "override": null,',
    '  "alternatives": [',
    '    { "value": "722513", "source": 24, "confidence": 0.72 },',
    '    { "value": "722515", "source": 17, "confidence": 0.68 }',
    '  ]',
    '}',
])

# ── Fact 2 ────────────────────────────────────────────────────────────────────
heading2('Fact 2: naics_description')
data_table(['Field', 'Detail'], [
    ['What it is',   'Human-readable label for the winning NAICS code'],
    ['Derived from', 'Lookup from core_naics_code table after naics_code resolves'],
    ['Storage',      'rds_warehouse_public.facts only — NOT in data_businesses'],
    ['JSONB example', '{ "description": "Full-Service Restaurants" }'],
], col_widths=[1.6, 4.9])

# ── Fact 3 ────────────────────────────────────────────────────────────────────
heading2('Fact 3: mcc_code')
data_table(['Field', 'Detail'], [
    ['What it is',
     '4-digit Merchant Category Code — Visa/Mastercard standard for interchange and fraud rules'],
    ['Path A (best)',
     'Vendor directly returns MCC — Middesk or Trulioo API response contains it'],
    ['Path B (most common)',
     'Crosswalk: SELECT mcc_code FROM rel_naics_mcc WHERE naics_code = \'722511\' -> 5812'],
    ['Path C (fallback)',
     'GPT-5-mini returns mcc_code alongside naics_code in AI enrichment response'],
    ['Storage',
     'rds_warehouse_public.facts (name=\'mcc_code\')\n'
     'rds_cases_public.data_businesses.mcc_id -> FK to core_mcc_code.id'],
    ['JSONB example', '{ "code": "5812", "description": "Eating Places, Restaurants" }'],
], col_widths=[1.6, 4.9])

# ── Fact 4 ────────────────────────────────────────────────────────────────────
heading2('Fact 4: mcc_description')
data_table(['Field', 'Detail'], [
    ['What it is',   'Human-readable label for the MCC code'],
    ['Derived from', 'Lookup from core_mcc_code after mcc_code resolves'],
    ['JSONB example', '{ "description": "Eating Places, Restaurants" }'],
], col_widths=[1.6, 4.9])

# ── Fact 5 ────────────────────────────────────────────────────────────────────
heading2('Fact 5: mcc_code_found')
data_table(['Field', 'Detail'], [
    ['What it is',    'Boolean — was MCC found directly from a vendor, or derived via crosswalk?'],
    ['true means',    'Middesk or Trulioo directly returned the MCC code (more reliable)'],
    ['false means',   'MCC was derived from NAICS->MCC crosswalk table (approximation)'],
    ['Why it matters',
     'A direct MCC is more precise. A crosswalk maps one NAICS to one MCC but '
     'some businesses span multiple categories.'],
    ['JSONB example', '{ "value": true }'],
], col_widths=[1.6, 4.9])

# ── Fact 6 ────────────────────────────────────────────────────────────────────
heading2('Fact 6: mcc_code_from_naics')
data_table(['Field', 'Detail'], [
    ['What it is',  'The MCC code derived specifically from the NAICS->MCC crosswalk'],
    ['SQL used',    'SELECT mcc_code FROM rel_naics_mcc WHERE naics_code = \'722511\' -> 5812'],
    ['When used',   'Always computed. Equals mcc_code when mcc_code_found = false.'],
    ['JSONB example', '{ "code": "5812" }'],
], col_widths=[1.6, 4.9])

# ── Fact 7 ────────────────────────────────────────────────────────────────────
heading2('Fact 7: industry')
data_table(['Field', 'Detail'], [
    ['What it is',
     'High-level category label for UI display — less precise than NAICS but human-readable'],
    ['Derived from',
     'First 2 digits of NAICS -> core_business_industries lookup\n'
     '722511 -> first 2 digits = "72" -> "Food Service"'],
    ['Also from',   'ZoomInfo zi_c_industry, Trulioo industry text, OC labels'],
    ['Storage',
     'rds_warehouse_public.facts (name=\'industry\')\n'
     'rds_cases_public.data_businesses.industry -> FK to core_business_industries.id'],
    ['JSONB example', '{ "value": "Food Service" }'],
], col_widths=[1.6, 4.9])

# ── Fact 8 ────────────────────────────────────────────────────────────────────
heading2('Fact 8: classification_codes')
gap_box(
    'KNOWN GAP: classification_codes correctly captures UK SIC, NACE, and Canadian '
    'NAICS codes from OC\'s industry_code_uids. But NO Kafka handler, API endpoint, '
    'PDF report, or database column ever reads this fact downstream. '
    'The UK SIC code gb_sic-56101 exists in the system for UK companies and is '
    'silently discarded. This is one of four confirmed gaps in the production pipeline.'
)
data_table(['Field', 'Detail'], [
    ['What it is',
     'ALL raw industry codes from ALL sources before any winner is chosen'],
    ['Includes',
     'us_naics, gb_sic, uk_sic, nace, ca_naics from OC\'s industry_code_uids\n'
     'EFX secondary NAICS (efx_secnaics1-4)\n'
     'All vendor codes pre-selection'],
    ['Storage',  'rds_warehouse_public.facts ONLY — NOT in data_businesses'],
    ['Gap',      'No Kafka handler, API endpoint, report, or DB column reads this fact.'],
], col_widths=[1.6, 4.9])

heading3('JSONB payload example')
code_block([
    '{',
    '  "codes": [',
    '    { "system": "NAICS",  "code": "722511", "source": "Middesk",  "confidence": 0.95 },',
    '    { "system": "NAICS",  "code": "722511", "source": "OC",        "confidence": 0.89 },',
    '    { "system": "uk_sic", "code": "56101",  "source": "OC",        "confidence": 0.89 },',
    '    { "system": "nace",   "code": "I5610",  "source": "OC",        "confidence": 0.89 },',
    '    { "system": "NAICS",  "code": "722513", "source": "ZoomInfo",  "confidence": 0.72 },',
    '    { "system": "NAICS",  "code": "722515", "source": "Equifax",   "confidence": 0.68 }',
    '  ]',
    '}',
])

doc.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# TAB 6 — API & STORAGE
# ═════════════════════════════════════════════════════════════════════════════

heading1('Tab 6 — API & Storage Reference', colour=PURPLE)

heading2('Storage Architecture')
data_table(
    ['Table', 'Database', 'What it contains', 'Who writes it'],
    [
        ['rds_warehouse_public.facts',
         'PostgreSQL + Redshift mirror',
         'All 217 facts as JSONB key-value. One row per fact per business.',
         'warehouse-service FactService (Kafka facts.v1 consumer)'],
        ['rds_cases_public.data_businesses',
         'case-service PostgreSQL',
         'naics_id, mcc_id, industry — integer FKs. Join lookup tables for codes.',
         'case-service Kafka handler (UPDATE_NAICS_CODE event)'],
        ['core_naics_code',
         'case-service PostgreSQL',
         'id, code, label (e.g. 722511 -> Full-Service Restaurants)',
         'DB migrations — static data'],
        ['core_mcc_code',
         'case-service PostgreSQL',
         'id, code, label (e.g. 5812 -> Eating Places, Restaurants)',
         'DB migrations — static data'],
        ['rel_naics_mcc',
         'case-service PostgreSQL',
         'NAICS -> MCC crosswalk (722511 -> 5812)',
         'DB migrations — static data'],
        ['core_business_industries',
         'case-service PostgreSQL',
         "Sector labels ('72' -> 'Food Service')",
         'DB migrations — static data'],
        ['datascience.customer_files',
         'Redshift',
         'Pipeline B wide analytics table. primary_naics_code, '
         'zi_match_confidence, efx_match_confidence.',
         'warehouse-service sp_recreate_customer_files()'],
        ['integration_data.request_response',
         'integration-service PostgreSQL',
         'All raw vendor API responses + confidence scores per business per platform.',
         'integration-service per API call'],
    ],
    col_widths=[1.7, 1.3, 2.3, 1.2],
)

heading2('API Endpoints That Expose naics_code')
data_table(
    ['Endpoint', 'naics_code?', 'Access', 'What they receive'],
    [
        ['GET /facts/business/{id}/details',
         'YES — primary endpoint',
         'Admin / Customer / Applicant',
         'Full fact: code + confidence + platformId + alternatives[] from all sources'],
        ['GET /facts/business/{id}/kyb',
         'YES — via industry field',
         'Admin / Customer / Applicant',
         'naics_code as part of KYB fact set'],
        ['GET /businesses/customers/{id}',
         'YES — simplified flat',
         'Admin / Customer',
         'naics_code + naics_title flat fields (no source lineage)'],
        ['GET /facts/business/{id}/all',
         'YES — admin only',
         'Admin ONLY',
         "All 217 facts — 'intentionally not cached, leaks information'"],
        ['PATCH /businesses/{id}',
         'NO — stripped from body',
         'n/a',
         'naics_code removed from request — cannot be set via PATCH'],
        ['PATCH /facts/.../override/naics_code',
         'YES — write override',
         'Admin / Customer',
         'Sets analyst override — always wins all future Fact Engine runs'],
    ],
    col_widths=[2.1, 1.1, 1.2, 2.1],
)

heading2('Kafka Events for Classification Facts')
data_table(
    ['Event', 'Topic', 'Triggered by', 'Effect'],
    [
        ['CALCULATE_BUSINESS_FACTS', 'facts.v1',
         'Business submitted', 'Initial fact calculation for all 217 facts'],
        ['UPDATE_NAICS_CODE', 'facts.v1',
         'naics_code fact changes', 'case-service updates data_businesses.naics_id FK'],
        ['FACT_OVERRIDE_CREATED_AUDIT', 'facts.v1',
         'Analyst sets override', 'Override wins all future runs; audit trail updated'],
        ['PROCESS_COMPLETION_FACTS', 'facts.v1',
         'All verifications complete', 'Final fact recalculation with full context'],
    ],
    col_widths=[2.0, 1.0, 1.4, 2.1],
)

heading2('Useful Redshift Queries')

heading3('All 8 classification facts for one business')
code_block([
    'SELECT name, value, received_at',
    'FROM dev.rds_warehouse_public.facts',
    "WHERE business_id = '<uuid>'",
    "  AND name IN (",
    "    'naics_code', 'naics_description',",
    "    'mcc_code', 'mcc_description',",
    "    'mcc_code_found', 'mcc_code_from_naics',",
    "    'industry', 'classification_codes'",
    '  )',
    'ORDER BY name;',
])

heading3('Denormalized record with decoded NAICS + MCC labels')
code_block([
    'SELECT',
    '  b.id,',
    "  n.code  AS naics_code,",
    '  n.label AS naics_description,',
    '  m.code  AS mcc_code,',
    '  m.label AS mcc_description,',
    '  i.name  AS industry',
    'FROM dev.rds_cases_public.data_businesses b',
    'LEFT JOIN dev.rds_cases_public.core_naics_code          n ON n.id = b.naics_id',
    'LEFT JOIN dev.rds_cases_public.core_mcc_code            m ON m.id = b.mcc_id',
    'LEFT JOIN dev.rds_cases_public.core_business_industries i ON i.id = b.industry',
    "WHERE b.id = '<uuid>';",
])

heading3('Pipeline B analytics — customer_files')
code_block([
    'SELECT',
    '  business_id,',
    '  primary_naics_code,       -- winner from ZI vs EFX rule',
    '  zi_match_confidence,      -- XGBoost or heuristic fallback',
    '  efx_match_confidence,     -- XGBoost or heuristic fallback',
    '  match_confidence          -- GREATEST(zi_match_confidence, efx_match_confidence)',
    'FROM datascience.customer_files',
    "WHERE business_id = '<uuid>';",
])

heading3('Find businesses where Pipeline A and Pipeline B disagree on NAICS')
code_block([
    '-- Businesses where Fact Engine chose a different code than customer_table.sql:',
    'SELECT',
    "  f.business_id,",
    "  f.value->>'code'           AS pipeline_a_naics,",
    '  cf.primary_naics_code::text AS pipeline_b_naics',
    'FROM dev.rds_warehouse_public.facts f',
    'JOIN datascience.customer_files cf ON cf.business_id = f.business_id',
    "WHERE f.name = 'naics_code'",
    "  AND f.value->>'code' != cf.primary_naics_code::text",
    'LIMIT 100;',
])

# ═════════════════════════════════════════════════════════════════════════════
# Save
# ═════════════════════════════════════════════════════════════════════════════

out = '/workspace/AI-Powered-NAICS-Industry-Classification-Agent/modeling/Industry_Classification_Worthopedia.docx'
doc.save(out)
size_kb = round(os.path.getsize(out) / 1024, 0)
print(f'Saved  : {out}')
print(f'Size   : {size_kb} KB')
print('Ready  : Upload to Google Docs via File > Import or drag-and-drop')
