# AIPlane — Automation Tester → Claude Code Assisted SDET Workflow

Companion to `docs/TEST_PLAN.md`. That document is *what* to build, phase by phase. This one is *how* you and Claude Code build it together, day to day. Read the relevant phase in `docs/TEST_PLAN.md` §6 first; come here for the working process.

## 1. The Model — Who Owns What

Claude Code accelerates authoring, execution, and triage. It does not own test strategy, does not decide what "done" means, and nothing it writes reaches `main` without the same PR review any other change in this repo gets (`docs/ISSUE_WORKFLOW.md`) — the second SDET's review is not optional just because a change was AI-assisted.

| | Human SDET | Claude Code |
|---|---|---|
| Test scope / what needs coverage this phase | **Owns** — driven by `docs/TEST_PLAN.md` §6 | Can propose gaps it notices, does not decide |
| Scenario design (given/when/then) | **Owns** — writes it before prompting | Can suggest edge cases, human confirms which matter |
| Spec/script authoring | Reviews | **Does** — follows existing fixtures/conventions |
| Running the suite and reporting results | Spot-checks | **Does** — must actually execute, not assert it would pass |
| SLA/threshold values (k6) | **Owns** — see `docs/TEST_PLAN.md` §14 open items | Can draft a proposal, never finalizes |
| Flaky-test root cause | Confirms | Investigates first, proposes a fix |
| Merge decision | **Owns**, jointly with the other SDET as reviewer | Never merges |

## 2. The Core Loop

```
Phase scope (TEST_PLAN.md §6)
        │
        ▼
Scenario list — human writes, plain English given/when/then, 5-10 min
        │
        ▼
Brief Claude Code — scenario + which existing spec/fixture to model
after + which .cursor/rules/*.mdc file(s) apply (§3 below)
        │
        ▼
Claude Code drafts the spec/script
        │
        ▼
Claude Code RUNS it locally — Playwright headless / k6 smoke run —
and reports the real output, not a prediction
        │
        ▼
Human review against the checklist (§4) ── fails ──▶ iterate with Claude Code
        │ passes
        ▼
PR opened, "Closes #N", references the phase issue
        │
        ▼
Other SDET reviews (same PR bar as any change in this repo)
        │
        ▼
CI (new e2e.yml / load.yml, docs/TEST_PLAN.md §12) ──▶ merge
        │
        ▼
Maintenance loop — flaky triage, contract drift, k6 trend review (§5)
```

The step most worth protecting is "Claude Code RUNS it locally." Claude Code has a real terminal in this workflow — there is no reason to accept a generated test on the claim that it "should" pass. If it has not been executed and the output shown, treat it as a draft, not a deliverable.

## 3. Briefing Claude Code Well

A good brief is short and points at real files in this repo rather than re-explaining conventions from scratch — that re-explaining is exactly what `.cursor/rules/*.mdc` exists to avoid, and it also keeps two parallel SDETs' Claude Code sessions converging on the same patterns instead of drifting apart.

**Playwright UI** (SDET A) — reference `.cursor/rules/e2e-testing.mdc` (new, distilled from `docs/TEST_PLAN.md` §5/§7) plus `.cursor/rules/frontend-testing.mdc` for the "test behavior, not implementation" and role/label-query conventions that carry over from Vitest. Brief template:

```
Scenario: <given/when/then, plain English>
Model after: tests/e2e/ui/<closest existing spec>.spec.ts
Fixtures to reuse: tests/e2e/fixtures/auth.ts, test-project.ts — do not
  duplicate their logic inline
Follow: .cursor/rules/e2e-testing.mdc, .cursor/rules/frontend-testing.mdc
Tag: @smoke or @regression (see docs/TEST_PLAN.md §7)
Run it and show me the actual pass/fail output before I review.
```

**Playwright API** (SDET B) — same shape, reference `.cursor/rules/e2e-testing.mdc` and, for anything touching auth/guardrails/API keys, `.cursor/rules/security.mdc` (httpOnly cookie behavior, hashed API keys, ReDoS-guard expectations — a generated auth spec that does not assert these is missing the point of the spec).

**k6** — reference `.cursor/rules/load-testing.mdc` (new). Always state explicitly in the brief which tier you want (smoke / load / spike, `docs/TEST_PLAN.md` §8) — a generated script defaulting to the wrong tier is the most common way a "quick load test" accidentally becomes a 5-minute sustained run inside PR CI.

**Database/migration work** — reference `.cursor/rules/database-testing.mdc` (new) and `.cursor/rules/backend-testing.mdc` together; the former covers what is specific to the migration (schema isolation, data-move checklists, referential integrity), the latter covers the existing Testcontainers/Flyway pattern it builds on. Be explicit in the brief about which of `docs/TEST_PLAN.md` §10's six subsections you are asking for — "write a database test" is too vague to brief well; "write the schema-isolation check for guardrail-service per §10.2" is not.

## 4. Human Review Checklist

Run this over every Claude-Code-authored test before it is committed. Most items map directly to an anti-pattern the rest of this doc set already calls out — this is where they become checkable.

- [ ] Assertions test user-visible/API-contract behavior, not internal implementation details (a refactor that does not change behavior should not break the test)
- [ ] UI selectors are role/label/text-based; no brittle CSS class or XPath selectors that a styling change would break
- [ ] No `waitForTimeout`/hardcoded sleeps — waits on a real condition (element state, response, etc.)
- [ ] Test data isolation followed: creates and cleans up its own project/user, does not depend on `R__01_seed_local_dev.sql`'s specific rows (`docs/TEST_PLAN.md` §11)
- [ ] Database-touching changes (migrations, cross-service data assumptions) follow `.cursor/rules/database-testing.mdc` — no cross-schema SQL, no assumption about cascade/orphan behavior that has not actually been decided (`docs/TEST_PLAN.md` §10.3)
- [ ] Tagged correctly (`@smoke` vs `@regression`)
- [ ] No real LLM provider calls anywhere in the test or the fixtures it uses
- [ ] k6 thresholds match the agreed values (§14 of `docs/TEST_PLAN.md`) — not silently loosened to make a run green
- [ ] Actually executed, with real output shown — not accepted on the claim it "should" pass
- [ ] No skipped, `.only()`, or `xfail` tests introduced to get a run green without flagging it to you first
- [ ] Reuses existing shared fixtures/page objects rather than duplicating their logic inline

## 5. Maintenance Loop

**Flaky test triage.** Attach the failing run's trace/log to Claude Code and ask for a root-cause hypothesis (timing, race condition, test-data collision, selector fragility) before asking for a fix — a fix without a stated hypothesis is a guess, and guesses are how a "fixed" flaky test comes back three weeks later. Once a fix is proposed, run it locally 10 times, not once, before merging — flakiness by definition does not always reproduce on the first try, so a single green run proves nothing.

**Contract/OpenAPI drift.** When a service's endpoint shape changes, ask Claude Code to diff the old and newly-generated OpenAPI spec and update `contract/validate-openapi.sh` plus any affected Playwright API assertions in the same PR — letting the contract check and the API tests drift out of sync independently is how a breaking change ships unnoticed.

**k6 result interpretation.** After a load or spike run, Claude Code can draft the summary (p95/p99 trend versus the previous baseline, error rate, any threshold breach) as a first pass for the phase issue's results comment — per `docs/TEST_PLAN.md` §6 Phase 2, this comparison is what informs the reactive-stack go/no-go call. The summary is a draft; the go/no-go call is yours.

## 6. Coordinating Two Parallel Claude-Code-Assisted SDETs

- `git pull` before starting a session, and check `docs/TEST_PLAN.md` §4's ownership table plus the current phase's checklist in §6 for anything the other SDET has already claimed or merged — a shared fixture generated twice, slightly differently, is a worse outcome than a two-line message asking first.
- Shared fixtures (`tests/e2e/fixtures/**`, `tests/load/k6/lib/**`) are joint-owned. If a Claude Code session needs one that might already exist, check before generating a duplicate.
- One Claude Code session per issue/branch — the same discipline as the human-only workflow in `docs/ISSUE_WORKFLOW.md`. A session that accumulates unrelated changes across issues is harder for the other SDET to review and harder to roll back independently.
- Commit messages and PR titles follow Conventional Commits plus the issue number regardless of who or what typed them: `test(e2e): guardrail set evaluation journey (#102)`.

## 7. Hard Guardrails — Do Not

- Do not let Claude Code delete, skip, or `.only()` a failing test to make a run pass without flagging it to you first — surface the failure, never hide it.
- Do not accept "this should pass" without Claude Code actually running the test and showing the output.
- Do not let any generated k6 scenario call a real LLM provider — forbidden by `docs/TEST_PLAN.md` §8 and `.cursor/rules/security.mdc` alike; a load generator hitting a real provider key is both a cost risk and a rate-limit risk.
- Do not let Claude Code unilaterally change an agreed SLA/threshold (`docs/TEST_PLAN.md` §14) — that is a team decision, not something to resolve inside a single PR.
- Do not merge Claude-Code-authored test changes without the other SDET's review — same bar as any other change in this repo.

## 8. Worked Example — Phase 1 `guardrail.spec.ts`

**1. Human writes the scenario list** (before opening Claude Code):

```
- Given a logged-in admin, when they create a guardrail set with a keyword-
  blocklist rule and a regex-filter rule, then both appear in the set in the
  order added.
- When they submit a regex pattern that trips the ReDoS length/complexity
  guard, then the API rejects it and the UI surfaces the rejection reason.
- When they run the test panel against sample text that matches the keyword
  blocklist, then the evaluator reports a block with the correct rule id.
- When short-circuit is enabled and the first rule blocks, then later rules
  in the set do not also run (assert via evaluator response, not by
  guessing at timing).
```

**2. Brief to Claude Code:**

```
Implement these four scenarios in tests/e2e/ui/guardrail.spec.ts.
Model the file structure after tests/e2e/ui/dashboard.spec.ts.
Reuse tests/e2e/fixtures/auth.ts and test-project.ts — do not re-implement
login or project setup inline.
Follow .cursor/rules/e2e-testing.mdc and .cursor/rules/security.mdc (the
ReDoS scenario should assert the same guard behavior described there).
Tag all four @regression (not @smoke — this is Phase 1 depth, not the
day-one smoke check).
Run the spec against the local docker-compose stack and paste the actual
Playwright output.
```

**3. Definition of done for this piece:** all four scenarios pass locally with real output shown, the review checklist in §4 is clean, the PR references issue #102 (Phase 1 — guardrail-service) and is opened for the other SDET to review, matching the same branch/PR pattern as `docs/ISSUE_WORKFLOW.md`.

## 9. References

- `docs/TEST_PLAN.md` — what to test, phase by phase
- `docs/ISSUE_WORKFLOW.md` — branch/PR conventions this workflow inherits
- `docs/MICROSERVICES_PLAN.md` — the architecture this test plan is built against
- `.cursor/rules/e2e-testing.mdc`, `.cursor/rules/load-testing.mdc`, `.cursor/rules/database-testing.mdc` (new — see below)
- `.cursor/rules/frontend-testing.mdc`, `.cursor/rules/backend-testing.mdc`, `.cursor/rules/security.mdc` (existing)
