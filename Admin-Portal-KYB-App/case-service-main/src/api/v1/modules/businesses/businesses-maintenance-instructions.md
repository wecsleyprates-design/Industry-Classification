# Businesses module: maintenance and refactor strategy

`businesses.ts` has grown very large and carries significant technical debt.
**Do not keep extending it in place** when the change is non-trivial. Prefer
extracting behavior into the layered layout below and shrinking the surface of
this file over time.

This document describes **where code belongs**, **how domains should interact**,
and **how to migrate safely**.

---

## Target directory structure

The businesses area (and case-service more broadly) should move toward this
shape:

```text
src/
├── api/                          # Layer 1: API / presentation
│   └── v1/
│       └── routes/
├── core/
│   └── {domain}/
│       ├── {subdomain}/          # Optional grouping within a domain
│       ├── {domain}Manager.ts    # Layer 2: business logic (orchestration, rules)
│       └── {domain}Repository.ts # Layer 3: data access (when needed)
├── clients/                      # External service communication
│   └── {service}/
│       └── {service}Client.ts
```

- **`api/`** — HTTP concerns: routing, request/response mapping, validation at
  the edge, status codes. Thin handlers that call into `core`.
- **`core/`** — Domain behavior: use cases, orchestration, invariants,
  coordination between pieces of _your_ model.
- **`core/.../*Repository.ts`** — Persistence: SQL (or query builder) lives
  here, not in managers or route handlers.
- **`clients/`** — Outbound calls to other services or third-party APIs; keep
  transport and DTO mapping out of domain managers where practical.

---

## Layering rules

| Concern                                          | Location                                    |
| ------------------------------------------------ | ------------------------------------------- |
| Business logic, workflows, domain rules          | `src/core/...` (managers / domain services) |
| Database access (SQL, Knex queries, row mapping) | `src/core/.../*Repository.ts`               |
| REST shape, auth context wiring, “glue” to HTTP  | `src/api/...`                               |

### Domains and tables

- **Domains should roughly follow database table boundaries** (names and
  cohesion), so that one bounded area owns the lifecycle and rules around those
  entities.
- **Not every domain needs a repository.** Some domains are orchestration-only
  (e.g. progression or workflow-style logic) and may call **business managers**
  in other domains instead of touching storage themselves.

### Cross-domain rules

- **A manager in one domain must not call another domain’s repository
  directly.**  
  If domain A needs data owned by domain B, go through **B’s manager** (or a
  small, explicit application service in `core` that composes managers). That
  keeps persistence details encapsulated and avoids “reach-through” coupling.

**Allowed (conceptually):** `ProgressionManager` → `BusinessManager` (or another
domain manager).

**Avoid:** `ProgressionManager` → `SomeOtherDomainRepository`.

---

## Strategy for updating `businesses.ts`

1. **Default to extract, not append.** New features should land in `api` +
   `core` (+ repository/client) according to the table above; `businesses.ts`
   should only receive thin wiring until it can be deleted or reduced to a
   barrel.
2. **Slice by vertical use case.** When refactoring, pick one route or one user
   journey, move its logic to a manager, move its SQL to a repository, and leave
   a minimal handler in `api`.
3. **Preserve behavior first.** Prefer mechanical moves and tests (or
   characterization tests) before behavior changes.
4. **One domain at a time.** Avoid a “big bang” rewrite; merge smaller PRs that
   each shrink `businesses.ts` or clarify boundaries.
5. **Enforce boundaries in code reviews.** Watch for SQL in managers, business
   rules in route files, and cross-domain repository calls.

---

## References

- **Worth / get-started coding standards** (patterns, conventions):  
  `code-patterns-and-standards-guide.md` in the get-started orchestration repo.

- **Monday.com doc (company standards / process):**  
  [joinworth-company.monday.com/docs/18405490972](https://joinworth-company.monday.com/docs/18405490972)

When the two sources differ on a specific point, align with team leads; treat
the get-started guide as the default for **code structure and TypeScript/service
patterns** unless Monday or team policy explicitly overrides.
