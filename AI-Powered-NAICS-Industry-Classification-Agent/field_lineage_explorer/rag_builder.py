"""
RAG Knowledge Base Builder
Indexes key source files from the SIC-UK-Codes repo into searchable chunks.
Uses TF-IDF + strong exact-phrase boosting for reliable retrieval.
"""
import os, json, re, math
from pathlib import Path

REPO_ROOT = "/tmp/SIC-UK-Codes"
INDUSTRY_ROOT = "/workspace/AI-Powered-NAICS-Industry-Classification-Agent"

INDEX_PATH = os.path.join(os.path.dirname(__file__), "rag_index.json")

SOURCE_FILES = [
    # integration-service — core fact definitions
    ("integration-service/lib/facts/kyb/index.ts",
     "SIC-UK-Codes",
     "KYB facts wiring — every KYB field definition and its sources. "
     "Contains: tin_match, tin_match_boolean, tin_submitted, sos_filings, sos_active, "
     "legal_name, dba_found, people, watchlist, mcc_code, naics_code, verification_status, "
     "idv_status, idv_passed, idv_passed_boolean, google_profile"),
    ("integration-service/lib/facts/businessDetails/index.ts",
     "SIC-UK-Codes",
     "Business detail facts — naics_code, mcc_code, mcc_code_found, mcc_code_from_naics, "
     "classification_codes, num_employees, naics_description sources and wiring"),
    ("integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts",
     "SIC-UK-Codes",
     "AI NAICS enrichment — system prompt, trigger conditions (minimumSources, maximumSources), "
     "removeNaicsCode(), NAICS_OF_LAST_RESORT='561499', mcc fallback 5614"),
    ("integration-service/lib/facts/rules.ts",
     "SIC-UK-Codes",
     "Fact Engine rules — factWithHighestConfidence, weightedFactSelector (WEIGHT_THRESHOLD=0.05), "
     "manualOverride, combineFacts, registryPreferredRule, truliooPreferredRule, "
     "combineWatchlistMetadata, truliooRiskRule"),
    ("integration-service/lib/facts/sources.ts",
     "SIC-UK-Codes",
     "All vendor sources — platform_id, weight, confidence model for every source: "
     "middesk(weight=2, pid=16), opencorporates(weight=0.9, pid=23), zoominfo(weight=0.8, pid=24), "
     "equifax(weight=0.7, pid=17), trulioo(weight=0.8, pid=38), AI(weight=0.1, pid=31). "
     "MAX_CONFIDENCE_INDEX=55. integration_data.request_response storage."),
    ("integration-service/lib/facts/types/FactName.ts",
     "SIC-UK-Codes",
     "Canonical list of all 150+ fact names: tin, tin_match, tin_match_boolean, tin_submitted, "
     "naics_code, mcc_code, sos_filings, sos_active, legal_name, watchlist, people, etc."),
    # Worth 360 Report handler — proves which facts appear in the report
    ("integration-service/src/messaging/kafka/consumers/handlers/report.ts",
     "SIC-UK-Codes",
     "Worth 360 Report generation handler — explicitly fetches tin_match_boolean, "
     "legal_name, name_match_boolean, sos_filings, sos_match for the report. "
     "Proves W360=Yes for these fields."),
    # KYB API facts controller
    ("integration-service/src/api/v1/modules/facts/controllers.ts",
     "SIC-UK-Codes",
     "KYB API facts controller — builds the API response from resolved facts. "
     "Special handling for tin.value (strips Verdata source). "
     "Exposes all FactName fields via GET /facts endpoint."),
    # warehouse-service
    ("warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql",
     "SIC-UK-Codes",
     "Pipeline B SQL — winner-takes-all CASE WHEN zi_match_confidence > efx_match_confidence "
     "controls NAICS, employees, revenue, name, address. OC/Liberty/Middesk/Trulioo ignored."),
    # case-service
    ("case-service/src/api/v1/modules/case-management/case-management.ts",
     "SIC-UK-Codes",
     "Case management API — getCaseByIDQuery joins data_businesses with core_naics_code, "
     "core_mcc_code. Builds the KYB API response including naics_code, mcc_code, tin."),
    # modeling docs
    ("modeling/INDUSTRY_FACTS_GUIDE.md",
     "Industry-Classification",
     "Industry facts guide — Pipeline A and B explanation, NAICS/MCC lineage, "
     "8 facts table, 561499 root cause, Fact Engine rules"),
    ("naics_mcc_classifier/diagnostic.py",
     "Industry-Classification",
     "561499 root-cause analysis — scenario classification, vendor signal analysis, "
     "SCENARIO_DESCRIPTIONS, run_fallback_diagnosis"),
]

CHUNK_SIZE = 30    # smaller chunks = more precise retrieval
CHUNK_OVERLAP = 5  # overlap between chunks to avoid boundary splits


def build_index():
    chunks = []
    for rel_path, repo, description in SOURCE_FILES:
        if repo == "SIC-UK-Codes":
            full_path = os.path.join(REPO_ROOT, rel_path)
        else:
            full_path = os.path.join(INDUSTRY_ROOT, rel_path)

        if not os.path.exists(full_path):
            print(f"  SKIP (not found): {rel_path}")
            continue

        try:
            with open(full_path, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except Exception as e:
            print(f"  ERROR reading {rel_path}: {e}")
            continue

        total = len(lines)
        step = CHUNK_SIZE - CHUNK_OVERLAP
        for start in range(0, total, step):
            end = min(start + CHUNK_SIZE, total)
            chunk_lines = lines[start:end]
            text = "".join(chunk_lines).strip()
            if not text:
                continue

            # Extract both split words AND full camelCase/underscore compound terms
            # This is the key improvement: index "tin_match_boolean" as a single term
            # in addition to its component words
            split_words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", text.lower())
            compound_terms = re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+", text)
            compound_terms_lower = [t.lower() for t in compound_terms]
            all_terms = split_words + compound_terms_lower

            tf = {}
            for w in all_terms:
                tf[w] = tf.get(w, 0) + 1
            # Give compound terms extra weight (they are more specific)
            for t in compound_terms_lower:
                tf[t] = tf.get(t, 0) + 3  # bonus weight for exact compound

            chunks.append({
                "id": len(chunks),
                "repo": repo,
                "path": rel_path,
                "line_start": start + 1,
                "line_end": end,
                "description": description,
                "text": text[:3000],  # store more text per chunk
                "tf": tf,
            })

        print(f"  Indexed {rel_path}: {total} lines → {len([c for c in chunks if c['path']==rel_path])} chunks")

    N = len(chunks)
    df = {}
    for chunk in chunks:
        for word in chunk["tf"]:
            df[word] = df.get(word, 0) + 1

    idf = {w: math.log((N + 1) / (d + 1)) for w, d in df.items()}

    index = {
        "chunks": chunks,
        "idf": idf,
        "N": N,
        "source_files": [{"path": p, "repo": r, "description": d} for p, r, d in SOURCE_FILES],
    }

    with open(INDEX_PATH, "w") as f:
        json.dump(index, f)
    print(f"\nIndex saved: {INDEX_PATH}  ({N} chunks)")
    return index


def search(index, query, top_k=8):
    """
    Improved search:
    1. TF-IDF over split words
    2. Strong boost for exact compound-term matches (camelCase/underscore)
    3. Extra boost when the exact query phrase appears verbatim in a chunk
    4. Exact-line boost: even higher score when field definition line is found
    """
    idf = index["idf"]

    # Extract both split words and compound terms from the query
    query_words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", query.lower())
    query_compounds = re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+", query.lower())
    # Also detect camelCase terms in query
    camel = re.findall(r"[a-z][a-zA-Z0-9]+[A-Z][a-zA-Z0-9]+", query)
    query_compounds += [c.lower() for c in camel]

    scores = []
    query_lower = query.lower()

    for chunk in index["chunks"]:
        text_lower = chunk["text"].lower()
        score = 0.0

        # TF-IDF component
        for w in query_words:
            tf_val = chunk["tf"].get(w, 0)
            idf_val = idf.get(w, 0)
            score += tf_val * idf_val

        # Strong boost for exact compound terms (e.g. "tin_match_boolean")
        for compound in query_compounds:
            if compound in text_lower:
                # How many times does it appear?
                count = text_lower.count(compound)
                score += 20.0 * count  # very strong boost

        # Extra boost: exact field definition patterns like "fieldName:" or "fieldName: {"
        for compound in query_compounds:
            # TypeScript field definition: "  tin_match_boolean: {"
            # or "  tin_match_boolean :" or assignment
            patterns = [
                f"{compound}:",
                f"{compound} :",
                f'"{compound}"',
                f"name = '{compound}'",
                f"name = \"{compound}\"",
            ]
            for pat in patterns:
                if pat in text_lower:
                    score += 30.0  # strongest boost — this is a definition

        # Boost if query words appear in the file description
        desc_lower = chunk.get("description", "").lower()
        for compound in query_compounds:
            if compound in desc_lower:
                score += 5.0

        scores.append((score, chunk))

    scores.sort(key=lambda x: -x[0])
    results = [c for s, c in scores[:top_k] if s > 0]

    # If nothing scored, fall back to pure text substring search
    if not results:
        for compound in query_compounds:
            for chunk in index["chunks"]:
                if compound in chunk["text"].lower():
                    results.append(chunk)
        results = results[:top_k]

    return results


def load_or_build():
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH) as f:
            return json.load(f)
    print("Building RAG index...")
    return build_index()


if __name__ == "__main__":
    build_index()
