"""Minimal PDF snapshot via reportlab."""
from __future__ import annotations

import io
from datetime import datetime


def render_pdf_snapshot(filters: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("KYB Confidence Platform — Snapshot", styles["Title"]),
        Paragraph(f"Generated: {datetime.utcnow().isoformat(timespec='seconds')}Z", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("Active filters:", styles["Heading2"]),
    ]
    for k, v in filters.items():
        story.append(Paragraph(f"<b>{k}</b>: {v}", styles["Normal"]))
    doc.build(story)
    return buf.getvalue()
