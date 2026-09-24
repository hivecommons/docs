# Using Spektacular with Hive

Spektacular (Spek) is a spec-driven development CLI: an idea becomes a **spek**, the
spek becomes a **plan**, the plan becomes **code**, and a coding agent does the
writing at each step. Hive is the governor that decides which work gets done,
who does it, and when it may land.

Together they give you *long-running runs*: one GitHub issue that is too big
for a single direct-fix PR moves through `spec → plan → implement` on one Hive
lease, with a human checkpoint between stages. Spek owns the artifacts
(`.spektacular/specs/…`, `.spektacular/plans/…`); Hive owns the workflow (who
holds the lease, when a stage is finished, when the next one is released).

This guide covers Hive **v6**. The stage runner is OFF by default and
existing direct-fix behaviour is unchanged until you turn it on.

## What you get

| Stage | Who does the work | How Hive knows it is done | What releases the next stage |
| --- | --- | --- | --- |
| `spec` | A contributor agent claims the `spec` stage and runs the Spek spec workflow in the repo | `spektacular spec status <name>` reports `document_status: final` | Owner checkpoint (`runs.checkpoints.spec`) |
| `plan` | A contributor agent claims the `plan` stage and runs the plan workflow | `spektacular plan status <name>` reports `final`; Hive imports the plan's tasks as a DRAFT epic | Plan approval (`POST /api/plans/{id}/approve`, `!runs approve <key>`, or the dashboard checkpoint) |
| `implement` | Contributor agents claim the imported tasks | Existing hold-gated PR flow | — |

Hive never opens a Spek file. Every fact about an artifact comes
through the CLI (`spektacular … status`), and a test in `pkg/spektacular`
enforces that.

## Prerequisites

1. **A Hive v6 hub** running at ACMM L3 or higher (you need agents that can
   claim work). See [Getting Started](/docs/hive/getting-started).
2. **The `spektacular` binary reachable by the hub process.**
   Spek is **not** baked into the Hive image. Install it where the hub
   runs, or mount it in:

   ```bash
   # Go
   go install github.com/jumppad-labs/spektacular@latest
   # Homebrew (macOS hubs)
   brew install jumppad-labs/homebrew-repo/spektacular
   ```

   For a containerised hub, bind-mount the binary and point
   `runs.spektacular.binary` at it (see below).
3. **The target repository initialised for Spek** with the same agent
   backend your contributors use:

   ```bash
   cd <repo>
   spektacular init claude     # or: bob, codex
   git add .spektacular AGENTS.md CLAUDE.md && git commit -s -m "chore: init spektacular"
   ```

   This installs the spec/plan/implement skills your agents will invoke and
   creates the `.spektacular/` project. Commit it: Hive contributors clone the
   repo and need the skills present.
4. **The hub's working directory must resolve the Spek project.** The
   runner executes `spektacular <spec|plan> status <name>` from the hub
   process's current directory with no `--dir` flag. Either start the hub from
   a checkout that carries the `.spektacular/` project, or register the repo
   in a Spek `config.yaml` at the hub's cwd (`repos:` list). If the
   status call answers `artifact_not_found` for a name your agent just wrote,
   this is the first thing to check.

## Enable it

Add to the hub's `config.yaml`:

```yaml
runs:
  max_stage_retries: 2          # generations one stage may burn (default)
  spektacular:
    enabled: true               # default false
    binary: spektacular         # or an absolute path, e.g. /opt/bin/spektacular
    poll_interval_s: 30         # default
  checkpoints:
    spec: true                  # owner approves the spec before planning
    plan: true                  # owner approves the plan before implementing
    implement: true             # relaxing this needs ACMM L5+

governor:
  work_source:
    type: github
    run_stages: true            # offer pending spec/plan/implement stages to agents
```

`runs.spektacular.enabled` and `binary` are also exposed in the Governor
dialog under **Features → Long-running runs** and via
`PUT /api/config/governor/features` (`spektacularEnabled`,
`spektacularBinary`). The runner is wired at boot, so **restart the hub** after
changing the toggle.

`run_stages: true` is what makes the `spec`, `plan` and `implement` stages
appear in the contribute queue as claimable work items. Without it the runner
can poll, but no agent is ever offered a stage.

## Starting a run

There are two ways an issue becomes a run.

### Label it

Add the `run/spec` label to a GitHub issue. On the next scheduler cycle Hive
creates the first stage lease (`<owner/repo>!<owner/repo>#<n>:spec`) instead of
kicking a direct fix. The `run/fix` label does the opposite: it forces the
normal direct-fix path.

### Let triage decide

```yaml
runs:
  triage:
    enabled: true
    spec_labels: [kind/feature, Epic, architecture discussion]
    fix_labels: [kind/bug, good first issue]
    min_body_chars: 80
    clarify_comment: true
```

With triage on, every actionable issue is classified before a direct-fix kick:
complex issues or issues carrying a `spec_label` are admitted as a `spec` run;
simple/medium issues and `fix_labels` stay on direct-fix; thin issues (short
body, unchosen option lists, template placeholders) get one `hive-triage`
comment asking for details and are skipped that cycle. The verdict is stored on
the lease (`triage_verdict`, `triage_rationale`) and shown in `GET /api/runs`.

## What happens next

1. A contributor agent claims `spec: <issue title>` from the queue. Its prompt
   is the run-stage work item; the agent uses the installed Spek skill
   to write `.spektacular/specs/<name>.md` and mark it final.
2. Every 30 s the runner asks `spektacular spec status <name>`.
   - `draft` → leave the lease alone.
   - `final` → write a stage receipt
     (`/data/runs/receipts/<runKey>/spec-gen<gen>.json`), fire the
     `stage_completed` hook, and advance the lease to `plan`. If
     `runs.checkpoints.spec` is `true` the run waits for an owner first.
3. An agent claims `plan: …` and writes the plan. On `final`, Hive imports the
   plan's tasks (`spektacular plan export <name> --format json`, falling back
   to `<name>/tasks.json` or a `- [T1] …` task list in `plan.md`) into a DRAFT
   epic keyed by the run.
4. An owner approves the plan — dashboard checkpoint, `!runs approve <key>` in
   chat, or `POST /api/plans/{id}/approve`. Only then does `implement` appear
   in the queue, one work item per plan task with the plan's dependencies
   preserved.
5. Implementation is the normal Hive PR flow: hold gates, review, DCO,
   attribution. There is no Spek document for `implement`; the runner
   never polls it.

Watch it with:

```bash
curl -fsS -H "Authorization: Bearer $HIVE_TOKEN" "$HIVE_URL/api/runs" | jq
curl -fsS -H "Authorization: Bearer $HIVE_TOKEN" "$HIVE_URL/api/runs/owner%2Frepo%23123" | jq '.stages'
```

The Runs card on the dashboard and `!runs` in chat show the same data.

## Retries, escalation and stale plans

- A stage lease that expires without `final` is retried as a new generation
  while `max_stage_retries` allows. At the default of 2 the stage runs once, is
  retried once, and the second expiry raises a `decision`-severity escalation.
  No third generation is minted; a person resets the stage or abandons the
  run.
- If a `final` artifact flips back to `draft` (someone edited the spek), the
  runner refuses to advance and parks the lease with reason `stale_plan`.
- If Spek strict mode invalidates an approved plan, `plan status`
  reports `stale`. Hive parks the run with `waiting_on: human`,
  `waiting_reason: stale_plan`. Recovery is a fresh plan and re-approval — it
  is never retried automatically.
- If the artifact a lease was minted for disappears and a differently named
  one replaces it, the runner refuses with `replaced_document`. It never
  rebinds a lease to a document it was not minted for.
- Checkpoint approvals carry the lease generation; a stale generation is
  refused with `409`, a non-owner with `403`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Hub log: `[spektacular] stage runner installed` never appears | `runs.spektacular.enabled` is false or the hub was not restarted |
| Stage leases exist but no agent claims them | `governor.work_source.run_stages` is not `true` |
| `artifact_not_found` for a name the agent wrote | Hub cwd does not resolve the Spek project (prerequisite 4), or the name was passed with `.md` / a path — always the bare `000057_name` |
| `unknown flag: --json` | Wrong Spek version; no verb takes `--json`, output is already JSON |
| Plan reaches `final` but stays parked, `import error` in log | Plan has neither `tasks.json` nor a parseable `- [T1] …` list; `plan export` is not yet in your Spek build |
| `implement` never appears | The imported plan epic is still a DRAFT — approve it |
| `runs.checkpoints.implement: false` is ignored | Hub is below ACMM L5; the implement checkpoint stays blocking |

## Known gaps (v6, September 2026)

- `spektacular plan export --format json` is an upstream request
  ([spektacular#50](https://github.com/hivecommons/spektacular/issues/50));
  until it ships, Hive uses the `tasks.json` / `plan.md` fallback.
- The runner has no per-repo working directory; one hub serving several
  Spek projects depends on a `config.yaml` `repos:` list at the hub's
  cwd.
- Spek is not shipped in the Hive image; installing or mounting it is
  the operator's job.
- The in-tree acceptance test (`just runs-e2e-v6`) exercises a **fake**
  `spektacular` CLI. Run a real spek/plan on a scratch repo before turning the
  runner on for a repo you care about.

## Reference

- [Spektacular stage runner](https://github.com/hivecommons/hive/blob/v6/src/docs/spektacular.md) — the full contract, receipt shape and fake-CLI scenarios
- [Runs](https://github.com/hivecommons/hive/blob/v6/src/docs/runs.md) — `/api/runs`, checkpoint policy, acceptance tests
- [Work sources](https://github.com/hivecommons/hive/blob/v6/src/docs/work-sources.md) — `run_stages: true` and the `<repo>!<runKey>:<stage>` key
- [Spektacular (Spek) README](/docs/spektacular/readme) and [How to use Spek](/docs/spektacular/getting-started) — the CLI itself
