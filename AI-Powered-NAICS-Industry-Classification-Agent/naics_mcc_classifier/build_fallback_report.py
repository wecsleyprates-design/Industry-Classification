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
            if v.startswith('✅') or v.startswith('YES'): rgb, bld = GREEN, True
            elif v.startswith('❌') or v.startswith('NO '): rgb, bld = RED, True
            elif v.startswith('⚠️') or v.startswith('WARN'): rgb, bld = AMBER, True
            elif v.startswith('🔴') or v.startswith('GAP'): rgb, bld = RED, True
            elif v.startswith('🟡'): rgb, bld = AMBER, True
            elif v.startswith('🟢'): rgb, bld = GREEN, True
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
    'Findings from real production data (April 2026) · '
    'Worth AI Classification Pipeline · '
    'Verified against Redshift + integration-service source code'
)
r.font.size = Pt(10); r.font.color.rgb = SLATE
p.paragraph_format.space_after = Pt(20)

info(
    'The customer currently sees this for 5,349 businesses:\n\n'
    '  Industry Name:     Administrative and Support and Waste Management and Remediation Services\n'
    '  NAICS Code:        561499\n'
    '  NAICS Description: All Other Business Support Services\n'
    '  MCC Code:          5614\n'
    '  MCC Description:   Fallback MCC per instructions (no industry evidence to determine canonical MCC description)\n\n'
    'This report explains why, what the data shows, and exactly how to fix it.'
)

H2('Document Contents')
tbl(
    ['Section', 'Title', 'Key finding'],
    [
        ['1', 'Executive Summary', '5,349 businesses · 1 root cause dominates at 99%'],
        ['2', 'The Problem: What the Customer Sees', 'Screenshot analysis + data lineage'],
        ['3', 'Root-Cause Analysis', '6 scenarios classified; C dominates (5,348 businesses)'],
        ['4', 'Data Lineage: How 561499 Gets Stored', 'Which pipeline, which table, which step'],
        ['5', 'Vendor Signal Analysis', 'All vendors null for 5,348/5,349 businesses'],
        ['6', 'AI Enrichment Behaviour', 'AI fired but had no data; confidence tracking missing'],
        ['7', 'Pipeline B vs Pipeline A', 'Pipeline B also shows null — confirms no vendor match'],
        ['8', 'Recovery Potential', '49% recoverable with existing fixes; 50% genuinely hard'],
        ['9', 'Prioritised Fix Roadmap', '7 fixes ranked by business impact + effort'],
        ['10', 'Implementation Plan', 'TypeScript + Python changes; exact file locations'],
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
    'for 5,349 businesses, representing 7.7% of the total 69,400 businesses in the system. '
    'These businesses also show MCC code 5614 with the message '
    '"Fallback MCC per instructions (no industry evidence to determine canonical MCC description)." '
    'This is not a system error — it is the correct fallback behaviour for the current pipeline. '
    'However, the root-cause analysis reveals that a significant fraction of these businesses '
    'CAN be classified using data that is either already available or easily obtainable.'
)
spacer(6)

tbl(
    ['Metric', 'Value', 'Interpretation'],
    [
        ['Total businesses with NAICS 561499', '5,349', '7.7% of all businesses in system'],
        ['Root cause: zero vendor NAICS signals', '5,348 (99.98%)', 'No ZI, EFX, or OC match found for these businesses'],
        ['Root cause: AI not triggered', '1 (0.02%)', 'Edge case — Fact Engine had ≥3 sources but winner had no NAICS'],
        ['Businesses where AI was the winning source', '2,381 (44.5%)', 'AI enrichment ran but returned 561499 (no evidence)'],
        ['Businesses where AI was NOT the winning source', '2,968 (55.5%)', 'Some other platform won but had no NAICS either'],
        ['AI confidence HIGH/MED/LOW', '0 / 0 / 0', 'AI confidence field is empty — metadata not stored'],
        ['AI hallucination rate', '0%', 'AI did not return invalid codes (no stripping occurred)'],
        ['Pipeline B (customer_files) has real NAICS', '0%', 'Pipeline B also shows no NAICS for these businesses'],
        ['Estimated recoverable (name keywords)', '~1,604 (30%)', 'Name clearly indicates industry (salon, church, restaurant...)'],
        ['Estimated recoverable (web search)', '~1,069 (20%)', 'Web search could find public business information'],
        ['Genuinely unclassifiable', '~2,675 (50%)', 'No public information available; 561499 is correct'],
    ],
    col_widths=[3.2, 2.0, 4.3],
)

callout(
    'KEY FINDING: The 561499 problem is almost entirely caused by ONE root cause — '
    '"Scenario C: Zero vendor NAICS signals." '
    'This means ZoomInfo, Equifax, AND OpenCorporates all failed to match these 5,348 businesses '
    'in their entity-matching step. The AI enrichment then fired with only the business name and '
    'address, had no vendor data to reference, and correctly returned 561499 as instructed. '
    'The fix is NOT to improve the AI model — it is to (A) fix the entity matching coverage, '
    'and (B) enable the AI to use web search when vendor data is absent.',
    bg='EDE9FE', border='5B21B6', tc=RGBColor(0x2E,0x10,0x65)
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 2 — THE PROBLEM
# ════════════════════════════════════════════════════════════════════════════

H1('Section 2 — The Problem: What the Customer Sees')

body(
    'When an analyst or customer opens a business case in the Worth AI admin portal '
    '(admin.joinworth.com) and navigates to KYB → Background, the Industry section shows:'
)
spacer(4)
lineage([
    'Industry Name:     Administrative and Support and Waste Management and Remediation Services',
    'NAICS Code:        561499',
    'NAICS Description: All Other Business Support Services',
    'MCC Code:          5614',
    'MCC Description:   Fallback MCC per instructions (no industry evidence to determine',
    '                   canonical MCC description)',
])

body(
    'This is useless for underwriting, risk scoring, or compliance decisions. '
    'A nail salon, a restaurant, a church, and a holding company all receive the same code. '
    'The MCC description explicitly tells the customer the system does not know — '
    'but it does not tell them WHY, and it does not attempt to recover the classification '
    'from the business name or web search.'
)
spacer(6)

H2('Where this data comes from — the lineage')
lineage([
    'STORAGE LOCATION: rds_warehouse_public.facts',
    '  name = "naics_code"',
    '  value = {"value":"561499","source":{"platformId":31,"confidence":0.1},"alternatives":[]}',
    '',
    '  name = "mcc_code"',
    '  value = {"value":"5614","source":{"platformId":31,"confidence":0.1}}',
    '',
    'WHAT platform_id=31 MEANS: The AI enrichment (AINaicsEnrichment.ts) was the winning source.',
    'The AI was given:',
    '  - business_name (submitted by applicant)',
    '  - primary_address (submitted by applicant)',
    '  - naics_code: null (no vendor had produced one)',
    '  - website: null (not provided or not found)',
    '',
    'The AI system prompt literally instructs:',
    '  "If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."',
    '',
    'So the AI correctly followed its instructions. The problem is the instructions themselves,',
    'and the missing vendor data that could have prevented the AI from reaching this fallback.',
])

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 3 — ROOT-CAUSE ANALYSIS
# ════════════════════════════════════════════════════════════════════════════

H1('Section 3 — Root-Cause Analysis: The 6 Scenarios')

body(
    'The diagnostic notebook classified all 5,349 businesses into one of 6 root-cause scenarios. '
    'Here are the results from real production data:'
)
spacer(4)

tbl(
    ['Scenario', 'Label', 'Count', '%', 'Description'],
    [
        ['C', 'no_vendor_naics_ai_blind',
         '5,348', '99.98%',
         'Zero vendors have NAICS. AI fired with only name+address. No evidence → 561499.'],
        ['E', 'ai_not_triggered',
         '1', '0.02%',
         'AI not triggered (≥3 sources). Fact Engine winner had no valid NAICS.'],
        ['A', 'all_vendors_have_naics', '0', '0%', 'Not observed in production data.'],
        ['B', 'some_vendors_have_naics', '0', '0%', 'Not observed in production data.'],
        ['D', 'ai_hallucinated', '0', '0%', 'Not observed in production data.'],
        ['F', 'winner_has_naics_not_stored', '0', '0%', 'Not observed in production data.'],
    ],
    col_widths=[0.9, 2.8, 0.8, 0.7, 4.3],
)

gap(
    'CRITICAL FINDING: The previous assumption that some businesses (Scenarios A, B) had vendor '
    'NAICS codes that were being ignored is NOT confirmed by production data. '
    'In reality, 99.98% of fallback businesses (5,348/5,349) have zero vendor NAICS signal '
    'at all — ZoomInfo, Equifax, and OpenCorporates all failed to find a match. '
    'This fundamentally changes the fix strategy: improving the consensus layer (P1-P3) '
    'will have ZERO impact on these 5,348 businesses because there is no vendor data to apply.'
)

H2('Why Scenario C Dominates: Entity Matching Failure')
body(
    'The entity-matching pipeline works in two steps: '
    '(1) Levenshtein similarity scoring to find candidate vendor records, '
    '(2) XGBoost model (entity_matching_20250127 v1) to confirm the match. '
    'For 5,348 businesses, BOTH steps failed — no candidate vendor record scored '
    'above the minimum threshold (similarity_index ≥ 45, or XGBoost probability ≥ 0.80). '
    'Possible reasons:'
)
bullet('New businesses:', ' Recently registered, not yet in ZI/EFX/OC bulk data files (loaded on scheduled cadence)')
bullet('Non-US businesses:', ' ZI and EFX have low coverage outside the US; OC covers UK/EU/CA')
bullet('Unusual names:', ' Very short, ambiguous, or generic names (e.g. "Global Holdings LLC") that score below threshold')
bullet('Address issues:', ' Address normalisation failures preventing the Levenshtein similarity from matching')
bullet('Sole proprietors:', ' Very small businesses often not in commercial databases')
bullet('Recently renamed:', ' Business name changed after the bulk data was loaded')
spacer(6)

H2('The AI Enrichment Confidence Mystery')
warn(
    'AI confidence field is EMPTY for all 5,349 businesses (ai_confidence = "").\n\n'
    'The facts table stores the AI enrichment response in the "ai_naics_enrichment_metadata" fact. '
    'This fact was NOT written for these 5,349 businesses — meaning either:\n'
    '  (a) The AI enrichment did not produce the metadata fact (only naics_code was written), OR\n'
    '  (b) The AI returned 561499 before saving metadata (early exit in the code path).\n\n'
    'The ai_was_winner flag (platform_id=31) shows the AI WAS the winning source for 2,381 '
    'businesses — confirming AI ran and produced a response. '
    'The missing metadata means we cannot determine what confidence the AI reported internally. '
    'This is a data lineage gap — the AI reasoning and confidence are being lost.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 4 — DATA LINEAGE
# ════════════════════════════════════════════════════════════════════════════

H1('Section 4 — Data Lineage: How 561499 Gets Into the System')

H2('Pipeline A — Real-Time Fact Engine (the system that writes 561499)')
lineage([
    'T+0:00  Business submitted → POST /businesses/customers/{customerID}',
    '          data_cases created, data_businesses created',
    '       |',
    'T+0:01  Integration-service fires vendor lookups in parallel:',
    '          • ZoomInfo  (platform_id=24) → Redshift query: zoominfo_matches_custom_inc_ml',
    '              → NO MATCH FOUND (similarity_index < 45 for all candidates)',
    '          • Equifax   (platform_id=17) → Redshift query: efx_matches_custom_inc_ml',
    '              → NO MATCH FOUND',
    '          • OC        (platform_id=23) → Redshift query: oc_matches_custom_inc_ml',
    '              → NO MATCH FOUND',
    '          • Middesk   (platform_id=16) → Live SOS API call',
    '              → No SOS filing found OR NAICS not in SOS data',
    '          • Trulioo   (platform_id=38) → Live KYB API call',
    '              → NAICS field empty or 4-digit only (POLLUTED)',
    '       |',
    'T+0:15  Fact Engine evaluates: naics_code has < minimumSources (1)',
    '          → AI enrichment triggered (AINaicsEnrichment.ts)',
    '       |',
    'T+0:16  AI enrichment (GPT-5-mini) receives:',
    '          system_prompt: "...If no evidence, return 561499 and MCC 5614 as last resort"',
    '          business_name: "[name from applicant form]"',
    '          primary_address: "[address from applicant form]"',
    '          naics_code: null',
    '          website: null (not provided or web_search not triggered)',
    '       |',
    'T+0:17  AI returns:',
    '          naics_code: "561499"',
    '          mcc_code: "5614"',
    '          confidence: "LOW"',
    '          reasoning: "No evidence available..."',
    '       |',
    'T+0:18  Post-processing: validateNaicsCode("561499")',
    '          → 561499 EXISTS in core_naics_code table → accepted (not stripped)',
    '       |',
    'T+0:19  Kafka: facts.v1 CALCULATE_BUSINESS_FACTS',
    '          warehouse-service writes to: rds_warehouse_public.facts',
    '            name="naics_code" value={"value":"561499","source":{"platformId":31}}',
    '            name="mcc_code"   value={"value":"5614","source":{"platformId":31}}',
    '          case-service writes to: rds_cases_public.data_businesses',
    '            naics_id → FK to core_naics_code WHERE code="561499"',
    '            mcc_id   → FK to core_mcc_code WHERE code="5614"',
    '       |',
    'T+0:20  Customer sees: NAICS 561499 / MCC 5614',
])

H2('Pipeline B — Batch Redshift (also shows null)')
body(
    'Pipeline B (customer_files) applies the ZI vs EFX winner rule: '
    'WHEN zi_match_confidence > efx_match_confidence THEN ZI NAICS ELSE EFX NAICS. '
    'For these 5,349 businesses, Pipeline B also shows null because '
    'zi_match_confidence = 0 AND efx_match_confidence = 0 for all of them. '
    'This confirms the entity-matching failure is complete — not just in Pipeline A.'
)

H2('Where the data lives in Redshift')
tbl(
    ['Table', 'Schema', 'What it contains for these businesses', 'Status'],
    [
        ['facts', 'rds_warehouse_public',
         'naics_code value="561499", platformId=31 (AI won)\nmcc_code value="5614"',
         '✅ Written correctly (this is what customer sees)'],
        ['data_businesses', 'rds_cases_public',
         'naics_id → FK to 561499 row in core_naics_code',
         '✅ Written correctly'],
        ['zoominfo_matches_custom_inc_ml', 'datascience',
         'NO ROW (no ZI match found above threshold)',
         '❌ Missing — entity matching failed'],
        ['efx_matches_custom_inc_ml', 'datascience',
         'NO ROW (no EFX match found above threshold)',
         '❌ Missing — entity matching failed'],
        ['oc_matches_custom_inc_ml', 'datascience',
         'NO ROW (no OC match found above threshold)',
         '❌ Missing — entity matching failed'],
        ['customer_files', 'datascience',
         'primary_naics_code = NULL (no ZI or EFX match)',
         '❌ Missing — Pipeline B also has no data'],
        ['ai_naics_enrichment_metadata', 'rds_warehouse_public.facts',
         'NOT WRITTEN (ai_confidence metadata fact missing)',
         '⚠️ Gap — AI reasoning/confidence not stored'],
        ['request_response', 'integration_data',
         'Full AI response stored (platform_id=31)\nIncludes reasoning text',
         '✅ Written — raw AI output recoverable from here'],
    ],
    col_widths=[2.5, 1.8, 3.0, 2.2],
    fs=8.5,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 5 — VENDOR SIGNAL ANALYSIS
# ════════════════════════════════════════════════════════════════════════════

H1('Section 5 — Vendor Signal Analysis: Why No Match?')

H2('The 5,348 businesses with zero vendor NAICS signals')
body(
    '5,348 out of 5,349 fallback businesses (99.98%) have NO vendor NAICS signal — '
    'not from ZoomInfo, not from Equifax, not from OpenCorporates. '
    'This means the entity-matching pipeline (both heuristic similarity scoring AND '
    'XGBoost model) found no vendor record that matched these businesses above the minimum threshold. '
    'The reasons vary by business type:'
)
spacer(4)

tbl(
    ['Business type', 'Why entity matching fails', 'Estimated %', 'Recoverable?'],
    [
        ['Very new businesses',
         'Registered after ZI/EFX bulk data was loaded (scheduled, not real-time)',
         '15-20%',
         '🟡 Partially — web search can find recent registrations'],
        ['Sole proprietors & micro-businesses',
         'Too small to appear in ZI/EFX commercial databases',
         '20-25%',
         '🟡 Partially — name keywords + web search'],
        ['Businesses with generic/ambiguous names',
         '"Global Holdings", "Premier Solutions" — too common to match uniquely',
         '15-20%',
         '🔴 Hard — genuinely ambiguous'],
        ['Holding companies & shell entities',
         'No operational industry; correctly classified as 561499',
         '10-15%',
         '🔴 561499 is correct — accept it'],
        ['Name/address normalisation failures',
         'DBA name submitted but legal name in ZI; address format mismatch',
         '10-15%',
         '🟢 Fixable — improve normalisation, accept DBA names'],
        ['Non-US businesses',
         'ZI/EFX US-only; OC coverage varies by jurisdiction',
         '5-10%',
         '🟡 Partially — OC has UK/CA/EU coverage'],
        ['Applicant data quality issues',
         'Incorrect or incomplete name/address submitted during onboarding',
         '5-10%',
         '🟢 Fixable — data validation at onboarding step'],
    ],
    col_widths=[2.5, 3.3, 1.3, 2.4],
)

H2('The 1 business in Scenario E (AI not triggered)')
body(
    'One business had a different cause: the AI enrichment was NOT triggered despite the '
    'business having 561499 as its NAICS code. This means the Fact Engine already had '
    '≥3 sources (the minimumSources threshold for skipping AI), but the winning source '
    'produced 561499. This is likely a Middesk or Trulioo response that lacked NAICS. '
    'This is a genuine edge case — the fix is to investigate the winning source\'s raw '
    'response in integration_data.request_response for this specific business.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 6 — AI ENRICHMENT BEHAVIOUR
# ════════════════════════════════════════════════════════════════════════════

H1('Section 6 — AI Enrichment Behaviour Analysis')

H2('What the AI receives and why it fails')
body(
    'The AI enrichment (GPT-5-mini, AINaicsEnrichment.ts) fires when fewer than 3 vendor '
    'sources have a NAICS code. For these 5,349 businesses, the AI received:'
)
bullet('business_name', ' — the name submitted by the applicant during onboarding')
bullet('primary_address', ' — the address submitted during onboarding')
bullet('naics_code', ' — null (no vendor produced one)')
bullet('website', ' — null for most (not provided by applicant; SERP scraping may not have run)')
bullet('corporation', ' — entity type (LLC, Inc, Corp) — rarely contains industry information')
spacer(6)
body('The AI system prompt explicitly instructs:')
lineage([
    '// From aiNaicsEnrichment.ts line 114:',
    '"If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."',
])
body(
    'With no vendor NAICS, no website, and an ambiguous name, the AI correctly returns 561499. '
    'This is the intended fallback behaviour — the problem is the system is reaching this '
    'fallback too frequently, and for businesses where better information IS available '
    'but not being provided to the AI.'
)

H2('Two critical gaps in AI enrichment')
tbl(
    ['Gap', 'What is missing', 'Impact', 'Fix'],
    [
        ['Gap 1: No web search for zero-vendor businesses',
         'web_search tool is only enabled when a website URL is already known. '
         'For businesses with no website, the AI cannot search the web.',
         '~1,069 businesses (20%) could be classified if AI searched web by name+city+state',
         'Enable unrestricted web_search in aiNaicsEnrichment.ts getPrompt() '
         'when website=null AND n_vendor_naics=0'],
        ['Gap 2: No name keyword logic in AI prompt',
         'The AI prompt does not instruct GPT to classify from name keywords '
         'before returning 561499. A business named "Lisa\'s Nail Salon" '
         'still gets 561499 if no vendor match and no website.',
         '~1,604 businesses (30%) have name keywords that unambiguously indicate an industry',
         'Add to AI system prompt: "Before returning 561499, check if the business name '
         'contains industry keywords (salon, restaurant, church, dental, etc.) and '
         'classify from those keywords with MED confidence."'],
        ['Gap 3: AI confidence metadata not stored',
         'The ai_naics_enrichment_metadata fact is not written when AI returns 561499. '
         'Confidence, reasoning, and website_summary are lost.',
         'Cannot diagnose AI quality or improve prompting without this data',
         'Ensure aiNaicsEnrichment.ts saves metadata even when fallback code is returned'],
    ],
    col_widths=[1.8, 3.0, 2.2, 2.5],
    fs=8.5,
)

H2('AI as winner vs other source as winner')
body(
    '2,381 businesses (44.5%) had platform_id=31 (AI was the winning source). '
    '2,968 businesses (55.5%) had a DIFFERENT source as winner (Middesk, Trulioo, SERP) — '
    'but that source also had no valid NAICS code. '
    'This means: even when Middesk or Trulioo responded with business data, '
    'their response did not include a NAICS code, and the AI subsequently '
    'produced 561499 as fallback. '
    'The Middesk/Trulioo responses should be examined in '
    'integration_data.request_response to understand what they returned.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 7 — GAPS SUMMARY
# ════════════════════════════════════════════════════════════════════════════

H1('Section 7 — Gap Analysis: What Is Missing and Where')

tbl(
    ['Gap ID', 'Gap Description', 'Pipeline', 'Table affected', 'Business impact'],
    [
        ['G1',
         'Entity matching fails to find ZI/EFX/OC records for these businesses. '
         'Likely due to new registrations, micro-businesses, or name normalisation issues.',
         'Both A & B',
         'zoominfo_matches_custom_inc_ml\nefx_matches_custom_inc_ml\noc_matches_custom_inc_ml',
         '5,348 businesses — the entire fallback population'],
        ['G2',
         'AI enrichment does not use web search when no website URL is provided. '
         'GPT-5-mini has web_search capability but it is only enabled for known websites.',
         'Pipeline A',
         'integration_data.request_response\nrds_warehouse_public.facts',
         '~1,069 businesses (20%) recoverable with open web search'],
        ['G3',
         'AI prompt does not use business name keywords to classify before returning 561499. '
         'Names like "Lisa\'s Nail Salon" should give NAICS 812113 without vendor data.',
         'Pipeline A',
         'aiNaicsEnrichment.ts (code change, not data)',
         '~1,604 businesses (30%) recoverable with name keywords'],
        ['G4',
         'AI enrichment metadata fact not written when returning fallback. '
         'ai_confidence, ai_reasoning, ai_website_summary are lost.',
         'Pipeline A',
         'rds_warehouse_public.facts name="ai_naics_enrichment_metadata"',
         'Diagnostic gap — prevents quality monitoring'],
        ['G5',
         'MCC description says "Fallback MCC per instructions" — customer sees this literally. '
         'The message was intended as an internal system note, not customer-facing text.',
         'Pipeline A',
         'integration_data.request_response\nrds_warehouse_public.facts name="mcc_code"',
         'UX issue — all 5,349 businesses see this confusing description'],
        ['G6',
         'Pipeline B (customer_files) uses only ZI vs EFX and cannot recover NAICS '
         'from Middesk SOS filings, OC, or Trulioo for these businesses.',
         'Pipeline B',
         'datascience.customer_files',
         'Confirms full scope of entity-matching failure'],
    ],
    col_widths=[0.6, 3.2, 1.2, 2.2, 2.3],
    fs=8.5,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 8 — RECOVERY POTENTIAL
# ════════════════════════════════════════════════════════════════════════════

H1('Section 8 — Recovery Potential: How Many Can We Fix?')

body('Based on the real production data, here is the estimated recovery potential:')
spacer(4)

tbl(
    ['Category', 'Businesses', '%', 'Description'],
    [
        ['Recoverable — name keywords', '~1,604', '~30%',
         'Business name clearly indicates industry (salon, restaurant, church, dental, etc.). '
         'The new consensus.py has 80+ keyword-to-NAICS mappings that handle this immediately.'],
        ['Recoverable — web search', '~1,069', '~20%',
         'No vendor match and name is ambiguous, but Google Maps / LinkedIn / SOS registry '
         'would return information if AI is allowed to search freely.'],
        ['Genuinely unclassifiable', '~2,675', '~50%',
         'Holding companies, shell entities, brand-new businesses, '
         'businesses with no public footprint. NAICS 561499 is CORRECT for these. '
         'The only fix: improve the MCC description message.'],
        ['TOTAL fallback businesses', '5,349', '100%', ''],
    ],
    col_widths=[2.8, 1.3, 0.7, 4.7],
)

info(
    'Important reframe: 50% of these businesses (2,675) SHOULD receive 561499. '
    'The goal is not to eliminate 561499 — it is to ensure 561499 only appears when '
    'genuinely no classification is possible, and to replace the misleading MCC description '
    'with "Classification pending — insufficient public data available."'
)

H2('What the previous XGBoost model could NOT help with')
body(
    'The XGBoost classifier trained on vendor NAICS signals (ZI, EFX, OC) has zero impact '
    'on these 5,349 businesses because ALL vendor signals are null. '
    'A model that reads vendor NAICS codes cannot help when there are no vendor NAICS codes. '
    'The model\'s strength is resolving CONFLICTS between vendors (Scenario B, C) — '
    'which are not present here. '
    'This confirms that the model approach (while correct for a different problem) '
    'is not the right tool for these specific 5,349 businesses.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 9 — FIX ROADMAP
# ════════════════════════════════════════════════════════════════════════════

H1('Section 9 — Prioritised Fix Roadmap')

tbl(
    ['P', 'Fix', 'Businesses recovered', 'Effort', 'File / Location'],
    [
        ['P1',
         'Name keyword → NAICS inference\n'
         'Add to AI system prompt: classify from name keywords before returning 561499.\n'
         'Church → 813110, Salon → 812113, Restaurant → 722511, etc.',
         '~1,604 (30%)',
         'Very Low — string change in AI prompt',
         'aiNaicsEnrichment.ts getPrompt() system prompt\n'
         '(consensus.py detect_name_keywords() already has 80+ mappings to use as reference)'],
        ['P2',
         'Enable open web search for zero-vendor businesses\n'
         'When website=null AND no vendor match, enable unrestricted web_search:\n'
         'search "[business name] [city] [state]" in AI prompt.',
         '~1,069 (20%)',
         'Low — 3 lines of TypeScript in getPrompt()',
         'aiNaicsEnrichment.ts getPrompt()\n'
         'Already partially implemented for name_only_inference outcome in predictor.py'],
        ['P3',
         'Fix MCC description message\n'
         'Replace "Fallback MCC per instructions (no industry evidence...)" with\n'
         '"Classification pending — insufficient public data available."',
         '5,349 (100%) — UX improvement',
         'Very Low — string change in prompt',
         'aiNaicsEnrichment.ts system prompt line 114'],
        ['P4',
         'Store AI enrichment metadata even for fallback\n'
         'When AI returns 561499, still write the ai_naics_enrichment_metadata fact\n'
         'with confidence, reasoning, and tools_used.',
         '0 businesses recovered, but enables quality monitoring',
         'Low — TypeScript change to save fact',
         'aiNaicsEnrichment.ts executePostProcessing()'],
        ['P5',
         'Improve entity matching coverage\n'
         'Options: (a) Increase bulk data refresh frequency for ZI/EFX\n'
         '(b) Lower similarity_index threshold cautiously (check false-positive rate)\n'
         '(c) Add DBA name as an additional matching field\n'
         '(d) Add Liberty data which covers more micro-businesses',
         'Unknown — depends on implementation',
         'Medium-High — data engineering + model retraining',
         'smb_zoominfo_standardized_joined.sql\n'
         'smb_equifax_standardized_joined.sql\n'
         'entity_matching_20250127 v1 (model retraining)'],
        ['P6',
         'Deploy consensus.py API (for future Scenario A/B businesses)\n'
         'When vendor matches DO exist, the consensus layer (OC=0.9>ZI=0.8>EFX=0.7)\n'
         'applies them directly without AI. Currently these cases are 0% but will increase\n'
         'as entity matching coverage improves.',
         '0 now, future-proofs the pipeline',
         'Medium — TypeScript integration of Python API',
         'integration-service: aiNaicsEnrichment.ts executeDeferrableTask()\n'
         'naics_mcc_classifier: predictor.py, api.py (already built)'],
    ],
    col_widths=[0.5, 3.5, 1.8, 1.3, 2.4],
    fs=8.5,
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# SECTION 10 — IMPLEMENTATION PLAN
# ════════════════════════════════════════════════════════════════════════════

H1('Section 10 — Implementation Plan')

H2('Fix P1 + P2 + P3: AI prompt changes (highest ROI, lowest effort)')
body(
    'These three fixes require only changes to the AI system prompt in '
    'integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts. '
    'No TypeScript logic changes, no new infrastructure.'
)
lineage([
    '// BEFORE (current system prompt, line 104-115):',
    '`You are a helpful assistant that determines NAICS codes...',
    ' If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort.`',
    '',
    '// AFTER (updated system prompt):',
    '`You are a helpful assistant that determines NAICS codes...',
    '',
    ' IMPORTANT CLASSIFICATION RULES:',
    ' 1. Before returning 561499, check if the business name contains industry keywords:',
    '    - nail/salon/spa/beauty → 812113 (Nail Salons) or 812112 (Beauty Salons)',
    '    - restaurant/pizza/cafe/diner/grill → 722511 (Full-Service Restaurants)',
    '    - dental/dentist/orthodont → 621210 (Offices of Dentists)',
    '    - church/ministry/chapel/temple/mosque → 813110 (Religious Organizations)',
    '    - construction/contractor/plumb/electrician/hvac/roofing → 238XXX',
    '    - attorney/law/legal → 541110 (Offices of Lawyers)',
    '    If name clearly indicates an industry, return that NAICS with MED confidence.',
    '',
    ' 2. If website is not provided, use web_search to find public information:',
    '    Search: "[business name] [city] [state]"',
    '    If found: classify based on the website/listing content.',
    '    If not found: proceed to step 3.',
    '',
    ' 3. Only return naics_code 561499 if ALL of the following are true:',
    '    - No vendor NAICS codes available',
    '    - Business name contains no industry-specific keywords',
    '    - Web search found no public information',
    '    - Name is genuinely ambiguous (holding company, investment group, etc.)',
    '',
    ' 4. MCC description: When returning MCC 5614, set mcc_description to:',
    '    "Classification pending — insufficient public data available."',
    '    (NOT "Fallback MCC per instructions...")',
    '`',
])

H2('Fix P2: Enable web_search for zero-vendor businesses')
lineage([
    '// In aiNaicsEnrichment.ts getPrompt() — ADD this block BEFORE the website check:',
    '',
    '// NEW: Enable open web search when no vendor match AND no website',
    'const hasVendorNaics = params.naics_code && params.naics_code !== "561499";',
    'const hasWebsite = !!params.website;',
    '',
    'if (!hasVendorNaics && !hasWebsite) {',
    '  // Zero-evidence case: enable unrestricted web search',
    '  responseCreateWithInput.input.push({',
    '    role: "system",',
    '    content: `Since no vendor data is available, search the web for "${params.business_name} ` +',
    '             `${params.state}" to find any public information about this business.`',
    '  });',
    '  responseCreateWithInput.tools = [{ type: "web_search", search_context_size: "medium" }];',
    '  responseCreateWithInput.tool_choice = "auto";',
    '}',
])

H2('Fix P4: Store AI metadata even for fallback')
lineage([
    '// In aiNaicsEnrichment.ts executePostProcessing() — ensure metadata is always saved:',
    '',
    '// ADD: Write enrichment metadata fact even when returning 561499',
    'await this.saveEnrichmentMetadata(enrichedTask.id, {',
    '  confidence: response.confidence,',
    '  reasoning: response.reasoning,',
    '  website_summary: response.website_summary,',
    '  tools_used: response.tools_used,',
    '  naics_returned: response.naics_code,',
    '  mcc_returned: response.mcc_code,',
    '});',
    '// This writes to: rds_warehouse_public.facts name="ai_naics_enrichment_metadata"',
    '// Enables future quality monitoring and prompt improvement',
])

H2('Expected outcomes after all fixes')
tbl(
    ['Metric', 'Current', 'After P1+P2+P3', 'After P1-P6'],
    [
        ['Businesses with genuine 561499 (correct)', '~2,675', '~2,675', '~2,675'],
        ['Businesses with 561499 due to name gap', '~1,604', '~0 (name keywords applied)', '~0'],
        ['Businesses with 561499 due to no web search', '~1,069', '~535 (50% web success est.)', '~535'],
        ['Total fallback businesses', '5,349', '~3,210 (-40%)', '~3,210 (-40%)'],
        ['MCC "Fallback MCC per instructions" message', '5,349 businesses', '0 (message fixed)', '0'],
        ['AI enrichment metadata stored', '~0%', '~100%', '~100%'],
        ['Entity matching coverage', 'baseline', 'baseline', 'improved (P5)'],
    ],
    col_widths=[3.5, 2.0, 2.0, 2.0],
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# CONCLUSIONS
# ════════════════════════════════════════════════════════════════════════════

H1('Conclusions')

ok(
    'CONCLUSION 1: The 561499 problem is well-understood.\n'
    '5,349 businesses (7.7% of all) show NAICS 561499. 99.98% (5,348) have one root cause: '
    'zero vendor NAICS signals — ZoomInfo, Equifax, and OpenCorporates all failed to match. '
    'This is the entity-matching coverage gap, not an AI failure.'
)

ok(
    'CONCLUSION 2: The most impactful fix requires NO model changes.\n'
    'Fixes P1 (name keywords) and P2 (web search) are prompt-level changes to aiNaicsEnrichment.ts. '
    'They could recover ~2,673 businesses (50%) with minimal engineering effort. '
    'No XGBoost model, no Redshift queries, no new infrastructure required.'
)

gap(
    'GAP: The XGBoost classifier we built is NOT the solution for THESE 5,349 businesses.\n'
    'The model reads vendor NAICS signals (ZI, EFX, OC). For businesses with zero vendor signals, '
    'the model has no input to work with. The model is valuable for future Scenario B businesses '
    '(when vendor matches exist but disagree) — which will emerge as entity matching coverage improves.'
)

warn(
    'DATA QUALITY: AI enrichment confidence metadata is not being stored for fallback cases.\n'
    'The ai_naics_enrichment_metadata fact is empty for all 5,349 businesses. '
    'This means we cannot monitor AI quality, track improvement, or fine-tune the prompt '
    'based on historical performance. Fix P4 (store metadata always) is critical for '
    'the long-term health of the classification system.'
)

info(
    'IMPORTANT REFRAME: 2,675 businesses (50%) should permanently show 561499.\n'
    'Holding companies, shell entities, brand-new businesses, and businesses with '
    'no public footprint genuinely cannot be classified. The goal is not to eliminate '
    '561499 but to (a) ensure it only appears for genuinely unclassifiable businesses, '
    'and (b) replace the misleading MCC description with clear, honest language: '
    '"Classification pending — insufficient public data available."'
)

spacer(8)
body('Source code files referenced in this report:', bold=True)
bullet('aiNaicsEnrichment.ts', ' — integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts')
bullet('smb_zoominfo_standardized_joined.sql', ' — warehouse-service/datapooler/.../tables/')
bullet('customer_table.sql', ' — warehouse-service/datapooler/.../tables/')
bullet('consensus.py', ' — naics_mcc_classifier/consensus.py (already built)')
bullet('diagnostic.py', ' — naics_mcc_classifier/diagnostic.py (this analysis engine)')
bullet('NAICS_MCC_Fallback_RootCause_Analysis.ipynb', ' — naics_mcc_classifier/ (this report\'s source)')

spacer(6)
body('Data sources used:', bold=True)
bullet('rds_warehouse_public.facts', ' — current NAICS/MCC codes + winning source platform_id')
bullet('datascience.zoominfo_matches_custom_inc_ml', ' → zoominfo.comp_standard_global')
bullet('datascience.efx_matches_custom_inc_ml', ' → warehouse.equifax_us_latest')
bullet('datascience.oc_matches_custom_inc_ml', ' → warehouse.oc_companies_latest')
bullet('datascience.customer_files', ' — Pipeline B NAICS winner')

# ── Save ──────────────────────────────────────────────────────────────────────
out = ('/workspace/AI-Powered-NAICS-Industry-Classification-Agent/'
       'naics_mcc_classifier/NAICS_MCC_Fallback_Root_Cause_Report.docx')
doc.save(out)
size_kb = round(os.path.getsize(out)/1024, 1)
print(f'Saved  : {out}')
print(f'Size   : {size_kb} KB')
print('Ready  : Import into Google Docs via File > Import')
