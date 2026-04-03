"""
naics_mcc_classifier/api.py
==============================
Lightweight FastAPI server exposing the XGBoost classifier as an HTTP endpoint.
Called by the integration-service TypeScript code before firing AI enrichment.

Start with:
  uvicorn naics_mcc_classifier.api:app --host 0.0.0.0 --port 8765 --workers 2

Or for development (auto-reload):
  uvicorn naics_mcc_classifier.api:app --reload --port 8765

The TypeScript AINaicsEnrichment calls POST /predict before calling GPT.
If outcome == "use_prediction" → skip GPT entirely (saves cost).
If outcome == "send_to_ai" or "name_only_inference" → call GPT with enriched context.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .predictor import get_predictor, PredictionResult

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NAICS/MCC Classifier API",
    description=(
        "XGBoost classifier that pre-analyzes businesses before AI enrichment. "
        "Returns vendor signals, model predictions, and a ready-to-use AI prompt context string."
    ),
    version="1.0.0",
)


# ── Request / Response schemas ─────────────────────────────────────────────────

class VendorAlternative(BaseModel):
    """One entry from the Fact Engine alternatives[] array."""
    source: str = ""          # platform ID as string (e.g. "24")
    value: str = ""           # NAICS code
    confidence: float = 0.0
    is_primary: bool = False


class PredictRequest(BaseModel):
    """
    Input from integration-service (TypeScript).
    All fields except business_id are optional — the classifier degrades gracefully.
    """
    business_id: str
    business_name: str = ""
    current_naics_code: str = ""     # existing code (may be "561499" or empty)
    current_mcc_code: str = ""

    # Fact Engine alternatives — the full per-source breakdown
    vendor_alternatives: list[VendorAlternative] = Field(default_factory=list)

    # Raw vendor signals (from Redshift via entity matching)
    zi_c_naics6: str = ""
    zi_c_naics_top3: str = ""        # pipe-delimited: "722511|722513|722515"
    zi_c_sic4: str = ""
    zi_c_sic_top3: str = ""
    zi_naics_confidence: float = 0.0
    zi_match_confidence: float = 0.0
    efx_naics_primary: str = ""
    efx_naics_secondary_1: str = ""
    efx_naics_secondary_2: str = ""
    efx_naics_secondary_3: str = ""
    efx_naics_secondary_4: str = ""
    efx_sic_primary: str = ""
    efx_match_confidence: float = 0.0
    oc_naics_primary: str = ""
    oc_match_confidence: float = 0.0

    # Firmographic
    efx_employee_count: float = 0.0
    efx_annual_sales: float = 0.0
    zi_employee_count: float = 0.0
    zi_revenue: float = 0.0

    # Context
    state: str = "MISSING"
    country_code: str = "US"
    has_website: bool = False
    ai_enrichment_confidence: str = ""


class PredictResponse(BaseModel):
    """Response sent back to the TypeScript caller."""
    outcome: str
    business_id: str
    current_naics_code: str
    current_mcc_code: str
    predicted_naics_code: str
    predicted_naics_description: str
    predicted_mcc_code: str
    model_confidence: float
    top_5_naics: list[dict]
    vendor_signals: list[dict]
    ai_enrichment_context: str       # ready to paste into the GPT system prompt
    all_vendors_null: bool
    has_website: bool
    name_keywords_found: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Pre-load models so first request is fast."""
    try:
        get_predictor()
        logger.info("✅ Models loaded — ready to serve predictions")
    except FileNotFoundError as e:
        logger.warning("⚠️  Models not yet trained: %s", e)


@app.get("/health")
async def health():
    """Health check endpoint."""
    predictor = get_predictor()
    return {
        "status": "ok",
        "models_loaded": predictor._loaded,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    Main prediction endpoint.

    Called by AINaicsEnrichment.ts BEFORE deciding whether to call GPT.

    Returns:
      outcome = "use_prediction"      → use predicted_naics_code, skip GPT
      outcome = "send_to_ai"          → call GPT with ai_enrichment_context appended to system prompt
      outcome = "name_only_inference" → call GPT with web_search enabled + ai_enrichment_context
      outcome = "keep_existing"       → current code is non-fallback, no action needed
    """
    predictor = get_predictor()

    if not predictor._loaded:
        raise HTTPException(
            status_code=503,
            detail="Models not loaded. Run run_training_pipeline() first, then restart the server."
        )

    try:
        result: PredictionResult = predictor.predict_single(
            business_id=req.business_id,
            business_name=req.business_name,
            current_naics_code=req.current_naics_code,
            current_mcc_code=req.current_mcc_code,
            vendor_alternatives=[a.dict() for a in req.vendor_alternatives],
            zi_c_naics6=req.zi_c_naics6,
            zi_c_naics_top3=req.zi_c_naics_top3,
            zi_c_sic4=req.zi_c_sic4,
            zi_c_sic_top3=req.zi_c_sic_top3,
            zi_naics_confidence=req.zi_naics_confidence,
            zi_match_confidence=req.zi_match_confidence,
            efx_naics_primary=req.efx_naics_primary,
            efx_naics_secondary_1=req.efx_naics_secondary_1,
            efx_naics_secondary_2=req.efx_naics_secondary_2,
            efx_naics_secondary_3=req.efx_naics_secondary_3,
            efx_naics_secondary_4=req.efx_naics_secondary_4,
            efx_sic_primary=req.efx_sic_primary,
            efx_match_confidence=req.efx_match_confidence,
            oc_naics_primary=req.oc_naics_primary,
            oc_match_confidence=req.oc_match_confidence,
            efx_employee_count=req.efx_employee_count,
            efx_annual_sales=req.efx_annual_sales,
            zi_employee_count=req.zi_employee_count,
            zi_revenue=req.zi_revenue,
            state=req.state,
            country_code=req.country_code,
            has_website=req.has_website,
            ai_enrichment_confidence=req.ai_enrichment_confidence,
        )
        return result.to_dict()
    except Exception as e:
        logger.error("Prediction failed for business_id=%s: %s", req.business_id, e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch")
async def predict_batch(requests: list[PredictRequest]):
    """Batch prediction for multiple businesses."""
    predictor = get_predictor()
    if not predictor._loaded:
        raise HTTPException(status_code=503, detail="Models not loaded.")

    results = []
    for req in requests:
        try:
            result = predictor.predict_single(
                business_id=req.business_id,
                business_name=req.business_name,
                current_naics_code=req.current_naics_code,
                current_mcc_code=req.current_mcc_code,
                vendor_alternatives=[a.dict() for a in req.vendor_alternatives],
                zi_c_naics6=req.zi_c_naics6,
                zi_c_naics_top3=req.zi_c_naics_top3,
                efx_naics_primary=req.efx_naics_primary,
                efx_naics_secondary_1=req.efx_naics_secondary_1,
                efx_naics_secondary_2=req.efx_naics_secondary_2,
                oc_naics_primary=req.oc_naics_primary,
                zi_match_confidence=req.zi_match_confidence,
                efx_match_confidence=req.efx_match_confidence,
                oc_match_confidence=req.oc_match_confidence,
                state=req.state,
                country_code=req.country_code,
                has_website=req.has_website,
            )
            results.append(result.to_dict())
        except Exception as e:
            results.append({"business_id": req.business_id, "error": str(e)})

    return JSONResponse(content=results)
