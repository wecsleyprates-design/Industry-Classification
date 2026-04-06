"""
Generates: NAICS_MCC_Fallback_Root_Cause_Report.docx
A comprehensive Word document reporting the diagnostic findings from
NAICS_MCC_Fallback_RootCause_Analysis.ipynb

Verified against real production data:
  - 5,349 businesses with NAICS 561499 / MCC 5614
  - Run date: April 2026
"""
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os

doc = Document()

# ── Page setup (landscape for wide tables) ────────────────────────────────────
s = doc.sections[0]
s.page_width    = Inches(11.0)
s.page_height   = Inches(8.5)
s.left_margin   = Inches(0.75)
s.right_margin  = Inches(0.75)
s.top_margin    = Inches(0.65)
s.bottom_margin = Inches(0.65)
s.orientation   = 1
PAGE_W = 9.5

# ── Colours ────────────────────────────────────────────────────────────────────
PURPLE = RGBColor(0x5B, 0x21, 0xB6)
BLUE   = RGBColor(0x1E, 0x40, 0xAF)
TEAL   = RGBColor(0x04, 0x5F, 0x7E)
GREEN  = RGBColor(0x06, 0x5F, 0x46)
RED    = RGBColor(0x99, 0x1B, 0x1B)
AMBER  = RGBColor(0x78, 0x35, 0x00)
SLATE  = RGBColor(0x33, 0x41, 0x55)
DARK   = RGBColor(0x0F, 0x17, 0x2A)

# ── Helpers ────────────────────────────────────────────────────────────────────
def _shade(cell, hex6):
    tc = cell._tc; tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'),'clear'); shd.set(qn('w:color'),'auto'); shd.set(qn('w:fill'),hex6)
    tcPr.append(shd)

def _left_border(cell, hex6, sz=28):
    tc = cell._tc; tcPr = tc.get_or_add_tcPr()
    tcB = OxmlElement('w:tcBorders')
    b = OxmlElement('w:left')
    b.set(qn('w:val'),'single'); b.set(qn('w:sz'),str(sz))
    b.set(qn('w:space'),'0'); b.set(qn('w:color'),hex6)
    tcB.append(b); tcPr.append(tcB)

def _cell_margins(cell, top=60, right=100, bottom=60, left=100):
    tc = cell._tc; tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for side, val in [('top',top),('right',right),('bottom',bottom),('left',left)]:
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:w'),str(val)); el.set(qn('w:type'),'dxa'); tcMar.append(el)
    tcPr.append(tcMar)

def _no_borders(tbl):
    tblPr = tbl._tbl.tblPr
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr'); tbl._tbl.insert(0, tblPr)
    tblB = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'),'none'); tblB.append(b)
    tblPr.append(tblB)

def _repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    tblH = OxmlElement('w:tblHeader'); trPr.append(tblH)

def spacer(pts=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(pts)

def H1(text, colour=PURPLE, pb=False):
    if pb: doc.add_page_break()
    p = doc.add_heading('', level=1)
    p.paragraph_format.space_before = Pt(16); p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text); r.bold = True; r.font.size = Pt(18); r.font.color.rgb = colour
    return p

def H2(text, colour=BLUE):
    p = doc.add_heading('', level=2)
    p.paragraph_format.space_before = Pt(13); p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text); r.bold = True; r.font.size = Pt(13); r.font.color.rgb = colour
    return p

def H3(text, colour=TEAL):
    p = doc.add_heading('', level=3)
    p.paragraph_format.space_before = Pt(10); p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text); r.bold = True; r.font.size = Pt(11.5); r.font.color.rgb = colour
    return p

def body(text, size=10.5, colour=SLATE, sa=5, bold=False):
    p = doc.add_paragraph()
    r = p.add_run(text); r.font.size = Pt(size); r.font.color.rgb = colour; r.bold = bold
    p.paragraph_format.space_after = Pt(sa); p.paragraph_format.space_before = Pt(0)
    return p

def bullet(prefix, text, size=10.5, level=0):
    style = 'List Bullet' if level == 0 else 'List Bullet 2'
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(2); p.paragraph_format.space_before = Pt(0)
    if prefix:
        rb = p.add_run(prefix); rb.bold = True; rb.font.size = Pt(size); rb.font.color.rgb = DARK
    if text:
        r = p.add_run(text); r.font.size = Pt(size); r.font.color.rgb = SLATE

def callout(text, bg='EFF6FF', border='1D4ED8', tc=None, size=10):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT; _no_borders(tbl)
    cell = tbl.rows[0].cells[0]
    _shade(cell, bg); _left_border(cell, border, sz=28)
    cell.width = Inches(PAGE_W)
    _cell_margins(cell, top=60, right=120, bottom=60, left=160)
    cp = cell.paragraphs[0]
    cp.paragraph_format.space_before = Pt(0); cp.paragraph_format.space_after = Pt(0)
    r = cp.add_run(text); r.font.size = Pt(size)
    r.font.color.rgb = tc or RGBColor.from_string(border)
    spacer(7)

def warn(text):  callout(text,'FFFBEB','D97706',RGBColor(0x78,0x35,0x00))
def gap(text):   callout(text,'FEE2E2','DC2626',RGBColor(0x7F,0x1D,0x1D))
def ok(text):    callout(text,'F0FDF4','059669',RGBColor(0x06,0x5F,0x46))
def info(text):  callout(text,'EDE9FE','5B21B6',RGBColor(0x2E,0x10,0x65))

def lineage(lines):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT; _no_borders(tbl)
    cell = tbl.rows[0].cells[0]
    _shade(cell,'F0F9FF'); _left_border(cell,'0284C7', sz=28)
    cell.width = Inches(PAGE_W)
    _cell_margins(cell, top=80, right=120, bottom=80, left=140)
    first = True
    for line in lines:
        cp = cell.paragraphs[0] if first else cell.add_paragraph(); first = False
        cp.paragraph_format.space_before = Pt(0); cp.paragraph_format.space_after = Pt(0)
        r = cp.add_run(line)
        r.font.name = 'Courier New'; r.font.size = Pt(8.5); r.font.color.rgb = DARK
    spacer(8)

def tbl(headers, rows, col_widths=None, hdr='DBEAFE', alt='F8FAFF', fs=9.5):
    ncols = len(headers)
    t = doc.add_table(rows=1, cols=ncols)
    t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.LEFT
    hrow = t.rows[0]; _repeat_header(hrow)
    for ci, h in enumerate(headers):
        cell = hrow.cells[ci]; _shade(cell, hdr); _cell_margins(cell)
        p = cell.paragraphs[0]; r = p.add_run(h)
        r.bold = True; r.font.size = Pt(fs); r.font.color.rgb = DARK
    for ri, row_data in enumerate(rows):
        row = t.add_row()
        for ci, val in enumerate(row_data):
            cell = row.cells[ci]
            if ri % 2 == 1: _shade(cell, alt)
            _cell_margins(cell)
            p = cell.paragraphs[0]; v = str(val)
            if v.startswith('YES') or v.startswith('True'): rgb, bld = GREEN, True
            elif v.startswith('NO ') or v.startswith('False'): rgb, bld = RED, True
            elif v.startswith('WARN'): rgb, bld = AMBER, True
            elif v.startswith('GAP'): rgb, bld = RED, True
            else: rgb, bld = SLATE, False
            r = p.add_run(v); r.font.size = Pt(fs); r.font.color.rgb = rgb; r.bold = bld
    if col_widths:
        for ri2 in range(len(t.rows)):
            for ci2, w in enumerate(col_widths): t.rows[ri2].cells[ci2].width = Inches(w)
    spacer(8)


# ════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════════════════════════

spacer(16)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('NAICS/MCC Fallback Root-Cause Analysis')
r.bold = True; r.font.size = Pt(26); r.font.color.rgb = PURPLE
p.paragraph_format.space_after = Pt(5)

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Why 5,349 Businesses Show "All Other Business Support Services"')
r.font.size = Pt(14); r.font.color.rgb = BLUE
p.paragraph_format.space_after = Pt(14)

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run(
    'Findings from real production data (April 2026)  |  '
    'Worth AI Classification Pipeline  |  '
    'Verified against Redshift + integration-service source code'
)
r.font.size = Pt(10); r.font.color.rgb = SLATE
p.paragraph_format.space_after = Pt(20)

info(
    'The customer currently sees this for 5,349 businesses:\n\n'
    '  Industry Name:     Administrative and Support and Waste Management Services\n'
    '  NAICS Code:        561499\n'
    '  NAICS Description: All Other Business Support Services\n'
    '  MCC Code:          5614\n'
    '  MCC Description:   Fallback MCC per instructions (no industry evidence to '
    'determine canonical MCC description)\n\n'
    'This report explains WHY this happens, what the data confirms, '
    'and the exact gaps in the current pipeline.'
)

H2('Document Contents')
tbl(
    ['Section', 'Title', 'Key finding'],
    [
        ['1', 'Executive Summary', '5,349 businesses (7.7%) — 1 root cause dominates at 99.98%'],
        ['2', 'The Problem: What the Customer Sees',
         'Internal fallback text exposed verbatim to customers; data lineage explained'],
        ['3', 'Notebook Step 2 — Fallback Diagnosis Summary',
         'Full data pull: vendor availability, AI stats, Pipeline B cross-check'],
        ['4', 'Notebook Step 3 — Root-Cause Scenario Distribution',
         'Chart: Scenario C = 5,348 (99.98%); Scenario E = 1 (0.02%)'],
        ['5', 'Notebook Step 4 — Vendor Signal Availability',
         'Chart: 100% of businesses have 0 vendor NAICS; Pipeline B also null'],
        ['6', 'Notebook Step 5 — AI Enrichment Behaviour',
         'Chart: AI confidence = empty for ALL cases; AI never ran traceable metadata'],
        ['7', 'Notebook Step 6 — Example Businesses per Scenario',
         'Real row-level data: all have zi/efx/oc NAICS = null, pipeline_b = null'],
        ['8', 'Notebook Step 7 — Confirmed System Gaps (G1-G6)',
         'Six confirmed gaps; recovery chart: 30% name-deducible, 20% web-findable, 50% correct'],
        ['9', 'Notebook Step 8 — Pipeline Workflow Diagram',
         'Full annotated pipeline showing WHERE each gap occurs'],
        ['10', 'Prioritised Fix Roadmap', 'P1-P6 ranked by impact and effort'],
        ['11', 'Implementation Plan', 'Exact TypeScript + Python changes per fix'],
        ['12', 'Conclusions', 'Four key conclusions from the real data analysis'],
    ],
    col_widths=[0.5, 2.5, 6.5],
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 1 — EXECUTIVE SUMMARY
# ════════════════════════════════════════════════════════════════════════════

H1('Section 1 — Executive Summary')

body(
    'Worth AI currently stores NAICS code 561499 ("All Other Business Support Services") '
    'for 5,349 businesses, representing 7.7% of the total businesses in the system. '
    'These businesses also show MCC code 5614 with the customer-visible message: '
    '"Fallback MCC per instructions (no industry evidence to determine canonical MCC description)." '
    'A diagnostic analysis was performed against real Redshift production data (April 2026) '
    'to identify the exact root causes and recovery opportunities.'
)
spacer(4)

tbl(
    ['Metric', 'Value', 'Interpretation'],
    [
        ['Total businesses with NAICS 561499',
         '5,349',
         '7.7% of all businesses in production system'],
        ['Dominant root cause (Scenario C)',
         '5,348 (99.98%)',
         'Zero vendor NAICS signals — ZI, EFX, and OC all failed to match'],
        ['Edge case (Scenario E)',
         '1 (0.02%)',
         'AI enrichment was NOT triggered; Fact Engine winner had no NAICS'],
        ['Other scenarios (A, B, D, F)',
         '0 (0.00%)',
         'NOT observed in production — previously hypothesised but unconfirmed'],
        ['AI was winning source (platform_id=31)',
         '2,381 (44.5%)',
         'AI enrichment ran and returned 561499 as last resort'],
        ['Other source was winning source',
         '2,968 (55.5%)',
         'Middesk/Trulioo/SERP won, but also had no NAICS — AI still produced 561499'],
        ['AI confidence HIGH / MED / LOW',
         '0 / 0 / 0',
         'EMPTY — AI enrichment metadata fact not stored for ANY fallback case'],
        ['AI hallucinated invalid code',
         '0 (0.0%)',
         'AI correctly returned valid 561499 per its system prompt instructions'],
        ['Pipeline B (customer_files) has real NAICS',
         '0 (0.0%)',
         'Pipeline B also shows NULL — confirms entity-matching failure in both pipelines'],
        ['Estimated recoverable: name keywords',
         '~1,604 (~30%)',
         'Business name clearly indicates industry (salon, restaurant, church, etc.)'],
        ['Estimated recoverable: web search',
         '~1,069 (~20%)',
         'Open web search could find public info for businesses with no vendor match'],
        ['Genuinely unclassifiable (561499 correct)',
         '~2,675 (~50%)',
         'Holding companies, shells, zero public footprint — 561499 IS correct'],
    ],
    col_widths=[3.2, 1.8, 4.5],
)

callout(
    'CRITICAL INSIGHT: The entire 561499 problem is caused by a single failure — '
    'entity matching does not find vendor records (ZI/EFX/OC) for these businesses. '
    'Once the AI enrichment fires with no vendor data and no website, '
    'it correctly follows its prompt: "return 561499 as last resort." '
    'The XGBoost consensus model CANNOT help here — it has no vendor inputs to read. '
    'The highest-impact fixes are (P1) teach the AI to classify from name keywords, '
    'and (P2) enable the AI to search the web when no vendor data exists.',
    bg='EDE9FE', border='5B21B6', tc=RGBColor(0x2E, 0x10, 0x65)
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 2 — THE PROBLEM: WHAT THE CUSTOMER SEES
# ════════════════════════════════════════════════════════════════════════════

H1('Section 2 — The Problem: What the Customer Sees')

body(
    'When an analyst or customer opens a business case in the Worth AI admin portal '
    '(admin.joinworth.com) and navigates to the KYB tab, the Industry section shows:'
)
spacer(4)
lineage([
    '  Industry Name:     Administrative and Support and Waste Management and Remediation Services',
    '  NAICS Code:        561499',
    '  NAICS Description: All Other Business Support Services',
    '  MCC Code:          5614',
    '  MCC Description:   Fallback MCC per instructions (no industry evidence to determine',
    '                     canonical MCC description)',
])

body(
    'This output is harmful for underwriting, risk scoring, and compliance in three ways:'
)
bullet('Useless classification:',
       ' A nail salon, a restaurant, a church, and a holding company all receive the same code.')
bullet('Internal debug text exposed:',
       ' "Fallback MCC per instructions" is an internal system note that the customer sees literally. '
       'It reveals implementation details and provides no useful information.')
bullet('Missing 50% of recoverable businesses:',
       ' Approximately 2,673 businesses (50%) could be classified with either name-keyword logic '
       'or web search, but the current pipeline does not attempt either.')
spacer(6)

H2('Exact data lineage: how 561499 gets written')
lineage([
    'STORAGE TABLE: rds_warehouse_public.facts',
    '  Row 1: name="naics_code"',
    '          value={"value":"561499","source":{"platformId":31,"confidence":0.1},"alternatives":[]}',
    '',
    '  Row 2: name="mcc_code"',
    '          value={"value":"5614","source":{"platformId":31,"confidence":0.1}}',
    '',
    'WHAT platform_id=31 MEANS: The AI enrichment (AINaicsEnrichment.ts) was the winning source.',
    '',
    'ALSO WRITTEN: rds_cases_public.data_businesses',
    '  naics_id  → FK to core_naics_code WHERE code = "561499"',
    '  mcc_id    → FK to core_mcc_code    WHERE code = "5614"',
    '',
    'RAW AI RESPONSE: integration_data.request_response (platform_id=31)',
    '  The full GPT-5-mini response IS stored here. Confidence and reasoning ARE in this table.',
    '  However, the ai_naics_enrichment_metadata FACT is never written for fallback cases.',
    '  This means quality monitoring is impossible without querying the raw JSON.',
])

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 3 — NOTEBOOK STEP 2: FALLBACK DIAGNOSIS SUMMARY
# ════════════════════════════════════════════════════════════════════════════

H1('Section 3 — Notebook Step 2: Fallback Diagnosis Summary (Real Data)')

body(
    'The diagnostic module (naics_mcc_classifier/diagnostic.py) pulled all 5,349 businesses '
    'with NAICS 561499 from the Redshift production database, joined their vendor signals '
    'from the match tables, and produced the following summary. '
    'This is real production data, not synthetic.'
)
spacer(4)

lineage([
    'INFO naics_mcc_classifier.diagnostic -- === Running 561499 Fallback Root-Cause Analysis ===',
    'INFO naics_mcc_classifier.diagnostic -- Pulling 561499 businesses from facts table...',
    'INFO naics_mcc_classifier.diagnostic -- Pulled 5349 fallback businesses from facts',
    'INFO naics_mcc_classifier.diagnostic -- Pulling vendor NAICS signals...',
    'INFO naics_mcc_classifier.diagnostic -- Pulled vendor signals for 5349 businesses',
    'INFO naics_mcc_classifier.diagnostic -- Merged dataset: 5349 rows',
    'INFO naics_mcc_classifier.diagnostic -- Detailed diagnosis saved to artifacts/fallback_diagnosis.csv',
    'INFO naics_mcc_classifier.diagnostic -- Summary report saved to artifacts/fallback_diagnosis_report.json',
    'INFO naics_mcc_classifier.diagnostic -- === Diagnosis complete: 5349 businesses analysed ===',
])

H2('Vendor NAICS Signal Availability')
body('The diagnostic measured how many of the three primary vendors (ZoomInfo, Equifax, OpenCorporates) '
     'provided a NAICS signal (defined as match_confidence >= 0.50) for each of the 5,349 businesses:')
spacer(3)

tbl(
    ['Vendor NAICS count', 'Businesses', 'Percentage', 'What this means'],
    [
        ['0 (all vendors null)',
         '5,348',
         '100.0%',
         'ZoomInfo, Equifax, AND OpenCorporates all had no match. The entity-matching step '
         'returned no record above threshold for 99.98% of fallback businesses.'],
        ['1 vendor has NAICS',
         '1',
         '0.02%',
         'Exactly one vendor had a NAICS signal. This corresponds to Scenario E '
         '(AI not triggered because Fact Engine had enough sources, but winner had no NAICS).'],
        ['2 vendors have NAICS',
         '0',
         '0.0%',
         'Not observed. Previously hypothesised as "Scenario B" but entirely absent from data.'],
        ['3 vendors have NAICS',
         '0',
         '0.0%',
         'Not observed. Previously hypothesised as "Scenario A" but entirely absent from data.'],
    ],
    col_widths=[2.0, 1.2, 1.2, 5.1],
)

gap(
    'CRITICAL: The assumption that some 561499 businesses had vendor NAICS codes that were being '
    'ignored by the pipeline (Scenarios A and B) is NOT supported by production data. '
    'In reality, 99.98% of fallback businesses have ZERO vendor NAICS signals at all. '
    'This fundamentally changes the fix strategy: '
    'improving the consensus layer or XGBoost model will have NO impact on 5,348/5,349 businesses '
    'because there is no vendor data for the model to use.'
)

H2('AI Enrichment Statistics')
body('The diagnostic also measured the AI enrichment behaviour across all 5,349 businesses:')
spacer(3)

tbl(
    ['AI Metric', 'Value', 'Percentage', 'Interpretation'],
    [
        ['AI was winning source (platform_id=31)',
         '2,381',
         '44.5%',
         'AI enrichment ran AND its result was selected by the Fact Engine as the '
         'winning NAICS source. The AI returned 561499 per its last-resort instruction.'],
        ['Other source was winning source',
         '2,968',
         '55.5%',
         'Middesk, Trulioo, or SERP scraping won the Fact Engine comparison, '
         'but that source also had no valid NAICS. The Fact Engine then stored '
         'that source\'s result (which was 561499 or null), not the AI result.'],
        ['AI confidence HIGH',
         '0',
         '0.0%',
         'No businesses had a HIGH confidence AI enrichment result stored in facts.'],
        ['AI confidence MED',
         '0',
         '0.0%',
         'No businesses had a MED confidence AI enrichment result stored in facts.'],
        ['AI confidence LOW',
         '0',
         '0.0%',
         'No businesses had a LOW confidence AI enrichment result stored in facts.'],
        ['AI never ran (confidence field empty)',
         '5,349',
         '100.0%',
         'The ai_naics_enrichment_metadata fact was NOT written for any of the 5,349 businesses. '
         'This does NOT mean AI never ran — it means the metadata fact was not saved. '
         'The ai_was_winner flag confirms AI ran for 2,381 businesses.'],
        ['AI hallucinated invalid code',
         '0',
         '0.0%',
         'The post-processing validateNaicsCode() stripped 0 codes. '
         'The AI correctly returned 561499 (a valid code) as instructed — '
         'it did not hallucinate a non-existent code.'],
    ],
    col_widths=[2.8, 0.7, 1.2, 4.8],
    fs=9,
)

warn(
    'IMPORTANT DISTINCTION: "ai_never_ran = 5,349 (100%)" does NOT mean the AI enrichment '
    'never fired. It means the ai_naics_enrichment_metadata FACT was not written. '
    'The ai_was_winner field (which reads platform_id from the facts table) confirms '
    'AI DID run for 2,381 businesses. The metadata (confidence, reasoning) was produced '
    'by GPT but the code path that saves it as a structured fact was not triggered '
    'for 561499 return cases. This is Gap G4.'
)

H2('Pipeline B Cross-Check')
body(
    'Pipeline B (the batch Redshift analytics pipeline, stored in datascience.customer_files) '
    'applies a different winner rule: the ZoomInfo NAICS if zi_match_confidence > efx_match_confidence, '
    'otherwise the Equifax NAICS. The diagnostic checked whether Pipeline B had a real NAICS '
    'for any of the 5,349 businesses:'
)
spacer(3)
lineage([
    'Pipeline B result (datascience.customer_files):',
    '  Has real NAICS in Pipeline B: 0 (0.0%)',
    '',
    '  Interpretation:',
    '  For all 5,349 businesses:',
    '    zi_match_confidence = 0  (ZoomInfo found no match)',
    '    efx_match_confidence = 0  (Equifax found no match)',
    '  → Pipeline B winner rule: WHEN 0 > 0 → false → EFX wins → EFX NAICS = null',
    '  → customer_files.primary_naics_code = NULL for all 5,349 businesses',
    '',
    'CONCLUSION: The entity-matching failure is complete across BOTH pipelines.',
    'Pipeline A (real-time) and Pipeline B (batch) read the same source tables',
    'and both find zero matches for these businesses.',
])

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 4 — NOTEBOOK STEP 3: ROOT-CAUSE SCENARIO DISTRIBUTION
# ════════════════════════════════════════════════════════════════════════════

H1('Section 4 — Notebook Step 3: Root-Cause Scenario Distribution')

body(
    'The diagnostic classified all 5,349 businesses into one of 6 root-cause scenarios. '
    'A donut chart and bar chart were generated to visualise the distribution. '
    'The charts showed a near-total dominance of one scenario.'
)
spacer(4)

H2('Chart 1: Scenario Distribution Donut and Bar Charts')
body(
    'The donut chart on the left showed one dominant salmon/red segment filling ~99% of the ring. '
    'The bar chart on the right showed two bars: a tall red bar at 5,348 (99%) '
    'for "C: No vendor NAICS (AI blind)" and a near-invisible green bar at 1 (0%) '
    'for "E: AI not triggered (no winner)." '
    'All other scenarios (A, B, D, F) showed zero.'
)
spacer(4)

tbl(
    ['Scenario', 'Code', 'Count', 'Pct', 'Description', 'What this means'],
    [
        ['C',
         'no_vendor_naics_ai_blind',
         '5,348',
         '99.98%',
         'Zero vendors have NAICS signal. AI fired with only name+address. '
         'If no website and name is ambiguous, AI correctly returns 561499.',
         'The dominant failure mode. All three vendors (ZI, EFX, OC) failed to '
         'match these businesses in entity matching. The AI then had no data '
         'and correctly followed its fallback instruction.'],
        ['E',
         'ai_not_triggered_fallback',
         '1',
         '0.02%',
         'AI enrichment was NOT triggered. The Fact Engine already had >= 3 sources. '
         'The winner source had no valid NAICS.',
         'Edge case. One business had enough sources (Middesk + Trulioo + SERP) to '
         'bypass AI enrichment, but the winning source had no NAICS. '
         'Investigate via integration_data.request_response for this business_id.'],
        ['A', 'all_vendors_have_naics', '0', '0.0%',
         'All vendors agree on NAICS but AI overrode them.', 'NOT observed in production data.'],
        ['B', 'some_vendors_have_naics', '0', '0.0%',
         '1-2 vendors have NAICS, AI ignored.', 'NOT observed in production data.'],
        ['D', 'ai_hallucinated', '0', '0.0%',
         'AI returned an invalid NAICS code that was stripped.', 'NOT observed in production data.'],
        ['F', 'winner_has_naics_not_stored', '0', '0.0%',
         'Winner had NAICS but it was not stored correctly.', 'NOT observed in production data.'],
    ],
    col_widths=[0.8, 2.3, 0.7, 0.7, 2.5, 2.5],
    fs=8.5,
)

gap(
    'FINDING: Scenarios A, B, D, and F — previously hypothesised as possible contributors — '
    'are ALL absent from production data. The 561499 problem is entirely explained by two scenarios: '
    '(C) 5,348 businesses with zero vendor signals, and '
    '(E) 1 business where AI was not triggered but the winning source had no NAICS. '
    'The fix for Scenario E is an investigation, not a systematic change.'
)

H2('Why Scenario C description says "AI correctly returns 561499"')
body(
    'The diagnostic description for Scenario C explicitly states: '
    '"If no website and name is ambiguous, AI CORRECTLY returns 561499." '
    'This is important: for the 50% of businesses that are genuinely unclassifiable '
    '(holding companies, shell entities, brand-new businesses with no public footprint), '
    '561499 IS the correct answer. The system did not fail for these businesses. '
    'The failures are the other 50%: businesses where the name or web presence '
    'COULD provide a real NAICS code, but the current pipeline does not attempt to extract it.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 5 — NOTEBOOK STEP 4: VENDOR SIGNAL AVAILABILITY
# ════════════════════════════════════════════════════════════════════════════

H1('Section 5 — Notebook Step 4: Vendor Signal Availability Analysis')

body(
    'Three bar charts were generated side-by-side to show vendor signal coverage, '
    'the breakdown of which vendor had a signal when only one did, '
    'and the Pipeline B comparison for the same businesses.'
)
spacer(4)

H2('Chart 1 (left): How Many Sources Have NAICS?')
body(
    'The left panel shows a bar chart with x-axis labels: "0 (all null)", "1 vendor", '
    '"2 vendors", "3 vendors." The bars show:'
)
bullet('5,348 (99%)', ' at x=0 (all null) — shown in red/salmon')
bullet('1 (0%)', ' at x=1 (one vendor) — a barely visible bar')
bullet('0', ' at x=2 and x=3 — no bar visible')
spacer(4)
body(
    'Interpretation: The metric "match_conf >= 0.50" was used to define a valid vendor NAICS signal. '
    'For 5,348 of 5,349 businesses, no vendor reached this threshold. '
    'This means the entity-matching XGBoost model (entity_matching_20250127 v1) '
    'assigned a match_confidence below 0.50 for all candidates it evaluated, '
    'or found no candidate at all. '
    'The consequence: when all vendor signals are null, the AI enrichment fires '
    'with only business name and address — no NAICS code references, '
    'no website, no industry keywords from vendor data.'
)

H2('Chart 2 (middle): When Only 1 Vendor Has NAICS — Which One?')
body(
    'The middle panel shows which of the three vendors had a NAICS signal for the 1 business '
    'in Scenario E. The chart showed:'
)
bullet('ZI only:', ' 0 businesses')
bullet('EFX only:', ' 1 business')
bullet('OC only:', ' 0 businesses')
spacer(4)
body(
    'Interpretation: For the single Scenario E business, Equifax (EFX) had a NAICS signal '
    'but the Fact Engine still produced 561499 as the final code. '
    'This suggests either: the EFX confidence was below the Fact Engine threshold, '
    'the EFX NAICS itself was 561499, or the winning source had priority over EFX '
    'and chose a different (non-NAICS) response. '
    'This business requires manual investigation in integration_data.request_response.'
)

H2('Chart 3 (right): Pipeline B (customer_files) for Same Businesses')
body(
    'The right panel shows three bars:'
)
bullet('"Pipeline B has real NAICS":',
       ' 0 (0%) — green bar, zero height. Pipeline B found NO real NAICS for any of the 5,349 businesses.')
bullet('"Pipeline B also null":',
       ' 5,349 (100%) — red bar. customer_files.primary_naics_code = NULL for ALL 5,349 businesses.')
bullet('"Pipeline B also 561499":',
       ' 0 (0%) — amber bar, zero height. Pipeline B does not default to 561499 — it stores NULL.')
spacer(4)
body(
    'Interpretation: Pipeline B uses a simpler winner rule (ZI vs EFX by match_confidence) '
    'and does not fall back to AI enrichment. When both zi_match_confidence = 0 and '
    'efx_match_confidence = 0, Pipeline B stores NULL in primary_naics_code. '
    'The fact that Pipeline B is also NULL for all 5,349 businesses is definitive confirmation: '
    'the entity-matching failure is total and consistent across both pipelines.'
)
lineage([
    'KEY INSIGHT OUTPUT FROM NOTEBOOK:',
    '  0 businesses (0%) show 561499 in Pipeline A',
    '  but Pipeline B (ZI vs EFX rule) HAS a real NAICS code for them.',
    '  This means Pipeline B is working but Pipeline A\'s Fact Engine missed it.',
    '',
    '  ACTUAL INTERPRETATION: The 0% figure means there is NO discrepancy between',
    '  Pipeline A and Pipeline B. Both pipelines see the same empty vendor match tables.',
    '  Pipeline B has NULL (not 561499) because it has no AI fallback.',
    '  Pipeline A has 561499 because its AI fallback fires and returns 561499.',
])

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 6 — NOTEBOOK STEP 5: AI ENRICHMENT BEHAVIOUR
# ════════════════════════════════════════════════════════════════════════════

H1('Section 6 — Notebook Step 5: AI Enrichment (GPT-5-mini) Behaviour')

body(
    'Three charts were generated to analyse how the AI enrichment behaved for the 5,349 businesses: '
    'AI confidence distribution, which source won the Fact Engine, '
    'and the AI hallucination rate.'
)
spacer(4)

H2('Chart 1 (left): AI Confidence Level (when AI ran)')
body(
    'The left panel shows four bars: HIGH, MED, LOW, and "Not Run." The results:'
)
bullet('HIGH:', ' 0 (0%) — green bar, zero height.')
bullet('MED:', ' 0 (0%) — amber bar, zero height.')
bullet('LOW:', ' 0 (0%) — red bar, zero height.')
bullet('"Not Run":',
       ' 5,349 (100%) — grey bar. The ai_confidence_level field is empty for ALL businesses.')
spacer(4)

warn(
    'INTERPRETATION OF "AI CONFIDENCE = EMPTY FOR 100%": '
    'This chart shows the ai_confidence_level field as read from the ai_naics_enrichment_metadata fact '
    'in rds_warehouse_public.facts. This fact was NOT written for any of the 5,349 businesses. '
    'The label "Not Run" is technically misleading — the AI DID run for 2,381 businesses '
    '(confirmed by ai_was_winner = True). '
    'The correct interpretation: the ai_naics_enrichment_metadata FACT was never written '
    'when the AI returned 561499. This is GAP G4 — a data lineage failure, not an AI failure.'
)

H2('Chart 2 (middle): Which Source Won the Fact Engine?')
body(
    'The middle panel shows two bars showing whether AI or another source was the Fact Engine winner:'
)
bullet('"AI was winner (platform_id=31)":',
       ' 2,381 (44%) — amber bar. The AI enrichment was the source that the Fact Engine selected '
       'as the highest-weighted source for the naics_code fact.')
bullet('"Other source was winner":',
       ' 2,968 (55%) — blue bar. A different source (Middesk, Trulioo, SERP scraping) '
       'won the Fact Engine comparison, but also had no valid NAICS.')
spacer(4)
body(
    'Interpretation: The AI was the Fact Engine winner for slightly less than half of all '
    '561499 businesses. For the other 55%, a non-AI source was the highest-weighted '
    'response — but that source also had no NAICS code. '
    'This reveals that even sources like Middesk (SOS filings, weight=2.0) and '
    'Trulioo (live KYB, weight=0.8) could not provide a NAICS code for these businesses. '
    'The AI then produced 561499, but since the AI weight (0.1) is lower than the '
    'other winning sources, the AI result was not always chosen as the final winner.'
)

H2('Chart 3 (right): AI Hallucination Rate')
body(
    'The donut chart shows the hallucination rate — how often the AI returned an '
    'invalid NAICS code that was stripped by validateNaicsCode():'
)
bullet('Hallucinated (0 codes stripped):', ' 0.0%')
bullet('Valid or no code (5,349):', ' 100.0%')
spacer(4)
ok(
    'POSITIVE FINDING: The AI did NOT hallucinate. '
    '561499 is a valid, real NAICS code that exists in the core_naics_code table. '
    'The AI correctly returned a real code as instructed — it just returned the '
    'fallback code for every ambiguous case because it had no other information. '
    'The problem is the absence of better instructions and data, not AI hallucination.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 7 — NOTEBOOK STEP 6: EXAMPLE BUSINESSES PER SCENARIO
# ════════════════════════════════════════════════════════════════════════════

H1('Section 7 — Notebook Step 6: Example Businesses per Scenario')

body(
    'The diagnostic extracted the first 5 businesses for each scenario to illustrate '
    'the real row-level data. Only one scenario had data: Scenario C.'
)
spacer(4)

H2('Scenario C: no_vendor_naics_ai_blind — 5,348 businesses (99%)')
body(
    '"Zero vendors have any NAICS signal. AI fired with only name+address. '
    'If no website and name is ambiguous, AI correctly returns 561499."'
)
spacer(3)
body('The example rows from real production data:')
spacer(3)

tbl(
    ['Column', 'Value for all 5 rows', 'Interpretation'],
    [
        ['scenario',
         'C_no_vendor_naics_ai_blind',
         'All five examples confirm they are in the dominant Scenario C.'],
        ['vendor_summary',
         '"AI()" or "no vendor signals"',
         '"AI()" means AI was the winning source. '
         '"no vendor signals" means even the AI was not the winner — '
         'another source won but also had no NAICS.'],
        ['zi_naics6 (ZoomInfo NAICS)',
         'None',
         'ZoomInfo entity matching found no record above threshold. '
         'zoominfo_matches_custom_inc_ml has NO ROW for these businesses.'],
        ['efx_naics6 (Equifax NAICS)',
         'None',
         'Equifax entity matching found no record above threshold. '
         'efx_matches_custom_inc_ml has NO ROW for these businesses.'],
        ['oc_naics6 (OpenCorporates NAICS)',
         'empty string or None',
         'OpenCorporates matching also found no match. '
         'OC stores industry codes differently (SIC/NAICS codes in industry_code_uids). '
         'Empty means no industry code was present.'],
        ['zi_match_confidence',
         'None',
         'ZoomInfo match confidence is NULL — no ZI match row exists in the match table.'],
        ['efx_match_confidence',
         'NaN',
         'Equifax match confidence is NaN — same as above. '
         'The NaN vs None difference is a DataFrame artifact; both mean no match.'],
        ['oc_match_confidence',
         'None',
         'OpenCorporates match confidence is NULL.'],
        ['n_vendor_naics',
         '0',
         'Confirmed: zero vendors provided a usable NAICS signal.'],
        ['ai_was_winner',
         'True or False',
         'True = AI (platform_id=31) was selected by Fact Engine as winner. '
         'False = another source (Middesk/Trulioo) won but also had no NAICS.'],
        ['ai_confidence_level',
         'empty string ""',
         'ai_naics_enrichment_metadata fact not written for these businesses (Gap G4).'],
        ['ai_hallucinated',
         'False',
         'AI returned a valid code (561499) — no hallucination.'],
        ['pipeline_b_naics',
         'None',
         'datascience.customer_files.primary_naics_code = NULL. '
         'Pipeline B also has no NAICS because both ZI and EFX had no match.'],
        ['pipeline_b_has_real_naics',
         'False',
         'Confirmed: Pipeline B shows no real NAICS for these businesses.'],
    ],
    col_widths=[2.5, 2.0, 5.0],
    fs=8.5,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 8 — NOTEBOOK STEP 7: CONFIRMED SYSTEM GAPS
# ════════════════════════════════════════════════════════════════════════════

H1('Section 8 — Notebook Step 7: Confirmed System Gaps (G1-G6)')

body(
    'Based on the real data analysis, six confirmed gaps in the current Worth AI pipeline '
    'were identified. Each gap is documented with the root cause, affected table, '
    'pipeline stage, and number of businesses impacted.'
)
spacer(4)

H3('Gap G1: Entity Matching Fails to Find ZI/EFX/OC Records')
gap(
    'G1: Entity matching (heuristic Levenshtein + XGBoost model entity_matching_20250127 v1) '
    'found NO vendor record above the minimum threshold for 5,348 businesses. '
    'This is the root cause of 99.98% of all 561499 cases.'
)
tbl(
    ['G1 Details', 'Value'],
    [
        ['Businesses affected', '5,348 (Scenario C — all zero-vendor businesses)'],
        ['Pipeline affected', 'Both Pipeline A and Pipeline B'],
        ['Minimum threshold', 'similarity_index >= 45 (heuristic); XGBoost probability >= 0.80'],
        ['Tables with missing data',
         'datascience.zoominfo_matches_custom_inc_ml: NO ROW\n'
         'datascience.efx_matches_custom_inc_ml: NO ROW\n'
         'datascience.oc_matches_custom_inc_ml: NO ROW\n'
         'datascience.customer_files: primary_naics_code = NULL'],
        ['Why matching fails',
         '(a) New registrations not yet in ZI/EFX bulk data\n'
         '(b) Micro-businesses/sole proprietors not in commercial databases\n'
         '(c) Generic/ambiguous names scoring below threshold\n'
         '(d) Address normalisation failures\n'
         '(e) Non-US businesses with limited ZI/EFX coverage'],
        ['Source code location',
         'run_worth_two_step.py (entity_matching/core/matchers/)\n'
         'smb_zoominfo_standardized_joined.sql (warehouse-service)\n'
         'smb_equifax_standardized_joined.sql (warehouse-service)'],
    ],
    col_widths=[2.5, 7.0],
    fs=9,
)

H3('Gap G2: AI Enrichment Does Not Use Web Search for Zero-Vendor Businesses')
gap(
    'G2: The web_search tool in aiNaicsEnrichment.ts is only enabled when a website URL '
    'is already known (params.website is set). For businesses with no vendor match '
    'and no website, the AI cannot search the web — it only has name + address.'
)
tbl(
    ['G2 Details', 'Value'],
    [
        ['Businesses affected',
         '~1,069 est. (20% of Scenario C — businesses where web search would find info)'],
        ['Pipeline affected', 'Pipeline A only (AI enrichment step)'],
        ['Code location', 'aiNaicsEnrichment.ts: getPrompt() method'],
        ['Current behaviour',
         'if (params.website) { enable web_search } else { no web_search }'],
        ['Problem',
         'For businesses with no vendor match and no website, web_search is never enabled. '
         'GPT-5-mini has a web_search tool but the TypeScript code blocks its use.'],
        ['Tables with missing data',
         'integration_data.request_response: AI stored (web_search was not used)\n'
         'rds_warehouse_public.facts: naics_code = "561499"'],
    ],
    col_widths=[2.5, 7.0],
    fs=9,
)

H3('Gap G3: AI Prompt Has No Name Keyword Classification Logic')
gap(
    'G3: The AI system prompt instructs "If there is no evidence at all, return naics_code 561499 '
    'as a last resort." It does NOT instruct the AI to check business name keywords '
    'before giving up. A business named "Lisa\'s Nail Salon" receives 561499 even though '
    'the name unambiguously indicates NAICS 812113 (Nail Salons).'
)
tbl(
    ['G3 Details', 'Value'],
    [
        ['Businesses affected',
         '~1,604 est. (30% of Scenario C — businesses with name-deducible industry)'],
        ['Pipeline affected', 'Pipeline A only (AI enrichment prompt)'],
        ['Code location', 'aiNaicsEnrichment.ts: getPrompt() — system prompt string (~line 104-115)'],
        ['Current prompt rule',
         '"If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."'],
        ['Problem',
         'The prompt has no explicit step to classify from name keywords before returning 561499. '
         'GPT-5-mini would recognise "nail salon" as NAICS 812113 if instructed, '
         'but the current prompt does not require this check.'],
        ['Examples of recoverable names',
         '"Lisa\'s Nail Salon" → 812113, "First Baptist Church" → 813110, '
         '"Tony\'s Pizza" → 722511, "ABC Dental Care" → 621210, '
         '"Mike\'s Plumbing & Electric" → 238210'],
        ['Tables affected', 'rds_warehouse_public.facts: naics_code = "561499" despite name indicating sector'],
    ],
    col_widths=[2.5, 7.0],
    fs=9,
)

H3('Gap G4: AI Enrichment Confidence Metadata Not Stored for Fallback Cases')
gap(
    'G4: The ai_naics_enrichment_metadata fact is never written when AI returns 561499. '
    'For all 5,349 businesses, confidence, reasoning, and website_summary are missing. '
    'The raw response IS in integration_data.request_response but the structured fact is lost.'
)
tbl(
    ['G4 Details', 'Value'],
    [
        ['Businesses affected', '5,349 (all 561499 businesses)'],
        ['Pipeline affected', 'Pipeline A (post-processing step in executePostProcessing())'],
        ['Code location',
         'aiNaicsEnrichment.ts: executePostProcessing() or the method that saves the metadata fact'],
        ['What is missing',
         'rds_warehouse_public.facts: name="ai_naics_enrichment_metadata" is never written\n'
         'Fields lost: ai_confidence, ai_reasoning, ai_website_summary, tools_used'],
        ['What IS stored',
         'integration_data.request_response: full GPT-5-mini response IS stored (platform_id=31). '
         'The raw JSON includes confidence and reasoning, but querying it requires '
         'parsing raw JSON rather than reading a structured fact.'],
        ['Impact',
         'Cannot monitor AI quality, track prompt improvement, or identify which businesses '
         'might benefit from re-enrichment as the prompt improves.'],
    ],
    col_widths=[2.5, 7.0],
    fs=9,
)

H3('Gap G5: MCC Fallback Description Is Customer-Facing Internal Text')
gap(
    'G5: The AI prompt causes GPT to return mcc_description = '
    '"Fallback MCC per instructions (no industry evidence to determine canonical MCC description)." '
    'This internal system note is displayed verbatim to customers in the admin portal.'
)
tbl(
    ['G5 Details', 'Value'],
    [
        ['Businesses affected', '5,349 (all 561499 businesses — all show this description)'],
        ['Pipeline affected', 'Pipeline A (AI enrichment prompt output)'],
        ['Code location',
         'aiNaicsEnrichment.ts: system prompt string — instructs AI to use this exact phrase'],
        ['Current mcc_description', '"Fallback MCC per instructions (no industry evidence to determine canonical MCC description)"'],
        ['Problem',
         'This text was intended as an internal system note to help developers diagnose fallback cases. '
         'It was never intended to be shown to customers. '
         'It reveals implementation details ("per instructions"), '
         'confirms the system has no information about the business, '
         'and provides no actionable guidance.'],
        ['Recommended replacement', '"Classification pending — insufficient public data available."'],
    ],
    col_widths=[2.5, 7.0],
    fs=9,
)

H3('Gap G6: Pipeline B Also Has No NAICS — Confirms Entity-Match Failure')
body(
    'Pipeline B (datascience.customer_files) applies only the ZI vs EFX winner rule '
    'and has no AI fallback. For these 5,349 businesses:'
)
lineage([
    'Pipeline B winner rule (from customer_table.sql):',
    '  CASE',
    '    WHEN zi.zi_match_confidence > efx.efx_match_confidence',
    '      THEN zi.naics_code  -- ZoomInfo NAICS',
    '    ELSE efx.naics_code   -- Equifax NAICS',
    '  END AS primary_naics_code',
    '',
    'For these 5,349 businesses:',
    '  zi.zi_match_confidence  = 0  (or null -- no ZI match row)',
    '  efx.efx_match_confidence = 0  (or null -- no EFX match row)',
    '  → CASE: 0 > 0 is False → EFX wins → efx.naics_code = null',
    '  → customer_files.primary_naics_code = NULL',
    '',
    'This means Pipeline B (batch analytics) sees the same empty match tables',
    'as Pipeline A (real-time). The entity-matching failure is not specific to one pipeline.',
])

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 8B — RECOVERY POTENTIAL (Step 7 continued)
# ════════════════════════════════════════════════════════════════════════════

H2('Recovery Potential Estimate (from Notebook Step 7)')

body(
    'The diagnostic estimated recovery potential by sub-categorising Scenario C into '
    'three groups based on how the NAICS might be obtained:'
)
spacer(4)

tbl(
    ['Category', 'Businesses', 'Pct', 'Approach', 'Recovery method'],
    [
        ['Scenario A: vendors have NAICS, AI overrode',
         '0', '0%', 'Apply vendor code directly', 'NOT observed in production data — no action needed'],
        ['Scenario B: 1-2 vendors have NAICS',
         '0', '0%', 'Apply vendor code with consensus', 'NOT observed in production data — no action needed'],
        ['Scenario C: name-deducible (est. 30%)',
         '~1,604', '~30%', 'Name keyword → NAICS (P1)',
         'Business name contains industry keywords. Fix P1: update AI prompt to check '
         'name keywords before returning 561499.'],
        ['Scenario C: web-findable (est. 20%)',
         '~1,069', '~20%', 'Open web search (P2)',
         'No vendor match, no clear name keyword, but Google Maps / LinkedIn / SOS '
         'would return NAICS if AI could search freely. Fix P2: enable web_search '
         'when website=null.'],
        ['Scenario C: genuinely unclassifiable (est. 50%)',
         '~2,675', '~50%', 'Accept 561499; fix description (P3)',
         'Holding companies, shell entities, brand-new registrations, businesses '
         'with no public footprint. 561499 is CORRECT. '
         'The only gap is the misleading MCC description (G5).'],
        ['Scenarios D/E/F: other causes',
         '1', '<1%', 'Manual investigation',
         'Scenario E: 1 business where AI was not triggered. '
         'Investigate via integration_data.request_response.'],
        ['TOTAL',
         '5,349', '100%', '', ''],
    ],
    col_widths=[2.8, 1.0, 0.7, 2.0, 3.0],
    fs=8.5,
)

body(
    'The recovery chart (bar chart) from Step 7 of the notebook showed:'
)
bullet('Two tall teal bars:', ' Scenario C name-deducible (1,604) and web-findable (1,069) — recoverable with P1+P2')
bullet('One large red bar:', ' Scenario C genuinely hard (2,675) — 561499 is correct, only description needs fixing')
bullet('Zero-height bars:', ' Scenarios A, B, D, E, F — absent or negligible')
spacer(4)

info(
    'KEY REFRAME: The goal should NOT be to eliminate NAICS 561499. '
    'The goal should be:\n'
    '(1) Ensure 561499 only appears for businesses that are GENUINELY unclassifiable.\n'
    '(2) Recover the ~2,673 businesses (50%) where name or web data could provide a real code.\n'
    '(3) Fix the MCC description so customers see useful language, not internal debug text.\n\n'
    'After fixes P1+P2+P3, the expected outcome:\n'
    '  - ~2,673 businesses remain with 561499 (correct, genuinely unclassifiable)\n'
    '  - ~1,604 businesses receive name-keyword-derived NAICS (e.g., 812113, 813110, 722511)\n'
    '  - ~535-1,069 businesses receive web-search-derived NAICS (50-100% web success rate)\n'
    '  - ALL 5,349 businesses show a clean, customer-appropriate MCC description'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 9 — NOTEBOOK STEP 8: PIPELINE WORKFLOW DIAGRAM
# ════════════════════════════════════════════════════════════════════════════

H1('Section 9 — Notebook Step 8: Current Pipeline — How 561499 Is Produced')

body(
    'The following annotated workflow shows the exact sequence of steps in the current '
    'Worth AI pipeline for a business that ends up with NAICS 561499. '
    'Each gap (G1-G6) is annotated at the point where it occurs.'
)
spacer(4)

H2('Pipeline A — Real-Time (Integration Service)')
lineage([
    'T+0:00  Business submitted via POST /businesses/customers/{customerID}',
    '         data_cases created, data_businesses created',
    '        |',
    'T+0:01  Integration-service fires vendor lookups in parallel:',
    '          Middesk  (platform_id=16, weight=2.0) → Live SOS API call',
    '            → No SOS filing found OR SIC/NAICS not in SOS data for this business',
    '          OC       (platform_id=23, weight=0.9) → Redshift: oc_matches_custom_inc_ml',
    '            → [!! GAP G1] NO MATCH FOUND (similarity_index < 45 for all OC candidates)',
    '          ZoomInfo (platform_id=24, weight=0.8) → Redshift: zoominfo_matches_custom_inc_ml',
    '            → [!! GAP G1] NO MATCH FOUND',
    '          Equifax  (platform_id=17, weight=0.7) → Redshift: efx_matches_custom_inc_ml',
    '            → [!! GAP G1] NO MATCH FOUND',
    '          Trulioo  (platform_id=38, weight=0.8) → Live KYB API call',
    '            → NAICS field empty or 4-digit only (POLLUTED — not a valid 6-digit NAICS)',
    '          SERP     (platform_id=22)              → Web scraping',
    '            → May return business description but not a structured NAICS code',
    '        |',
    'T+0:15  Fact Engine evaluates naics_code fact:',
    '         factWithHighestConfidence() + weightedFactSelector()',
    '         Trigger condition: naics_code has < minimumSources (1) non-AI source with NAICS',
    '         → All non-AI sources have null NAICS → AI enrichment triggered',
    '        |',
    'T+0:16  AI enrichment (AINaicsEnrichment.ts) runs GPT-5-mini:',
    '         AI receives:',
    '           business_name: "[name from applicant form]"',
    '           primary_address: "[address from applicant form]"',
    '           naics_code: null (no vendor produced one)',
    '           website: null (not provided; SERP may not have found URL)',
    '         [!! GAP G2] web_search NOT enabled (website is null)',
    '         [!! GAP G3] prompt has no name keyword classification step',
    '         System prompt rule: "If no evidence → return 561499 and 5614 as last resort"',
    '        |',
    'T+0:17  GPT-5-mini response:',
    '         naics_code: "561499"',
    '         mcc_code: "5614"',
    '         confidence: "LOW"  (or similar — but this is NEVER saved to facts)',
    '         mcc_description: "Fallback MCC per instructions..." [!! GAP G5]',
    '        |',
    'T+0:18  Post-processing: validateNaicsCode("561499")',
    '         → 561499 is in core_naics_code → accepted (not stripped)',
    '         [!! GAP G4] ai_naics_enrichment_metadata fact NOT written',
    '        |',
    'T+0:19  Kafka: facts.v1 → CALCULATE_BUSINESS_FACTS event',
    '         warehouse-service writes to rds_warehouse_public.facts:',
    '           name="naics_code" value={"value":"561499","source":{"platformId":31}}',
    '           name="mcc_code"   value={"value":"5614","source":{"platformId":31}}',
    '           name="mcc_description" value="Fallback MCC per instructions..." [!! G5]',
    '         case-service writes to rds_cases_public.data_businesses:',
    '           naics_id → FK to core_naics_code WHERE code="561499"',
    '           mcc_id   → FK to core_mcc_code WHERE code="5614"',
    '        |',
    'T+0:20  Customer sees: NAICS 561499 / MCC 5614 in admin.joinworth.com KYB tab',
])

H2('Pipeline B — Batch Redshift (Runs Separately)')
lineage([
    '[!! GAP G6] Pipeline B also shows no NAICS:',
    '',
    '  SQL (customer_table.sql):',
    '    CASE',
    '      WHEN zi.zi_match_confidence > efx.efx_match_confidence THEN zi.naics_code',
    '      ELSE efx.naics_code',
    '    END AS primary_naics_code',
    '',
    '  For all 5,349 businesses:',
    '    zi.zi_match_confidence  = NULL or 0 → ZI match table has no row',
    '    efx.efx_match_confidence = NULL or 0 → EFX match table has no row',
    '    → primary_naics_code = NULL (not 561499 — Pipeline B has no AI fallback)',
    '',
    '  CONCLUSION: Entity matching failure is confirmed across both pipelines.',
    '  Pipeline A stores 561499 (via AI fallback).',
    '  Pipeline B stores NULL (no fallback mechanism).',
    '  The root cause is the same: no vendor match found for these businesses.',
])

H2('Gap Summary Table')
tbl(
    ['Gap', 'Description', 'Pipeline', 'Where in pipeline', 'Businesses'],
    [
        ['G1', 'Entity matching finds no ZI/EFX/OC record above threshold',
         'Both A & B', 'Vendor lookup step (T+0:01)', '5,348'],
        ['G2', 'AI web_search blocked when website=null',
         'Pipeline A', 'AI enrichment getPrompt() (T+0:16)', '~1,069 recoverable'],
        ['G3', 'AI prompt has no name keyword classification step',
         'Pipeline A', 'AI enrichment system prompt (T+0:16)', '~1,604 recoverable'],
        ['G4', 'ai_naics_enrichment_metadata fact not written for 561499 cases',
         'Pipeline A', 'Post-processing executePostProcessing() (T+0:18)', '5,349 — monitoring gap'],
        ['G5', '"Fallback MCC per instructions" shown verbatim to customers',
         'Pipeline A', 'AI prompt mcc_description output (T+0:17)', '5,349 — UX issue'],
        ['G6', 'Pipeline B also has NULL NAICS — confirms entity match failure',
         'Pipeline B', 'customer_table.sql primary_naics_code (batch run)', '5,349'],
    ],
    col_widths=[0.6, 3.2, 1.2, 2.3, 2.2],
    fs=8.5,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 10 — PRIORITISED FIX ROADMAP
# ════════════════════════════════════════════════════════════════════════════

H1('Section 10 — Prioritised Fix Roadmap')

tbl(
    ['Priority', 'Fix', 'Gaps addressed', 'Est. businesses recovered', 'Effort', 'File / Location'],
    [
        ['P1',
         'Name keyword → NAICS inference\n'
         'Add to AI system prompt: classify from business name keywords '
         'before returning 561499. '
         'Church → 813110, Salon → 812113, Restaurant → 722511, etc.',
         'G3',
         '~1,604 (30%)',
         'Very Low\n(string change in prompt)',
         'aiNaicsEnrichment.ts\ngetPrompt() system prompt\n'
         '(consensus.py detect_name_keywords()\nhas 80+ mappings as reference)'],
        ['P2',
         'Enable open web search for zero-vendor businesses\n'
         'When website=null AND no vendor match, enable unrestricted web_search. '
         'Search: "[business name] [city] [state]".',
         'G2',
         '~535-1,069 (10-20%)',
         'Low\n(3 lines TypeScript)',
         'aiNaicsEnrichment.ts\ngetPrompt()'],
        ['P3',
         'Fix MCC description message\n'
         'Replace "Fallback MCC per instructions (no industry evidence...)" '
         'with "Classification pending — insufficient public data available."',
         'G5',
         '5,349 (100%) — UX fix',
         'Very Low\n(string change)',
         'aiNaicsEnrichment.ts\nsystem prompt ~line 114'],
        ['P4',
         'Store AI enrichment metadata even for fallback cases\n'
         'When AI returns 561499, still write the ai_naics_enrichment_metadata fact '
         'with confidence, reasoning, and tools_used.',
         'G4',
         '0 businesses recovered;\nenables monitoring',
         'Low\n(TypeScript fact write)',
         'aiNaicsEnrichment.ts\nexecutePostProcessing()'],
        ['P5',
         'Improve entity matching coverage\n'
         '(a) Increase ZI/EFX bulk data refresh frequency\n'
         '(b) Add DBA name as matching field\n'
         '(c) Add Liberty data (more micro-business coverage)\n'
         '(d) Lower threshold with careful false-positive monitoring',
         'G1, G6',
         'Unknown (depends on data)',
         'Medium-High\n(data engineering + retraining)',
         'smb_zoominfo_standardized_joined.sql\nsmb_equifax_standardized_joined.sql\nentity_matching_20250127 v1'],
        ['P6',
         'Deploy consensus.py + XGBoost API (future-proofing)\n'
         'When vendor matches DO exist (after P5 improves coverage), '
         'the consensus layer resolves conflicts automatically.',
         'none now; G1 after P5',
         '0 now; future Scenario B businesses',
         'Medium\n(TypeScript integration)',
         'aiNaicsEnrichment.ts executeDeferrableTask()\nnaics_mcc_classifier/api.py (built)'],
    ],
    col_widths=[0.7, 3.1, 1.2, 1.7, 1.3, 2.5],
    fs=8.5,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 11 — IMPLEMENTATION PLAN
# ════════════════════════════════════════════════════════════════════════════

H1('Section 11 — Implementation Plan')

H2('Fix P1 + P3: AI System Prompt Changes (Highest ROI, Lowest Effort)')
body(
    'Both P1 and P3 require only changes to the system prompt string in '
    'integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts. '
    'No TypeScript logic changes, no new infrastructure, no model retraining.'
)
lineage([
    '// CURRENT system prompt (line ~104-115 in aiNaicsEnrichment.ts):',
    '"If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."',
    '',
    '// UPDATED system prompt (P1 + P3 combined):',
    '"CLASSIFICATION RULES — follow these steps IN ORDER before returning 561499:',
    '',
    ' STEP 1: Check business name keywords.',
    '   If the name clearly indicates an industry, classify from the name with MED confidence:',
    '     nail/salon/spa/beauty    → 812113 (Nail Salons) or 812112 (Beauty Salons)',
    '     restaurant/pizza/cafe/diner/grill/sushi → 722511 (Full-Service Restaurants)',
    '     dental/dentist/orthodont → 621210 (Offices of Dentists)',
    '     church/ministry/chapel/temple/mosque/fellowship → 813110 (Religious Organizations)',
    '     construction/contractor/plumb/electrician/hvac/roofing → 238XXX (Specialty Contractors)',
    '     attorney/law firm/legal  → 541110 (Offices of Lawyers)',
    '     landscap/lawn/garden     → 561730 (Landscaping Services)',
    '     daycare/childcare/preschool → 624410 (Child Day Care Services)',
    '     auto repair/mechanic/tire → 811111 (General Automotive Repair)',
    '     pharmacy/drug store      → 446110 (Pharmacies and Drug Stores)',
    '   If matched: return that NAICS code with confidence=MED.',
    '',
    ' STEP 2: If website is not provided, search the web.',
    '   Use web_search to find: \"[business name] [city] [state]\".',
    '   If results found: classify from the website or listing content.',
    '',
    ' STEP 3: Only return naics_code 561499 if ALL of the following are true:',
    '   - No vendor NAICS codes available',
    '   - Business name contains no industry-specific keywords',
    '   - Web search found no public information',
    '   - Name is genuinely ambiguous (e.g., Global Holdings, Premier Solutions)',
    '',
    ' STEP 4: When returning MCC 5614, set mcc_description to:',
    '   \"Classification pending - insufficient public data available.\"',
    '   (NOT \"Fallback MCC per instructions...\")"',
])

H2('Fix P2: Enable Web Search for Zero-Vendor Businesses')
lineage([
    '// In aiNaicsEnrichment.ts getPrompt() — ADD this block:',
    '',
    'const hasVendorNaics = params.naics_code && params.naics_code !== "561499";',
    'const hasWebsite = !!params.website;',
    '',
    '// NEW: Enable open web search when no vendor match AND no website',
    'if (!hasVendorNaics && !hasWebsite) {',
    '  // Zero-evidence case: enable unrestricted web search',
    '  responseCreateWithInput.input.push({',
    '    role: "system",',
    '    content: `Since no vendor data is available for this business, ` +',
    '             `search the web for "${params.business_name} ` +',
    '             `${params.state}" to find any public information.`',
    '  });',
    '  // Ensure web_search tool is enabled',
    '  if (!responseCreateWithInput.tools) {',
    '    responseCreateWithInput.tools = [{ type: "web_search", search_context_size: "medium" }];',
    '    responseCreateWithInput.tool_choice = "auto";',
    '  }',
    '}',
    '',
    '// EXISTING website-based search still runs when params.website is set:',
    'else if (params.website) {',
    '  // ... existing domain-restricted web_search logic unchanged ...',
    '}',
])

H2('Fix P4: Always Store AI Enrichment Metadata')
lineage([
    '// In aiNaicsEnrichment.ts — ensure metadata is saved even for 561499 returns:',
    '',
    '// In executePostProcessing() or wherever facts are written after AI response:',
    'const enrichmentMetadata = {',
    '  naics_returned:       response.naics_code,',
    '  mcc_returned:         response.mcc_code,',
    '  confidence:           response.confidence,',
    '  reasoning:            response.reasoning,',
    '  website_summary:      response.website_summary ?? null,',
    '  tools_used:           response.tools_used ?? [],',
    '  is_fallback:          response.naics_code === "561499",',
    '  timestamp:            new Date().toISOString(),',
    '};',
    '',
    '// Write regardless of whether naics_code is 561499:',
    'await this.saveFactToWarehouse(',
    '  "ai_naics_enrichment_metadata",',
    '  JSON.stringify(enrichmentMetadata),',
    '  31,  // platform_id = AI',
    ');',
    '// This writes to: rds_warehouse_public.facts',
    '// name="ai_naics_enrichment_metadata"',
    '// Enables quality monitoring via diagnostic queries',
])

H2('Expected Outcomes After All Fixes')
tbl(
    ['Metric', 'Current', 'After P1+P2+P3', 'After P1-P6'],
    [
        ['Businesses with genuine 561499 (correct classification)',
         '~2,675', '~2,675', '~2,675'],
        ['Businesses with 561499 due to missing name keyword logic',
         '~1,604', '~0\n(name keywords applied)', '~0'],
        ['Businesses with 561499 due to blocked web search',
         '~1,069', '~535\n(50% web success est.)', '~535'],
        ['Total 561499 businesses',
         '5,349', '~3,210 (-40%)', '~3,210 (-40%)'],
        ['MCC "Fallback MCC per instructions" message shown',
         '5,349', '0\n(message fixed)', '0'],
        ['AI enrichment metadata stored in facts',
         '~0%', '~100%', '~100%'],
        ['Entity matching coverage',
         'baseline', 'baseline', 'improved (P5)'],
        ['XGBoost consensus model active for conflict resolution',
         'not deployed', 'not deployed', 'deployed (P6)'],
    ],
    col_widths=[4.2, 1.6, 1.8, 1.9],
    fs=9,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 12 — CONCLUSIONS
# ════════════════════════════════════════════════════════════════════════════

H1('Section 12 — Conclusions')

ok(
    'CONCLUSION 1: The 561499 problem is fully understood and confirmed by production data.\n\n'
    '5,349 businesses (7.7%) show NAICS 561499. 99.98% (5,348) have one root cause: '
    'zero vendor NAICS signals — ZoomInfo, Equifax, and OpenCorporates all failed '
    'to match these businesses in the entity-matching step. '
    'The AI enrichment correctly followed its system prompt and returned 561499 '
    'as the last resort. This is a coverage gap in entity matching, not an AI failure.'
)

ok(
    'CONCLUSION 2: The highest-impact fixes require NO model changes and NO new infrastructure.\n\n'
    'Fixes P1 (name keyword classification) and P3 (MCC description) are string changes '
    'to the AI system prompt in aiNaicsEnrichment.ts. '
    'Fix P2 (enable web search) requires 3 lines of TypeScript in getPrompt(). '
    'Together, P1+P2+P3 could recover ~2,673 businesses (50%) and fix the UX issue '
    'for all 5,349 businesses. No XGBoost model, no Redshift tables, '
    'no new infrastructure required.'
)

gap(
    'CONCLUSION 3: The XGBoost consensus model is NOT the solution for these 5,349 businesses.\n\n'
    'The consensus model reads vendor NAICS signals (ZoomInfo, Equifax, OpenCorporates). '
    'For businesses with zero vendor signals, the model has no inputs and cannot predict. '
    'The model is the correct tool for future Scenario B businesses '
    '(when vendor matches exist but disagree) — which will emerge as entity matching '
    'coverage improves after fix P5.'
)

warn(
    'CONCLUSION 4: Critical data quality gap — AI enrichment metadata is not stored.\n\n'
    'The ai_naics_enrichment_metadata fact is empty for all 5,349 businesses. '
    'This means we cannot:\n'
    '  - Monitor AI classification quality over time\n'
    '  - Track which businesses were re-classified after prompt improvements\n'
    '  - Identify businesses where confidence is improving (and remove 561499)\n'
    '  - Understand why the AI chose 561499 for a specific business\n\n'
    'Fix P4 (always store metadata) is critical for long-term system health. '
    'The raw AI response IS stored in integration_data.request_response, '
    'but querying it requires parsing raw JSON rather than reading a structured fact.'
)

info(
    'REFRAME FOR STAKEHOLDERS: Not all 5,349 businesses are "wrong."\n\n'
    'Approximately 2,675 businesses (50%) should permanently show NAICS 561499. '
    'These are holding companies, shell entities, brand-new registrations, '
    'and businesses with no public footprint. The classification cannot be improved '
    'for these businesses with available data. '
    'The correct outcome for stakeholders:\n'
    '  (a) Reduce 561499 by 50% (from 5,349 to ~2,675) with P1+P2 fixes\n'
    '  (b) Ensure 561499 only appears when genuinely no classification is possible\n'
    '  (c) Replace the misleading MCC description with clear, honest language (P3)\n'
    '  (d) Build monitoring capability to track improvement over time (P4)'
)

spacer(8)
body('Data sources used in this analysis:', bold=True, size=9.5)
bullet('rds_warehouse_public.facts',
       ' — current NAICS/MCC codes, winning source platform_id, AI enrichment metadata')
bullet('datascience.zoominfo_matches_custom_inc_ml',
       ' → zoominfo.comp_standard_global (NAICS signals)')
bullet('datascience.efx_matches_custom_inc_ml',
       ' → warehouse.equifax_us_latest (NAICS signals)')
bullet('datascience.oc_matches_custom_inc_ml',
       ' → warehouse.oc_companies_latest (NAICS signals)')
bullet('datascience.customer_files',
       ' — Pipeline B NAICS winner (primary_naics_code)')
bullet('integration_data.request_response',
       ' — raw AI enrichment responses (platform_id=31)')
spacer(4)

body('Source code files referenced:', bold=True, size=9.5)
bullet('aiNaicsEnrichment.ts',
       ' — integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts')
bullet('customer_table.sql',
       ' — warehouse-service/datapooler/.../tables/customer_table.sql')
bullet('smb_zoominfo_standardized_joined.sql',
       ' — warehouse-service/datapooler/.../tables/')
bullet('smb_equifax_standardized_joined.sql',
       ' — warehouse-service/datapooler/.../tables/')
bullet('consensus.py',
       ' — naics_mcc_classifier/consensus.py (already built; 80+ name keyword mappings)')
bullet('diagnostic.py',
       ' — naics_mcc_classifier/diagnostic.py (this analysis engine)')
bullet('NAICS_MCC_Fallback_RootCause_Analysis.ipynb',
       ' — naics_mcc_classifier/ (source of all charts and results in this report)')

# ── Save ──────────────────────────────────────────────────────────────────────
out = ('/workspace/AI-Powered-NAICS-Industry-Classification-Agent/'
       'naics_mcc_classifier/NAICS_MCC_Fallback_Root_Cause_Report.docx')
doc.save(out)
size_kb = round(os.path.getsize(out)/1024, 1)
print(f'Saved  : {out}')
print(f'Size   : {size_kb} KB')
print('Ready  : Import into Google Docs via File > Import')
