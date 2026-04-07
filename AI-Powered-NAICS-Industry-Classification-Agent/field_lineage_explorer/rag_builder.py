"""
RAG Knowledge Base Builder
Indexes key source files from the SIC-UK-Codes repo into searchable chunks.
Run once to build the index; full_app.py loads it at startup.
"""
import os, json, re, math
from pathlib import Path

REPO_ROOT = "/tmp/SIC-UK-Codes"
INDUSTRY_ROOT = "/workspace/AI-Powered-NAICS-Industry-Classification-Agent"

INDEX_PATH = os.path.join(os.path.dirname(__file__), "rag_index.json")

SOURCE_FILES = [
    # integration-service
    ("integration-service/lib/facts/kyb/index.ts", "SIC-UK-Codes", "KYB facts wiring — every KYB field definition and its sources"),
    ("integration-service/lib/facts/businessDetails/index.ts", "SIC-UK-Codes", "Business detail facts — naics_code, mcc_code, num_employees sources"),
    ("integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts", "SIC-UK-Codes", "AI NAICS enrichment — prompt, trigger conditions, removeNaicsCode, NAICS_OF_LAST_RESORT"),
    ("integration-service/lib/facts/rules.ts", "SIC-UK-Codes", "Fact Engine rules — factWithHighestConfidence, weightedFactSelector, manualOverride, combineWatchlistMetadata"),
    ("integration-service/lib/facts/sources.ts", "SIC-UK-Codes", "All vendor sources — platform_id, weight, confidence model, API type for every source"),
    ("integration-service/lib/facts/types/FactName.ts", "SIC-UK-Codes", "Canonical list of all 150+ fact names in the Worth AI system"),
    # warehouse-service
    ("warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql", "SIC-UK-Codes", "Pipeline B SQL — winner-takes-all CASE statement for NAICS, employees, revenue, name, address"),
    # case-service
    ("case-service/src/api/v1/modules/case-management/case-management.ts", "SIC-UK-Codes", "Case management API — getCaseByIDQuery, naics_code/mcc_code join, data_businesses schema"),
    # modeling docs
    ("modeling/INDUSTRY_FACTS_GUIDE.md", "Industry-Classification", "Industry facts guide — Pipeline A and B explanation, NAICS/MCC lineage, 8 facts table"),
    ("naics_mcc_classifier/diagnostic.py", "Industry-Classification", "561499 root-cause analysis — scenario classification, vendor signal analysis"),
]

CHUNK_SIZE = 40  # lines per chunk


def build_index():
    chunks = []
    for rel_path, repo, description in SOURCE_FILES:
        # Determine actual file path
        if repo == "SIC-UK-Codes":
            full_path = os.path.join(REPO_ROOT, rel_path)
        else:
            # Industry-Classification files live in INDUSTRY_ROOT parent
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
        for start in range(0, total, CHUNK_SIZE):
            end = min(start + CHUNK_SIZE, total)
            chunk_lines = lines[start:end]
            text = "".join(chunk_lines).strip()
            if not text:
                continue

            # Build simple TF vector (word frequencies)
            words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", text.lower())
            tf = {}
            for w in words:
                tf[w] = tf.get(w, 0) + 1

            chunks.append({
                "id": len(chunks),
                "repo": repo,
                "path": rel_path,
                "line_start": start + 1,
                "line_end": end,
                "description": description,
                "text": text[:2000],   # store first 2000 chars
                "tf": tf,
            })

        print(f"  Indexed {rel_path}: {total} lines → {math.ceil(total/CHUNK_SIZE)} chunks")

    # Compute IDF across all chunks
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
    print(f"\nIndex saved: {INDEX_PATH}")
    print(f"Total chunks: {N}")
    return index


def search(index, query, top_k=5):
    """TF-IDF search over the chunk index."""
    query_words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", query.lower())
    idf = index["idf"]
    scores = []
    for chunk in index["chunks"]:
        score = 0.0
        for w in query_words:
            tf_val = chunk["tf"].get(w, 0)
            idf_val = idf.get(w, 0)
            score += tf_val * idf_val
        # Boost exact matches of camelCase or underscore names
        for w in query_words:
            if w in chunk["text"].lower():
                score += 2.0
        scores.append((score, chunk))
    scores.sort(key=lambda x: -x[0])
    return [c for s, c in scores[:top_k] if s > 0]


def load_or_build():
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH) as f:
            return json.load(f)
    print("Building RAG index...")
    return build_index()


if __name__ == "__main__":
    build_index()
