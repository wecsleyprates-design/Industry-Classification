"""
sync_api_docs.py
================
Automatically fetches all Worth AI API documentation from docs.worthai.com.

How it works:
  1. Reads https://docs.worthai.com/llms.txt  — the official index of all pages
  2. Fetches every .md page (clean markdown, no HTML parsing needed)
  3. Also downloads all OpenAPI JSON specs
  4. Saves everything into api-docs/ folder
  5. Optionally rebuilds the RAG index

Run manually:
  python3 sync_api_docs.py

Run in GitHub Actions: see .github/workflows/sync-api-docs.yml
"""

import os, re, json, time, pathlib
import urllib.request
import urllib.error

BASE_URL   = "https://docs.worthai.com"
LLMS_URL   = f"{BASE_URL}/llms.txt"
OUT_DIR    = pathlib.Path(__file__).parent / "api-docs"
SPECS_DIR  = OUT_DIR / "openapi-specs"

OUT_DIR.mkdir(exist_ok=True)
SPECS_DIR.mkdir(exist_ok=True)


def fetch(url: str, retries: int = 3) -> str | None:
    """Fetch a URL and return text content, or None on failure."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Worth-Sync-Bot/1.0 (docs sync)"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  ⚠️  Failed: {url} — {e}")
                return None


def parse_llms_txt(content: str) -> tuple[list[dict], list[str]]:
    """
    Parse llms.txt to extract:
      - doc pages: [{title, url}]
      - openapi specs: [url]
    """
    pages = []
    specs = []

    # Match: - [Title](url): description
    for m in re.finditer(r"^- \[([^\]]+)\]\(([^)]+)\)(?::(.*))?$", content, re.MULTILINE):
        title = m.group(1).strip()
        url   = m.group(2).strip()
        if url.endswith(".json"):
            specs.append(url)
        else:
            pages.append({"title": title, "url": url})

    return pages, specs


def url_to_filename(url: str) -> pathlib.Path:
    """Convert a docs URL to a local file path."""
    # https://docs.worthai.com/api-reference/kyb/facts.md → api-reference/kyb/facts.md
    path = url.replace(BASE_URL, "").lstrip("/")
    if not path.endswith(".md"):
        path += ".md"
    return OUT_DIR / path


def sync_doc_page(page: dict) -> bool:
    """Fetch one doc page and save as markdown."""
    url   = page["url"]
    title = page["title"]

    # Ensure URL ends with .md for raw content
    md_url = url if url.endswith(".md") else url + ".md"

    content = fetch(md_url)
    if not content:
        # Try without .md extension
        content = fetch(url)
    if not content:
        return False

    # Add title header if not present
    if not content.startswith("#"):
        content = f"# {title}\n\n{content}"

    # Add source URL as comment for traceability
    content = f"<!-- Source: {md_url} -->\n{content}"

    filepath = url_to_filename(url)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(content, encoding="utf-8")
    return True


def sync_openapi_spec(url: str) -> bool:
    """Fetch one OpenAPI JSON spec and save it."""
    content = fetch(url)
    if not content:
        return False

    filename = url.split("/")[-1]
    filepath = SPECS_DIR / filename

    try:
        # Validate it's valid JSON
        parsed = json.loads(content)
        filepath.write_text(json.dumps(parsed, indent=2), encoding="utf-8")
        return True
    except json.JSONDecodeError:
        filepath.write_text(content, encoding="utf-8")
        return True


def write_index(pages: list[dict], specs: list[str], success_pages: list[str]):
    """Write a summary index of what was synced."""
    index = {
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": LLMS_URL,
        "total_pages": len(pages),
        "total_specs": len(specs),
        "synced_pages": len(success_pages),
        "pages": [{"title": p["title"], "url": p["url"]} for p in pages],
        "openapi_specs": specs,
    }
    (OUT_DIR / "_index.json").write_text(json.dumps(index, indent=2))


def main():
    print("=" * 60)
    print("Worth AI API Docs Sync")
    print(f"Source: {LLMS_URL}")
    print("=" * 60)

    # Step 1: fetch the master index
    print(f"\n📋 Fetching page index from {LLMS_URL}...")
    llms_content = fetch(LLMS_URL)
    if not llms_content:
        print("❌ Could not fetch llms.txt — aborting")
        return

    # Save llms.txt itself
    (OUT_DIR / "llms.txt").write_text(llms_content)

    # Step 2: parse the index
    pages, specs = parse_llms_txt(llms_content)
    print(f"   Found {len(pages)} doc pages and {len(specs)} OpenAPI specs\n")

    # Step 3: fetch all doc pages
    print("📄 Syncing doc pages...")
    success_pages = []
    for i, page in enumerate(pages, 1):
        result = sync_doc_page(page)
        status = "✅" if result else "❌"
        print(f"  {status} [{i:2d}/{len(pages)}] {page['title']}")
        if result:
            success_pages.append(page["url"])
        time.sleep(0.3)  # polite rate limiting

    # Step 4: fetch all OpenAPI specs
    print(f"\n📐 Syncing {len(specs)} OpenAPI specs...")
    for spec_url in specs:
        result = sync_openapi_spec(spec_url)
        name = spec_url.split("/")[-1]
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
        time.sleep(0.2)

    # Step 5: write index
    write_index(pages, specs, success_pages)

    print(f"\n✅ Sync complete!")
    print(f"   Pages synced: {len(success_pages)}/{len(pages)}")
    print(f"   Specs synced: {len(specs)}")
    print(f"   Output dir:   {OUT_DIR}")

    # Step 6: rebuild RAG if rag_builder is available
    try:
        import sys
        sys.path.insert(0, str(pathlib.Path(__file__).parent))
        from kyb_rag_builder import SOURCE_FILES, build_index

        print("\n🔄 Rebuilding RAG index to include new API docs...")

        # Add api-docs files to the indexer temporarily
        api_doc_files = []
        for md_file in OUT_DIR.rglob("*.md"):
            rel = str(md_file.relative_to(pathlib.Path(__file__).parent))
            desc = f"Worth AI API documentation: {md_file.stem.replace('-',' ')}"
            api_doc_files.append((str(md_file), "API_DOCS", desc))

        build_index()
        print("✅ RAG index rebuilt")
    except Exception as e:
        print(f"⚠️  RAG rebuild skipped: {e}")
        print("   Run: python3 kyb_rag_builder.py  manually if needed")

    print("\n📝 Next steps:")
    print("   git add api-docs/ Admin-Portal-KYB-App/kyb_rag_index.json")
    print('   git commit -m "sync: Worth AI API docs $(date +%Y-%m-%d)"')
    print("   git push")


if __name__ == "__main__":
    main()
