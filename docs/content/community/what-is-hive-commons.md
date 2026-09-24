# What is Hive Commons?

**Hive Commons is the umbrella community for Hive** — an AI-agent fleet
orchestration system that runs governed swarms of coding agents against real
repositories — and for the family of tools that grew up around it.

Our founding premise: **human judgment is the scarce resource.** Agents are
tooling. Every decision, every merge, and every identity belongs to a named
human, and governance is enforced in code rather than in prose.

## What Hive does

Hive is a control layer for running governed fleets of AI coding agents.
Agents pick up issues, open pull requests, review code, repair CI, and answer
contributors — under a six-level maturity model (ACMM, the AI-native
Capability Maturity Model) that decides exactly what they may do and enforces
it with matching least-privilege GitHub token scopes.

- **Hub and spokes.** A single Go binary that runs as a Kubernetes workload, a
  Docker Compose stack, or Podman Quadlet units. An optional hub coordinates
  many self-hosted spoke hives, with a public registry and cross-hive
  leaderboards.
- **Governance in code.** Trust is dialed up one capability at a time, from
  advisory-only (L1) through to merging on green CI (L6).
- **Audited and accountable.** A deterministic pipeline handles filtering,
  classification, and merge-gating before any LLM sees the work; agents only
  handle judgment calls, and every action lands in the audit log.

Hive is used in production by KubeStellar Console, tunaos.org, and Project
Bluefin; see [ADOPTERS.md](https://github.com/hivecommons/hive/blob/v5/ADOPTERS.md)
for the current list.

## The project family

Hive is the orchestration system and the delivery surface for the family.
Each tool beside it removes a specific piece of friction from working with
agents, and each is useful on its own.

| Project | What it does | Docs |
|---|---|---|
| [**Hive**](https://github.com/hivecommons/hive) — flagship | A control layer for running governed fleets of AI coding agents against real repositories. | [Hive docs](/docs/hive/overview/introduction) |
| [**Spektacular (Spek)**](https://github.com/hivecommons/spektacular) — newest member | Spec-driven development for AI coding agents. A markdown spek becomes a reviewed plan and an agent-driven implementation, each step a resumable state machine. | [Spektacular docs](/docs/spektacular/overview/introduction) · [spektacular.dev](https://spektacular.dev) |
| [**hotshot**](https://github.com/hivecommons/hotshot) | Screenshots that land directly in an AI coding assistant's terminal. | [hotshot docs](/docs/hotshot/overview/introduction) |
| [**pluk**](https://github.com/hivecommons/pluk) | Structured event streaming for tmux sessions running AI coding agents. | [pluk docs](/docs/pluk/overview/introduction) |
| [**promptargs**](https://github.com/hivecommons/promptargs) | Template expansion for prompts across Claude Code, Copilot, Goose, Bob, and others. | [promptargs docs](/docs/promptargs/overview/introduction) |
| [**rationguard**](https://github.com/hivecommons/rationguard) | Detects and rebuts rationalization patterns in agent output. | [rationguard docs](/docs/rationguard/overview/introduction) |
| [**dibs**](https://github.com/hivecommons/dibs) | A contributor attribution layer for the AI-agent era. Your idea, your credit, their code. | [README](https://github.com/hivecommons/dibs#readme) |

### How the pieces fit

Spek handles **one feature at a time**: spec → plan → implement, with
a human review between each step. Hive is where that work is **scaled up** —
it orchestrates fleets of agents across repositories with the governance and
audit trail that running agents at that scale demands. A Spek workflow
is the unit of work a fleet orchestrator schedules. hotshot, pluk, promptargs,
rationguard and dibs sit alongside both, making the individual agent session
more observable, more reproducible, and properly attributed.

## An open community

Every repository in the organization is Apache 2.0 licensed, requires DCO
sign-off on every commit, and follows the CNCF Code of Conduct. Hive is
maintained by a Maintainer Committee spanning multiple organizations, with a
documented contributor ladder and explicit governance for AI-agent
contributions. Hive Commons has applied for the
[CNCF Sandbox](https://github.com/cncf/sandbox/issues/516).

- [Governance](https://github.com/hivecommons/.github/blob/main/GOVERNANCE.md) · [Maintainers](https://github.com/hivecommons/.github/blob/main/MAINTAINERS.md) · [Code of Conduct](https://github.com/hivecommons/.github/blob/main/CODE_OF_CONDUCT.md) · [Security policy](https://github.com/hivecommons/.github/blob/main/SECURITY.md)
- **Mailing list:** [hivecommons-dev@googlegroups.com](https://hivecommons.dev/join) — joining adds the community meeting to your calendar
- **Community meeting:** every other Thursday, 10:00 AM ET — [meeting page](/docs/community/meetings) · [agenda and notes](https://hivecommons.dev/agenda) · [recordings](https://hivecommons.dev/tv)
- **Chat:** [Discord](https://hivecommons.dev/discord)
- **Website:** [hivecommons.dev](https://hivecommons.dev)

## Is your project a fit?

If you maintain an open source project that removes friction from working
with AI coding agents and you share these values, we'd like to hear from you.
See [Join Hive Commons](/docs/community/join-hive-commons).
