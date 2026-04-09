# Deploy Key Setup — One-Time Configuration

This guide sets up the 6 deploy keys needed for the `sync-sources.yml`
GitHub Action to pull from the private Worth AI repos automatically.

## Overview

Each private repo gets a **read-only deploy key** (SSH public key).
The corresponding **private key** is stored as a GitHub Secret in
`wecsleyprates-design/Industry-Classification`.

This only needs to be done **once**. After that, the sync runs automatically
every Monday or whenever you click "Run workflow" in GitHub Actions.

---

## Step 1 — Generate 6 SSH key pairs

Run this on your local machine (or any Linux/Mac terminal):

```bash
# Create a directory to hold the keys temporarily
mkdir -p ~/worth-deploy-keys && cd ~/worth-deploy-keys

# Generate one key pair per repo
ssh-keygen -t ed25519 -C "kyb-sync-bot" -f key_integration_service   -N ""
ssh-keygen -t ed25519 -C "kyb-sync-bot" -f key_microsites             -N ""
ssh-keygen -t ed25519 -C "kyb-sync-bot" -f key_case_service           -N ""
ssh-keygen -t ed25519 -C "kyb-sync-bot" -f key_warehouse_service      -N ""
ssh-keygen -t ed25519 -C "kyb-sync-bot" -f key_manual_score_service   -N ""
ssh-keygen -t ed25519 -C "kyb-sync-bot" -f key_worthscore_model       -N ""

# You now have 12 files:
#   key_*.pub   ← public keys  → go into each PRIVATE repo's Deploy Keys
#   key_*       ← private keys → go into Industry-Classification Secrets
```

---

## Step 2 — Add PUBLIC keys to each private repo

For **each** repo below, go to its Settings → Deploy keys → Add deploy key:

| Secret name for private key | Repo | Public key file |
|---|---|---|
| `INTEGRATION_SERVICE_DEPLOY_KEY` | github.com/joinworth/integration-service → Settings → Deploy keys | `key_integration_service.pub` |
| `MICROSITES_DEPLOY_KEY` | github.com/joinworth/microsites → Settings → Deploy keys | `key_microsites.pub` |
| `CASE_SERVICE_DEPLOY_KEY` | github.com/joinworth/case-service → Settings → Deploy keys | `key_case_service.pub` |
| `WAREHOUSE_SERVICE_DEPLOY_KEY` | github.com/joinworth/warehouse-service → Settings → Deploy keys | `key_warehouse_service.pub` |
| `MANUAL_SCORE_SERVICE_DEPLOY_KEY` | github.com/joinworth/manual-score-service → Settings → Deploy keys | `key_manual_score_service.pub` |
| `WORTHSCORE_MODEL_DEPLOY_KEY` | github.com/joinworth/worthscore-model → Settings → Deploy keys | `key_worthscore_model.pub` |

**For each repo:**
1. Go to `github.com/joinworth/REPO_NAME`
2. Click **Settings** tab
3. Click **Deploy keys** in the left sidebar
4. Click **Add deploy key**
5. Title: `kyb-sync-bot (read-only)`
6. Key: paste the contents of the `.pub` file (e.g. `cat key_integration_service.pub`)
7. **Do NOT check "Allow write access"** — read-only is safer
8. Click **Add key**

---

## Step 3 — Add PRIVATE keys to Industry-Classification Secrets

Go to: `github.com/wecsleyprates-design/Industry-Classification`
→ **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add 6 secrets (one per repo):

| Secret name | Value |
|---|---|
| `INTEGRATION_SERVICE_DEPLOY_KEY` | contents of `key_integration_service` |
| `MICROSITES_DEPLOY_KEY` | contents of `key_microsites` |
| `CASE_SERVICE_DEPLOY_KEY` | contents of `key_case_service` |
| `WAREHOUSE_SERVICE_DEPLOY_KEY` | contents of `key_warehouse_service` |
| `MANUAL_SCORE_SERVICE_DEPLOY_KEY` | contents of `key_manual_score_service` |
| `WORTHSCORE_MODEL_DEPLOY_KEY` | contents of `key_worthscore_model` |

To see the private key content:
```bash
cat ~/worth-deploy-keys/key_integration_service
# Copy everything including -----BEGIN...----- and -----END...-----
```

---

## Step 4 — Test the workflow

1. Go to `github.com/wecsleyprates-design/Industry-Classification`
2. Click **Actions** tab
3. Click **"Sync Private Source Repos"** in the left list
4. Click **"Run workflow"** button (top right)
5. Add a reason: `"initial test"`
6. Click **"Run workflow"**
7. Watch the logs — each repo should show ✅

---

## Step 5 — Clean up your local keys

After adding everything to GitHub, delete the local key files:

```bash
rm -rf ~/worth-deploy-keys
```

Never commit these private keys to any repo.

---

## What gets synced (and why)

| Repo | What is copied | Why it matters |
|---|---|---|
| **integration-service** | `lib/facts/` (rules, sources, field definitions) + `lib/aiEnrichment/` + `src/messaging/handlers/report.ts` + `src/api/v1/modules/facts/` | Core Fact Engine logic — defines every badge, weight, confidence model, and AI enrichment rule |
| **microsites** | `packages/case/src/page/Cases/CaseDetails/Tabs/KYB/` + constants + services | Admin portal React components — every card, badge, field config the user sees |
| **case-service** | `src/api/v1/modules/case-management/` + `src/api/v1/modules/businesses/` | Builds the KYB API response, joins NAICS/MCC lookup tables |
| **warehouse-service** | `datapooler/` (Pipeline B SQL) + `datapooler/adapters/db/models/` | Pipeline B winner-takes-all SQL + facts table schema |
| **manual-score-service** | `src/` | Analyst manual score override logic |
| **worthscore-model** | Everything except large binary model files | Worth Score ML model — explains the waterfall chart categories |

---

## Automatic schedule

After setup, the sync runs **every Monday at 6am UTC** automatically.
You can also trigger it manually any time from the GitHub Actions tab.

If a developer merges a PR that changes `rules.ts`, `fieldConfigs.tsx`,
or `customer_table.sql`, the next Monday sync (or a manual trigger) will
automatically pick up the changes and update the RAG index.
