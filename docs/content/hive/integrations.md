# Supported agents & inference engines

Hive supports agent CLIs, inference engines, and OpenAI-compatible model gateways by backend ID. These are software integrations; inclusion does not imply endorsement or a partnership unless marked **Partner**. Support tiers follow Hive's backend acceptance bar: T1 runs unattended in headless pods, T2 has Hive-wired local confinement or deny-listing, and T3 is experimental / opt-in for unconfined local use.

## Agent CLI backends by support tier

### T1 core — headless pod path

These backends are wired for unattended headless operation on the pod path.

| Backend | Integration | Hive config | Notes |
| --- | --- | --- | --- |
| ![Claude Code by Anthropic](/integrations/claude.svg) Claude Code | Anthropic agent CLI | `backend: claude` | Core CLI path with Hive prompt, permissions, audit, queue controls, and model recording. |
| ![LiteLLM by BerriAI](/integrations/litellm.png) Claude Code via LiteLLM | Claude Code pointed at a LiteLLM proxy | `backend: litellm` | Uses `ANTHROPIC_BASE_URL` / Hive LiteLLM settings; inherits Claude Code's local confinement posture. |
| ![GitHub Copilot CLI by GitHub](/integrations/githubcopilot.svg) GitHub Copilot CLI | GitHub agent CLI | `backend: copilot` | Hive manages repository scope, permissions, and audit trails for Copilot-driven work. |
| ![OpenAI Codex CLI by OpenAI](/integrations/openai.svg) OpenAI Codex CLI | OpenAI agent CLI | `backend: codex` | Passes Hive-selected model and reasoning-effort settings where supported. |
| ![Goose by Block / AAIF](/integrations/goose.png) Goose | Block / Agentic AI Foundation agent CLI | `backend: goose` | T1 on the pod path; local mode remains experimental because Hive cannot wire a local OS sandbox for Goose. |

### T2 supported — confined or deny-listed local path

These backends have a Hive-wired local confinement floor: an OS sandbox or an enforced deny-list for host-state commands.

| Backend | Integration | Hive config | Notes |
| --- | --- | --- | --- |
| ![Claude Code by Anthropic](/integrations/claude.svg) Claude Code / LiteLLM | Anthropic CLI, optionally through LiteLLM | `backend: claude` / `litellm` | Uses Claude Code's native sandbox locally; LiteLLM keeps the same posture. |
| ![OpenAI Codex CLI by OpenAI](/integrations/openai.svg) OpenAI Codex CLI | OpenAI agent CLI | `backend: codex` | Hive narrows local workspace access with Codex sandbox flags. |
| ![GitHub Copilot CLI by GitHub](/integrations/githubcopilot.svg) GitHub Copilot CLI | GitHub agent CLI | `backend: copilot` | Hive uses Copilot sandboxing and explicit repository scope. |
| ![Muse Code by Meta](/integrations/meta.svg) Muse Code | Meta agent CLI | `backend: muse` | Supported when installed by the operator and launched with Hive's local controls. |
| ![OpenCode agent CLI](/integrations/opencode.svg) OpenCode | OpenCode terminal coding agent | `backend: opencode` | Hive wires a host-state command deny-list rather than claiming OS confinement. |

### T3 experimental — explicit opt-in for unconfined local use

These backends are available but are experimental where Hive cannot wire local confinement. Local launch requires each backend's explicit `HIVE_<BACKEND>_DANGEROUSLY_RUN_UNCONFINED=1` opt-in; container mode remains preferred.

| Backend | Integration | Hive config | Notes |
| --- | --- | --- | --- |
| ![Goose by Block / AAIF](/integrations/goose.png) Goose (local) | Block / Agentic AI Foundation agent CLI | `backend: goose` | Experimental on contributor-local mode only; T1 on the pod path. |
| ![Google Antigravity CLI by Google](/integrations/google.svg) Google Antigravity CLI | Google agent CLI | `backend: agy` | Hive manages unattended mode and reasoning effort; local confinement is not wired. |
| ![IBM Bob by IBM](/integrations/ibm.svg) IBM Bob | IBM watsonx Code Assistant CLI / bobshell | `backend: bob` | Separate from the watsonx.ai inference gateway; headless use requires API-key auth. |
| ![Pi by Earendil Works](/integrations/pi.png) Pi | pi-coding-agent CLI | `backend: pi` | Long-running interactive backend with Hive kicks when ready. |
| ![Aider open source coding agent](/integrations/aider.png) Aider | Aider CLI | `backend: aider` | Uses provider credentials and Hive-provided repository context. |
| ![Kilo Code agent CLI](/integrations/kilo.png) Kilo Code | Kilo Code CLI | `backend: kilo` | Experimental local path; containerized operation is preferred. |
| Oh My Pi | Oh My Pi CLI | `backend: omp` | Hub-agent method and experimental contributor-local backend. |
| ![OpenHands agent CLI](/integrations/openhands.svg) OpenHands | OpenHands CLI, headless-only | `backend: openhands` | **New / experimental** ([hive#10634](https://github.com/hivecommons/hive/pull/10634)). Contributor relay only, headless mode only; T3 refusal-gated locally (`HIVE_OPENHANDS_DANGEROUSLY_RUN_UNCONFINED=1`) because the bare CLI has no sandbox Hive can wire. Not in the contributor image or the K8s headless allowlist. |

### Go-side only backend

| Backend | Integration | Hive config | Notes |
| --- | --- | --- | --- |
| ![Gemini CLI by Google](/integrations/googlegemini.svg) Gemini CLI | Google Gemini CLI | `backend: gemini` | Go-side manager launch only today; it has no contributor-relay wiring, so local-path support tiers do not apply until that is added. |

## Inference gateways and engines

Gateway backends are not agent binaries. Hive routes Claude-style agent calls through an OpenAI-compatible translation path to these endpoints, so CLI support tiers do not apply.

| Gateway | Hive config | What Hive does |
| --- | --- | --- |
| ![vLLM inference engine](/integrations/vllm.png) vLLM | `backend: vllm` | Routes inference to a vLLM OpenAI-compatible endpoint for self-hosted models. |
| ![llm-d inference engine](/integrations/llm-d.png) llm-d | `backend: llm-d` | Routes inference to distributed Kubernetes model serving. |
| ![LiteLLM by BerriAI](/integrations/litellm.png) LiteLLM | `backend: litellm` / gateway route | Centralizes model routing and keys behind a LiteLLM endpoint. |
| ![IBM watsonx.ai by IBM](/integrations/ibm.svg) IBM watsonx.ai | `backend: watsonx` | Uses watsonx.ai's OpenAI-compatible gateway and IBM project / token settings. |
| ![OpenRouter model gateway](/integrations/openrouter.svg) OpenRouter | `backend: openrouter` | Uses OpenRouter as a named gateway with operator-selected model IDs. |
| Custom OpenAI-compatible | `kind: custom` route | Lets operators point Hive at any compatible `/v1/chat/completions` endpoint. |

## Model providers and classifiers

| Integration | Hive config | Notes |
| --- | --- | --- |
| ![Jev by TypeSafe AI](/integrations/typesafe.png) Jev | `classifier.backend: jev` | TypeSafe AI — **Partner**. Optional v6 advisory smart classifier. |
| ![Anthropic model provider](/integrations/anthropic.svg) Anthropic | `backend: anthropic` | Provider surfaced through the configured CLI or gateway. |
| ![OpenAI model provider](/integrations/openai.svg) OpenAI | `backend: openai` | Provider surfaced through Codex, gateway routes, or compatible proxies. |
| ![DeepSeek model provider](/integrations/deepseek.svg) DeepSeek | `backend: deepseek` | Provider surfaced through a configured OpenAI-compatible gateway such as LiteLLM. |

TypeSafe AI is a Hive Commons partner.

## Planning, work sources, and related ecosystem

Hive sits in a broader agentic-maintenance ecosystem. These projects are either integrated today, tracked as related work, or useful context for operators comparing orchestration approaches.

| Project | Relationship |
| --- | --- |
| [Spektacular (Spek)](https://github.com/hivecommons/spektacular) | Creates speks and reviewed run plans for Hive long-running work. |
| [Flue](https://github.com/withastro/flue) | Report-only external-execution binding pilot through `pkg/extwork` when built with `extwork_flue`. |
| [Crustify](https://github.com/crustify-rs/crustify) / [Wavefront](https://github.com/crustify-rs/wavefront) | Work-source path for C/C++ to Rust migration graphs. |
| [GitHub Agentic Workflows / gh-aw](https://github.com/hivecommons/hive/issues/10625) | Related workflow orchestration effort tracked for ecosystem positioning. |
| [OpenAI Symphony](https://github.com/hivecommons/hive/issues/10626) | Related OpenAI multi-agent / orchestration work tracked for positioning. |
| [Goose / Agentic AI Foundation](https://github.com/hivecommons/hive/issues/10627) | Goose is a Hive backend and an AAIF ecosystem project. |
| [OpenHands](https://github.com/OpenHands/OpenHands) | New experimental Hive CLI backend, headless-only at the time of listing. |
| [vibe-kanban](https://github.com/BloopAI/vibe-kanban) | Local kanban UI for coding-agent CLIs; a report-only Hive queue → board bridge is proposed in [hive#10641](https://github.com/hivecommons/hive/issues/10641). |

## Infrastructure thanks

![Akamai (Linode) infrastructure provider](/integrations/akamai.svg) ![Oracle Cloud (OKE) infrastructure provider](/integrations/oracle.svg) ![Cloudflare DNS edge and tunnels provider](/integrations/cloudflare.svg) ![GitHub Copilot AI inference supporter](/integrations/github-copilot.svg) ![Bluehost domain hosting provider](/integrations/bluehost.svg)

Hive Commons thanks [Akamai (Linode)](https://www.linode.com/) and [Oracle Cloud (OKE)](https://www.oracle.com/cloud/cloud-native/kubernetes-engine/) for Kubernetes infrastructure donated through the CNCF, [Cloudflare](https://www.cloudflare.com/) for DNS, edge and tunnels, [GitHub Copilot](https://github.com/features/copilot) for AI inference donated to CNCF projects through the CNCF, and [Bluehost](https://www.bluehost.com/) for domain hosting.

## Source control, work sources, and sign-in

The product landing page groups runtime integrations separately from the agent CLI and inference list above. Current shipped surfaces are:

- **Source control:** GitHub and GitHub Enterprise are the production GitHub App path. The forge-neutral adapter layer includes GitLab and Gitea / Forgejo issue and change-request flows as those paths graduate.
- **Work sources:** GitHub Issues (default), GitHub Projects, Linear, Jira Cloud, Jira Data Center / Server (`deployment: datacenter`), Spektacular run stages, and Crustify / Wavefront migration graphs.
- **Sign-in:** Microsoft, GitHub, IBM, Google, and other OIDC providers by hub configuration.

Jira Data Center / Server support uses Jira REST API v2, preserves context-path base URLs, and supports Personal Access Token bearer auth or basic auth fallback. Custom CA and TLS trust settings are still in progress and are not listed as shipped stable functionality.

## Recent Hive platform additions

- **Swarm mode:** per-repository swarms with idle-unlock, themes, Discord announcements, and `/api/leaderboard/swarm`.
- **The Commons:** contributors can subscribe to multiple hives, rank them, and choose `ranked`, `spread`, or `neediest` routing; `hivectl hives web` opens a local management UI.
- **Teams and achievements:** distro / OS / agent team leaderboards are exposed at `/api/leaderboard/teams`, and Achievements 2.0 adds Solo, Dual, Fireteam, and Raid tiers plus the local-model track.
- **Edge-only v6:** admin MCP (`/api/admin/mcp`, `cmd/hive-admin-mcp`) and the dashboard Extensions tab for Spektacular are on the v6 edge branch until that line is promoted.
