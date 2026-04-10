# TDD: Workflows (Draft v0.3)

---

## About this doc

This document defines the technical design for the **Workflow Automation
Engine** that enables customers to create rules-based decisioning, and
optionally fall back to WorthScore when no rules match. It prioritizes **clear
scope boundaries**, auditability, and delivery risk control. It reuses existing
Worth services where practical and introduces a dedicated Workflow Engine for
rule evaluation and routing.

**References** (source: PRD – “Custom Score: Workflows” and SSO TDD template):
Goals/FRs (triggers, branching, outcomes), audit logs, versioning, workflow
testing (historical/champion–challenger), and explicit out-of-scope (alerts,
templates, ML rule optimization, rules-only bypass as a future option).

|                       |                                   |
| --------------------- | --------------------------------- |
| **Sign off Deadline** | **EOD Monday, 9/22/2025**         |
| Status                | Draft                             |
| Author(s)             | @oscar.castro @Naelson Matheus Jr |

Sign Offs:

@Johann Nieto

@Matt Robinson (Optional)

@Daniel Quinones

@Vipul

@Jessica Chinn

@Gavin Bauman

@dj

---

## Scope & Boundaries

### In Scope (MVP)

1. **Workflow Configuration**
   - CRUD for Workflows (per-customer), Draft → Published versioning,
     **including delete of drafts**.
   - **Triggers** with **Boolean AND/OR** across supported Worth fields (KYB,
     KYC, financials, PR, adverse media, MCC, custom fields). MVP exposes no
     Trigger CRUD; workflow_triggers is seeded with ONBOARDING_SUBMITTED and is
     not user-editable.
   - **Branching** steps with nested conditions.
   - **Outcomes**: AUTO_APPROVE, AUTO_REJECT, MANUAL_REVIEW.

2. **Decision Processing & Routing**
   - If no branch matches → **fallback to default action**;
   - System updates application status based on outcome; idempotent writes.

3. **Audit & Versioning**
   - Immutable **Decision Log** (inputs, rule version, path taken, outcomes,
     latency).
   - Immutable **Rule Change Log** (who/when/what diff per version).
   - Export endpoints for audit (**CSV required**, JSON optional), per API
     section.

4. **Testing & Validation (Phase 1/2 split)**
   - **Phase 1 (MVP) - Basic Preview**: Ad-hoc preview runs evaluate **current**
     Facts only (not historical). Supports case_id and business_id sampling. See
     Tickets #16, #34, #35.
   - **Phase 2**: Champion/Challenger in _shadow_ mode; What-if analysis over
     historical snapshots.
   - **Future Enhancements** (deferred from initial MVP):
     - Historical sample testing with date filters and sample size cap (e.g.,
       ≤10k)

### Out of Scope (for this release)

- **Custom alerting** based on workflows (future integration with monitoring).
- **Pre-built templates** and **AI rule optimization**.
- **Rules-only decisioning** (complete WorthScore bypass) – remains future
  state;
- **Dashboards & real-time queue analytics** – removed from scope per PRD
  update.
- **Drag-and-drop Visual Workflow Builder** – removed from scope; MVP will use a
  form-based builder with whole-tree updates.

### Non-Goals / Constraints

- No direct editing of historical decision logs.
- No free-form SQL-like rule conditions; all conditions must use supported field
  catalog + operators.
- No customer-crossing workflow reuse (copy allowed, but storage is **per
  customer**).

---

## High-Level Architecture

**Services/Modules**

- **Warehouse Service** (existing): source of persisted **Facts**. Workflow
  Engine fetches GET /facts/{businessId} at evaluation time.
- **Case/Applications Service** (existing): emits events (Onboarding); receives
  status updates.
- **Audit Store**: append-only decision logs + rule change logs (see Data
  Model).
- **Testing Worker**: runs historical “test-runs” and shadow experiments (Phase
  2).

**Data Flow (evaluate)**

1. Event: When the applicant performs the **onboarding submission** (all
   required fields are completed), it triggers an evaluation.
2. After fetching case, **call Warehouse** to get Facts for business_id;
   evaluate rules against that snapshot (no on-demand recompute; no Kafka read
   in WF).
3. Fetch **active published workflows** for customer; Evaluate triggers → rules.
   1.  Across workflows: evaluate by explicit priority (highest first).
   2.  Within workflow: preorder traversal; first terminal match wins.

4. First matching terminal outcome produces actions; if none → call
   **WorthScore**.
5. Persist **Decision Log** (inputs, path, outcomes), update case.

---

## Data Model (ER)

> Key principles: **immutable versioning**, **append-only audit**,
> **per-customer** isolation, **idempotent** updates.

---

## API & Interfaces

### Public Admin APIs (per customer)

- POST /workflows – create draft workflow.
- GET /workflows?status= – list.
- GET /workflows/{id} – view.
- POST /workflows/{id}/versions – create new draft version from latest
  published.
- PUT /workflow/{id} – update rule tree (whole-tree update; node-level CRUD
  deferred with drag‑and‑drop out of scope).
  - Server-side validation errors with codes:
    - UNKNOWN_FIELD, OPERATOR_NOT_ALLOWED, TYPE_MISMATCH, UNREACHABLE_BRANCH.
- POST /workflow/{id}:publish – publish; sets all others to created.
- GET /field-catalog – list allowed fields & operators.
- GET /audit/decision-logs – export decision logs (**CSV required**, JSON
  optional).
- GET /audit/rule-changes – export rule change logs (**CSV required**, JSON
  optional).
- GET /workflows-triggers - list of triggers
- DELETE /workflows/{id} – delete draft workflow (only if workflow has no
  published versions)

### Internal APIs

- POST /evaluate – inputs: customer_id, case_id, business_id (Workflow Engine
  **fetches Facts** from Warehouse).

**Events**

- **Clarify** that the trigger is **case status = SUBMITTED** (from Case
  Service).

---

## Evaluation Semantics

- Workflows are **ordered** by priority (lowest first). First workflow with
  matching **trigger** is evaluated.
- Within a workflow, traverse from root → child branches; **first terminal**
  outcome stops evaluation (no multi-hit for MVP).
- If **no terminal** reached, call **Fallback default action**
- Conditions use **type-safe operators** from the FieldCatalog; any unknown
  field/operator → validation error at design-time.
- If a referenced attribute is missing/null at runtime: treat null evaluations
  as FALSE;
- **Facts source:** At evaluation, Workflow Engine calls **Warehouse** for
  business_id and uses the **latest persisted** Facts.
- **Missing values:** Missing/null Facts → **FALSE**. Ratios with denominator
  0/null → null → **FALSE**.
- **No auto re-eval:** The engine does **not** listen to facts.v1 nor
  re-evaluate on updates in MVP.

---

## Non-Functional Requirements

- **Performance:** Evaluate path **P95 < 500ms**, **P99 < 1s**, SLA 99.9%
  monthly. Rule trees cached by (customer, version) with LRU + background warm.
- **Include Warehouse call in path**: use short-TTL caching (Redis) of Facts by
  (business_id) where safe. (**TBD by Client**)
- **Security:** Per-customer isolation; RBAC via existing identity/roles; audit
  logs are append-only. PII masked in reason_chain where not essential.
- **Reliability:** At-least-once processing driven by events; evaluation is
  idempotent; retries safe.
- **Observability:** Tracing for evaluate, metrics: latency, match-rate, action
  distribution.

---

## Testing & Validation

**Phase 1 (MVP)**

- **Rule Validator:** design-time checks (unknown field, operator/type mismatch,
  arity, unreachable branches).
- Ad-hoc preview runs evaluate **current** Facts only (not historical).

**Phase 2**

- **Champion/Challenger (shadow):** challenger runs in parallel, writes _shadow_
  DecisionLogs (no side effects); diff report.
- **What-if:** on saved historical snapshots.

---

## Risks & Mitigations

- **Scope creep** (broad PRD): see **Client Clarifications Required** below;
  gate anything not in MVP via flags and Phase 2 roadmap.
- **Latency regressions:** cache compiled rule trees; prefetch field maps;
  micro-batching disabled for real-time path.
- **Data drift / field changes:** central FieldCatalog with deprecations;
  pre-publish validation.
- **Complexity of nested logic:** depth limit (e.g., max depth=6) and node cap
  (e.g., 200 nodes/version) in MVP.

---

## Requirements (focus on development)

- Show a human-readable summary of each rule/branch so analysts can verify logic
  at a glance.
  - **Behavior**
    - Render boolean trees from workflow_rules.conditions into a single
      expression line:
      - Operators: AND, OR, NOT; group with parentheses.
      - Field rendering: context.attribute (e.g., application.mcc).
      - Operator mapping: =, !=, >, <, >=, <=, IN, CONTAINS, IS_NULL,
        IS_NOT_NULL.

---

## Client Clarifications Required (to prevent scope creep)

1. **Evaluation ordering UI** – PM indicated desire for **explicit priority
   control**. Confirm UI/UX for ordering and default tie-breaker (e.g.,
   created_at).
2. **FieldCatalog ownership & cadence** – Centralized source of truth vs. local
   copy with sync; deprecation policy.
3. **Case status vocabulary** – Brittany to provide authoritative status names
   and mapping for SET_STATUS.
4. **Historical sampling parameters** – Max N for sample runs, allowed lookback
   window, and filter schema (e.g., date range, segment).
5. **Audit exports** – Confirm **CSV** as required format (JSON optional for API
   consumers) and whether Kalindi’s FE screen covers both DecisionLog and
   RuleChangeLog.
6. **Data retention** – Regulatory retention period for
   DecisionLog/RuleChangeLog and PII masking rules.
7. **Case status mapping** – Agree on canonical status names for SET_STATUS,
   aligned with Case Service.

---

## Milestones & Delivery Plan

**W0–1: Foundations**

- Data model & migrations; FieldCatalog; skeleton services; evaluate stub;
  minimal admin CRUD (draft-only).

**W2–3: Engine & Actions**

- Condition evaluator + compiler; outcomes; decision log; change log; P95
  profiling.

**W4: Publish & Audit**

- Versioning flows; exports; observability; hardening.

**W5: MVP Beta**

- App integration; dry-run validator; historical sample test (N cap);
  documentation & runbooks.

**W6: Pilot & Polish**

- Customer pilot; bug bash; perf/scale tuning.

> **Phase 2 (post-MVP):** shadow champion/challenger. _Routing beyond
> round-robin and dashboards will be re-scoped in a future PRD update._

---

## Open Questions

1. **Evaluation ordering across multiple workflows** – Options: (A) explicit
   priority (lowest first) with **first-terminal-wins**; (B) evaluate-all and
   pick the most-specific match; (C) tag-based routing to a single workflow.

   **Answer:** (A) First match wins

2. Where should the field catalog (attributes, types, operators) come from — a
   central service or a local copy — and how should we handle
   updates/deprecations over time?  
   **Answer:** (FACTS)
3. When running historical test previews for a workflow, should we validate all
   cases or apply sampling (e.g., last 10K records)?  
   **We don’t have historical for cases so far, only FACTS per business. That
   means that evaluating multiple cases from the same business would have same
   results.**

   **Answer:**

4. **Permissions**: What are the rule permissions for each role? Who can
   create/publish/delete-draft/…?  
   **Answer:**
5. **Triggers:** Can we have 3 workflows with the same trigger condition? If
   yes, what happens if all of them run and none of them get matches with the
   conditions, the system will apply the default action from Workflow1 (highest
   priority) or Workflow3 (lowest priority)? 

Currently, the design allows multiple workflows to share the same trigger event,
and each workflow can also contain multiple rules. Functionally this creates
redundancy: having several workflows with the same trigger and different rules
is equivalent to having a single workflow with multiple rules. While both
approaches are technically possible, this flexibility may confuse users, since
there would be two different ways to model rules, increasing the risk of
misconfiguration.

We would suggest one of the options instead.

For example:

1. Allow only one workflow per trigger event, with multiple rules inside it,
   **or**
2. Allow multiple workflows with the same trigger event, but each workflow may
   contain only one rule.
3. Allow multiple workflows with the same trigger event, each potentially with
   multiple rules, but only one of them can be published at a time. The others
   can remain as drafts or inactive.

After several meetings and careful consideration, we’ve implemented support for
having **multiple workflows with the same trigger**, each potentially containing
**multiple rules**. All of them can be **published simultaneously**. During
execution, workflows are evaluated **in order of priority** (lower number =
higher priority), and the system follows a **“first match wins”** strategy—once
a matching rule is found, no further workflows are evaluated.

6. **Event:** What is the specific event triggered after an applicant finishes
   their onboarding flow? Is that SUBMITTED? Our plan is to initiate the
   workflow once this event is triggered, allowing us to gather the data and
   execute the process.

   **Answer:**

7. **Permission:** Do we have a RBAC for the Roles we will have in this
   project?  
   Example:

   `| Role                 | Create draft | Edit draft | Publish          | Delete draft | Export logs      | | -------------------- | ------------ | ---------- | ---------------- | ------------ | ---------------- | | CRO                  | ✔            | ✔          | ✔                | ✔            | ✔                | | Risk Analyst         | ✔            | ✔          | ✖ (requires CRO) | ✔            | ✔                | | Underwriter (viewer) | ✖            | ✖          | ✖                | ✖            | ✔ (if permitted) |`

   **Answer:**

8. Do we want to have friendly names in the UI (i.e. mcc_code in FACTS is showed
   mcc code)?  
   **Answer:**
9. Can we suppose that all attributes will be validated without transformations
   (i.e review_count > 0 = TRUE)  
   **Answer:**
10. **Are re-executions allowed?**

    For example, suppose we initially receive case.status = SUBMITTED, the
    workflow runs, and updates the status to case.status = AUTO_APPROVED. Later,
    either a person or another process changes the status back to case.status =
    SUBMITTED.

    In that case, should the workflow execute again?

    We’re not sure if this scenario is even possible, but we’d like to
    confirm.  
    **Answer:**

## Decision Log

- **DL-001**: MVP uses **first-match terminal** per workflow; no multi-hit
  aggregation.
- **DL-002**: Fallback to **DefaultAction** when no rule matches.
- **DL-003**: Rule versioning is **immutable**; only new versions can be
  published; all decisions reference the exact version id.

---

## Diagrams (Under Progress)

### Sequence – Evaluation & Routing - Case Status Change

- First Evaluation

---

### Publish & Versioning flow (draft → published)

---

### Delete Draft Workflow

**Behavior**: The `DELETE /workflows/{id}` endpoint deletes draft workflows and
all their draft versions. This follows a "hard delete" approach as specified in
ticket #15. The endpoint:

1. **Validates** that the workflow exists and has no published versions
2. **Deletes** all draft versions and their associated rules
3. **Removes** the workflow itself from the database
4. **Logs** all deletion activities for audit purposes

**Constraints**:

- Only workflows with **no published versions** can be deleted
- Published versions must be deleted first before the workflow can be removed
- All deletions are **hard deletes** (permanent removal from database)

---

## Appendix

- Field types & operator matrix (TBD)
- Example workflow JSON schema (TBD)
- Export file layouts (DecisionLog, RuleChangeLog) (TBD)
