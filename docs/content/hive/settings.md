> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/settings.md) during the docs build. Edit the canonical source in the Hive repository.

# Dashboard settings explained

This page is the starting point for the dashboard's **Settings** tabs. It has one entry per tab: what the tab controls and which page explains it in depth.

Every setting on a Settings tab has a small **?** mark next to its name. Rest the pointer on it, or move to it with the Tab key, to see a short explanation of the setting. Click it, tap it, or press Enter on it to open the page that explains the setting in a new tab. When a setting has its own guide, the mark opens that guide; otherwise it opens this page at the tab's entry. Clicking a mark never changes the setting.

For the dashboard's other sections, see [Dashboard sections explained](/docs/hive/dashboard-sections); to find a section or a tab by its on-screen name, see the [Dashboard UI map](/docs/hive/dashboard-ui-map). If a key has no editable control, see [Editing `hive.yaml`](/docs/hive/editing-hive-yaml) for file locations and reload behavior.

## Linking to a setting

`<dashboard>/#config/governor/<tab>` opens Settings on a tab. Add a search term as a third part, `<dashboard>/#config/governor/<tab>/<query>`, and Settings opens with the search box already holding `<query>`, so the results list the matching settings. For example, `#config/governor/Features/issues.close_on_merge` opens Settings searching for that key.

### Triage: does this RFC already exist?

Many RFCs ask for something a setting already does. With `issues.rfc_existing_check.enabled: true` (default off), Hive checks each new open issue labelled `rfc`, `enhancement` or `kind/feature` against the Settings search index. It compares the issue title and body with each indexed setting's key, label, section and search text by keyword overlap. There is no model call. Hive then posts one comment carrying `<!-- hive:rfc-existing-coverage -->`. The comment lists the best matches. Each match links to Settings with the search set to its key (the link above, built from `dashboard.public_url`) and to a docs search for the key. Hive finds the marker before posting, so it never comments twice, including after a restart. The check only comments: it never adds labels, closes issues, or decides anything.

| Key | Default | Meaning |
|---|---|---|
| `issues.rfc_existing_check.enabled` | `false` | Turn the check on. |
| `issues.rfc_existing_check.post_when_nothing_found` | `false` | Also post a one-time "Nothing found" comment when no setting matches. |
| `issues.rfc_existing_check.labels` | `[rfc, enhancement, kind/feature]` | Labels that mark an issue as an RFC or feature request. Matching ignores case. |
| `issues.rfc_existing_check.max_matches` | `5` | Most settings listed in one comment. |
| `issues.rfc_existing_check.max_age` | `168h` | Skip issues opened longer ago than this, so turning the check on does not comment on the backlog. |

These keys are set in `hive.yaml` only; they have no Settings control yet.

## General

Hive-wide basics: the hive ID, the ACMM maturity level, how often the governor evaluates the hive, the fleet-wide default for explain mode, and whether agent-created PRs and issues carry an attribution trailer. The **Eval loop pacing** block sets the eval-interval cap, the webhook-healthy interval, the conserve-mode multiplier, how often optional sweeps run and the provider spend-limit probe interval; a saved change applies from the next eval cycle. It also shows, read-only, whether the mode thresholds are pack-seeded or operator-owned.

- ACMM levels and the agents each level runs: [ACMM levels](/docs/hive/agent-configuration#acmm-levels-agent-rosters-as-packs).
- Explain mode: [Explain mode](/docs/hive/agent-configuration#explain-mode-debugging-agent-behaviour).
- Every configuration block and notable field: [Hive operator reference](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md#configuration-blocks).

## Thresholds

The issue and PR counts that move the governor between modes, and how those thresholds scale as the hive manages more repos. See [Governor mode thresholds](/docs/hive/operations/agent-and-governor-controls/governor-thresholds).

## Labels

Which labels hold, require, or route work, the label the merger queue applies to queue a PR for auto-merge (applies after a restart), and the reporter-trust rules for outside PRs. See [Labels and control signals](/docs/hive/labels-and-control-signals) and [Label policy](/docs/hive/agent-configuration#label-policy-which-issues-agents-may-work).

## Repos

The repos the hive manages and the caps on how many issues and PRs are listed in one kick (`governor.kick_limits`). See the `governor.kick_limits` row of the [notable fields](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md#notable-fields).

To add a repository to an existing hive, open its dashboard and choose
**Settings → Repos**, or use the gear on **Projects**. Enter `org/repo` or the
GitHub URL for the hive's forge and choose **+ Add**. If the GitHub App needs
access, follow **Manage App access**, then choose **Re-check & add**. Choose
**Save & close** to apply the monitored list. Adding a repository from a
different organization migrates the hive to that organization. To request
a *new* hosted hive instead, use
[Request a hosted hive for a repo](/docs/hive/hub/hosted-hive-hub-onboarding#2-request-a-hosted-hive-for-a-repo).

The same tab has a **Parent auto-close** card (owner only, `repos.<key>.parent_autoclose`): per monitored repo, choose "Close finished parents (default)", "Also close epics and holds", "Also close trackers whose work is done" or "Never auto-close parents". It shows the effective value for each repo, applies on save without a restart, and is audited. A parent a person reopened is never re-closed, and issues marked as tracking issues are never auto-closed. See [stage-labels](/docs/hive/labels-and-control-signals/stage-labels#decomposed-parents--closed-by-their-children-never-stalled).

## Budget

The token budget and its rolling period, optional dollar and coin caps, the percentage at which the governor enters budget-critical mode, per-agent exemptions, and the model lock that stops automatic model downgrades. See [Governor cadence and budget](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md#governor-cadence-and-budget) and [Token collection and usage tracking](https://github.com/hivecommons/hive/blob/v5/src/docs/token-tracking.md).

## Notifications

The ntfy, Discord, and Slack destinations and which hive events are sent to them. See [Notifications](/docs/hive/dashboard/notifications#configuration).

## Health

The escalation breaker, which hands an agent's work to a human after a set number of consecutive red attempts, and the agent self-healing watchdog. See [Agent Self-Healing Watchdog](/docs/hive/operations/agent-and-governor-controls/agent-watchdog#configuration).

## Sensing

How long a rate-limit alert stays active and how long an agent is paused after a rate limit is detected.

## Logging

Where rolling log files are written, when they rotate, how long rotated files are kept, the log level, and whether rotated files are compressed. The log directory is read-only at runtime; change it in `hive.yaml`.

## Security and Access

Input/output scanning, the agent sandbox runner, and suspicious-activity alerts. See [ioscan](/docs/hive/security/ioscan), [Credential-free sandbox isolation](/docs/hive/security/sandbox-isolation), [Suspicious-activity alerts](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md#suspicious-activity-alerts-sentinel), and the [Security Model](/docs/hive/security-model).

## Features

Optional capabilities, each off or inert until you turn it on. Where a feature has its own guide, its **?** mark opens that guide:

- Retro loop: [Retro lane](/docs/hive/operations/automation-and-review/retro-lane).
- Formal verification: [Formal verification](/docs/hive/operations/automation-and-review/formal-verification).
- Audit publication: [Audit campaign](/docs/hive/operations/automation-and-review/audit-campaign#publication).
- Token mint: [Token mint](/docs/hive/security/token-mint).
- Spek stage runner: [Spektacular](/docs/hive/operations/automation-and-review/spektacular-stage-runner).
- Auto-merge: [App self-merge sweep](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md#app-self-merge-sweep-auto_merge), [Trusted bot authors](/docs/hive/operations/automation-and-review/hive-merge#trusted-bot-authors), and [Trusted-author auto-merge](/docs/hive/operations/automation-and-review/hive-merge#trusted-author-auto-merge).
- Review gate: [Review swarm](/docs/hive/operations/automation-and-review/review-swarm#configuration), [Blocking line and backlog](/docs/hive/operations/automation-and-review/review-swarm#blocking-line-reviewseverity-reviewbacklog), and [external review bot threads](/docs/hive/operations/automation-and-review/review-bot-threads).
- Trajectory review: [Trajectory-Review Lane](/docs/hive/operations/automation-and-review/trajectory-review#configuration).
- Reviewer-stated rules: [Reviewer-stated rules from review feedback](/docs/hive/review-feedback-rules#settings). A card under Review (owner only, `review_feedback.rules.*`) turns capture on or off, picks whose rules are recorded at once, adds phrases that count, and switches built-in signals off; each control shows its default and where the current value comes from.
- Linear agent: [Linear agent integration](/docs/hive/integrating-with-hive/linear-agent-integration).
- Upstream watch: [Upstream watch](/docs/hive/operations/automation-and-review/upstream-watch#configuration).

The other features on this tab (OpenTelemetry export, external execution, auto-plan, issue claims, PR follow-up, long-running runs, provider rotation, merge recommendations, convergence rollout, stall replan, and question auto-close) are explained by their **?** tooltips, and their configuration keys are listed in the [Hive operator reference](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md#configuration-blocks).

## Knowledge

Whether the public read-only knowledge MCP endpoint is on, the knowledge pipeline, and the external knowledge connectors. The **Knowledge pipeline** block opens with the **Mid-task advisor for sidecar runtimes** switch (`knowledge.sidecar_advise`, off by default, applies at once, needs `knowledge.advisor` set in `hive.yaml`; see [Sidecar runtimes](/docs/hive/agent-knowledge-and-memory#sidecar-runtimes-knowledgesidecar_advise)), then sets the bead synthesizer (schedule, target layer, minimum confidence, per-cycle fact and GitHub API caps, bead retention), scheduled curator promotion (schedule, threshold, source and target layers), repository code maps (schedule, layer, size cap) and the kick primer's fact and byte caps. Turning the bead synthesizer on or off applies at once; the other pipeline settings apply after a restart, and 0 or empty restores the default. The engine, the vault paths and the primer merge strategy are shown read-only because they are set in `hive.yaml`. The repositories to map and the primer priority list stay yaml-only. See [Knowledge curator](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-curator.md) and [Knowledge connectors](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-connectors.md).

## Meeting attendee

The persona hive attends meetings as (Betty by default): pick a preset or edit its name, display name, aliases, pronouns, voice type, language, accent, Kokoro voice, humor and intro (with a live preview and a **Play sample** button; clicking a preset card also plays that persona's introduction in its own voice, see [Hearing a preset](/docs/hive/meetings#hearing-a-preset)), set how often she answers room questions unprompted, and see the address people invite her with. Owner or read-write. Changes apply after a restart. See [Meeting attendee settings](/docs/hive/meetings#meeting-attendee-settings).

## Advisory

How many advisory findings are shown, how often they refresh, and when a finding counts as stale. See [Advisory](/docs/hive/operations/automation-and-review/advisory-digest) and [Advisory staleness](https://github.com/hivecommons/hive/blob/v5/src/docs/advisory-staleness.md).

## Work Source

Where Hive reads its work from (GitHub Issues, GitHub Projects, Linear, or Jira) and each source's credentials and filters. See [Work sources](/docs/hive/work-sources).

## Hub

The link between this hive and its hub: hub registration, public listing, heartbeat identifiers, automatic updates, public snapshots, and the contributor queue that relays draw work from.

- Hub registration: [Registering spokes to your hub](/docs/hive/hub/self-hosted-hub-deployment#registering-spokes-to-your-hub).
- Heartbeat identifiers: [Withholding heartbeat identifiers](/docs/hive/dashboard/data-collection-and-telemetry#withholding-heartbeat-identifiers).
- Snapshots: [Public snapshots](/docs/hive/dashboard/public-snapshots).
- Contributors: [ClankeR contributor relay](/docs/hive/contributor-relay) and [Contributor trust tiers and delegated agent roles](/docs/hive/security/contributor-trust-and-roles).

The **Hub settings** block at the bottom of the tab sets explicit task acceptance, the already-done label and hold, contributor wall retention, the contributor announcement (text, level, expiry), the snapshot rebuild interval, the self-upgrade drain timeout, the task-status push loop and the NPS prompt. They save with the rest of the tab; 0 or empty restores the default. The upgrade drain timeout and task-status push apply after a restart. While a self-upgrade is draining, the spoke reports the kicks it is waiting on and the time left in every heartbeat, so the hub holds the upgrade instead of abandoning it as orphaned; the hub timeline and stuck-upgrade alert show the drain. The cluster ID and hive type are shown read-only because hub provisioning writes them, as are the deprecated `contribute_already_done_unverified_hold_days` and `contribute_close_already_done` keys and the announcement ID the dashboard mints. The hub-only provision-request Discord webhook and NPS relay pull secret are write-only: the tab shows only whether each is set.

## Model Gateways

The OpenAI-compatible gateways (LiteLLM, OpenRouter, vLLM, and others) agents send inference through, and their keys. See [Configure model gateways and keys](/docs/hive/hub/hosted-hive-hub-onboarding#configure-model-gateways-and-keys).

## Appearance

The dashboard's look, stored under `dashboard.theme_overrides`: a background image (URL, opacity, position, size, attachment), the UI and monospace fonts, CSS token overrides and custom CSS. See [Appearance themes](/docs/hive/dashboard/dashboard-page-reference#appearance-themes).

## Agents

The managed agents (click a name to open that agent's settings tabs, described under [Agent: General](#agent-general) and below) and the **Backend placement policy**, which restricts the CLI or inference backends agents may use. Deny wins over allow, and an empty allow list permits every supported backend. See [Agent Configuration](/docs/hive/agent-configuration).

## Workflows

The workflow library: the workflows this hive can run for its repos. Each control's **?** tooltip explains it.

## Inbox

Settings for the [Inbox](/docs/hive/dashboard-sections#inbox) section. See [Input methods and the Inbox](/docs/hive/inbox-input-methods) and [Inbox and voice sources](/docs/hive/inbox-voice-sources).

## Project Observability

Targets for the managed project's telemetry and operations agents. Platforms are referenced by name only (an endpoint environment variable and a credential secret reference); literal URLs, tokens and API keys are refused. Hive's own OpenTelemetry export is set elsewhere. See [How to opt in](/docs/hive/dashboard/data-collection-and-telemetry#how-to-opt-in-governorproject_observability).

## Meetings

The connections Hive uses to join meetings: the Vexa tenant key and, for Discord, the bot token and the transcription and speech tokens. The tab shows only whether each secret is set. See [Meetings](/docs/hive/meetings).

## Forge App

The GitHub App (or other forge app) this hive authenticates as, the per-app key files it holds, and the GitHub API budget. See [GitHub App setup](/docs/hive/integrating-with-hive/github-app-setup) and [GitHub API budget governor](/docs/hive/operator-reference/sweeps-and-operations#github-api-budget-governor).

## Bob

The hive-wide API key for the IBM Bob CLI backend (agents that use bob cannot start without it) and the Bob session prefix. See [Tagging Bob sessions for Bobalytics](/docs/hive/operations/agent-and-governor-controls/agent-backend-support-tiers#tagging-bob-sessions-for-bobalytics).

## Variables

Named variables that agents' prompt templates can use: each has a name, a type, a scope, and a value or an environment variable, with an optional default.

## Dashboard

Settings for the dashboard itself (`dashboard.*`): its port and agent poll interval, the Experiment Lab, whether the header also shows the usage gauge, hub-proxied auth, Sessions, the dashboard auth token, the access allowlist, and the issue bands.

**Inception (spek) sessions** (`dashboard.sessions.enabled`, on by default) turns on the [Inception (spek)](/docs/hive/dashboard-sections#inception-spek) section, named shared CLI-agent terminals inside the dashboard that open in the hive's shared spek workspace, which replaced the removed Inception wizard. Set it to false to hide the section. The `HIVE_SESSIONS_ENABLED` environment variable, when set, overrides the switch, and the dialog says so. Beside it are the three limits, `dashboard.sessions.max_sessions`, `dashboard.sessions.max_per_user` and `dashboard.sessions.idle_ttl_hours`; 0 keeps the built-in default (12, 4 and 72), and `HIVE_SESSIONS_MAX`, `HIVE_SESSIONS_MAX_PER_USER` and `HIVE_SESSIONS_IDLE_TTL_HOURS` override them. **Answer the CLI startup screens** (`dashboard.sessions.autostart`, on by default) lets the hive take a starting session's CLI through its startup screens (first-run notice, trust for the session's folder, onboarding) to its input prompt, so the first request runs without a person; it never answers a permission prompt and never signs in, and `HIVE_SESSIONS_AUTOSTART` overrides the switch. See the [Sessions API](/docs/hive/api-reference/sessions).

**Also show the usage gauge in the header** (`dashboard.subscription_gauge_header`, off by default) adds a small fuel-dial chip to the header on every page, showing how much is left in the limit closest to running out across the plans the hive's agents spend (Claude, Copilot and others). The full gauge, with a row per provider, is on the Overview by default for the owner and can be hidden there from the Overview settings. Both show the measurements hive already makes; only the owner sees them; and they show the providers' plans, not the hive's token budget. See [Usage gauge](/docs/hive/dashboard/dashboard-page-reference#usage-gauge).

## Compliance

How your configuration maps to SOC 2, FedRAMP, and ISO 27001 controls. See [The Settings → Compliance tab](/docs/hive/security/compliance-controls#the-settings--compliance-tab).

## Agent: General

One agent's identity, engine, model, and behaviour: name, role, kick template, operating mode, sandbox, CLI pin, caveman, Jev, and explain modes, and the repos and keywords it works on. See [Agent Configuration](/docs/hive/agent-configuration#anatomy-of-an-agent).

## Agent: Pipeline

The deterministic pre-kick pipeline stages that run for this agent before the model is invoked. Turn a stage off to skip it for this agent. Each stage's **?** tooltip explains the stage. See [Agent Configuration](/docs/hive/agent-configuration).

## Agent: Hooks

Shell scripts the agent runs before each governor kick (pre-kick) and after it finishes and returns to idle (post-idle). Pre-kick scripts run in order. These per-agent scripts are separate from the hive-wide [state-triggered hooks](https://github.com/hivecommons/hive/blob/v5/src/docs/hooks.md).
