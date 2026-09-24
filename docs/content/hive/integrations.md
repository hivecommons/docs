# Supported agents & inference engines

Hive supports agent CLIs, inference engines, and OpenAI-compatible model gateways by backend ID. These are supported software integrations; inclusion does not imply endorsement or a partnership.

## ![Claude Code by Anthropic](/integrations/claude.svg) Claude Code [#claude-code]

- **Owner:** Anthropic
- **What Hive does:** launches Claude Code as an agentic CLI, applies Hive's prompt, permissions, audit, and queue controls, and records the configured model with the agent.
- **Hive config:** `backend: claude`
- **Official link:** [Claude Code](https://www.anthropic.com/claude-code)

## ![GitHub Copilot CLI by GitHub](/integrations/githubcopilot.svg) GitHub Copilot CLI [#github-copilot-cli]

- **Owner:** GitHub
- **What Hive does:** launches Copilot CLI for unattended agent work with Hive-managed repository scope, permissions, and audit trails.
- **Hive config:** `backend: copilot`
- **Official link:** [GitHub Copilot CLI reference](https://docs.github.com/copilot/reference/copilot-cli-reference)

## ![Goose by Block](/integrations/goose.png) Goose [#goose]

- **Owner:** Block
- **What Hive does:** launches Goose as an agent CLI and delivers Hive prompts and kicks through the Goose runtime.
- **Hive config:** `backend: goose`
- **Official link:** [Goose](https://block.github.io/goose/)

## ![OpenAI Codex CLI by OpenAI](/integrations/openai.svg) OpenAI Codex CLI [#openai-codex-cli]

- **Owner:** OpenAI
- **What Hive does:** launches Codex CLI for agent tasks and passes Hive's selected model and reasoning-effort settings where supported.
- **Hive config:** `backend: codex`
- **Official link:** [OpenAI Codex CLI](https://github.com/openai/codex)

## ![Pi by Earendil Works](/integrations/pi.png) Pi [#pi]

- **Owner:** Earendil Works
- **What Hive does:** launches the Pi coding-agent CLI as a long-running interactive backend and sends Hive kicks when the CLI is ready.
- **Hive config:** `backend: pi`
- **Official link:** [Pi](https://pi.dev/)

## ![IBM Bob by IBM](/integrations/ibm.svg) IBM Bob [#ibm-bob]

- **Owner:** IBM
- **What Hive does:** launches the IBM Bob / bobshell CLI with Hive-managed headless authentication, approval, and workspace trust settings.
- **Hive config:** `backend: bob`
- **Official link:** [IBM watsonx Code Assistant](https://www.ibm.com/products/watsonx-code-assistant)

## ![Aider open source coding agent](/integrations/aider.png) Aider [#aider]

- **Owner:** Aider open source project
- **What Hive does:** launches Aider as an agent CLI and can apply Hive's per-agent prompts, repository context, and audit controls.
- **Hive config:** `backend: aider`
- **Official link:** [Aider](https://aider.chat/)

## ![Gemini CLI by Google](/integrations/googlegemini.svg) Gemini CLI [#gemini-cli]

- **Owner:** Google
- **What Hive does:** launches Gemini CLI for operators whose Google access still supports that CLI and treats it as an agentic backend.
- **Hive config:** `backend: gemini`
- **Official link:** [Gemini CLI](https://github.com/google-gemini/gemini-cli)

## ![Google Antigravity CLI by Google](/integrations/google.svg) Google Antigravity CLI [#google-antigravity-cli]

- **Owner:** Google
- **What Hive does:** launches the Antigravity CLI (`agy`) as Google's current Hive-supported agent CLI, with Hive managing unattended mode and reasoning effort.
- **Hive config:** `backend: agy`
- **Official link:** [Google Antigravity CLI](https://github.com/google-antigravity/antigravity-cli)

## ![OpenCode agent CLI](/integrations/opencode.svg) OpenCode [#opencode]

- **Owner:** OpenCode project
- **What Hive does:** launches OpenCode as a supported terminal coding-agent backend and routes Hive prompts to it.
- **Hive config:** `backend: opencode`
- **Official link:** [OpenCode docs](https://opencode.ai/docs/)

## ![Kilo Code agent CLI](/integrations/kilo.png) Kilo Code [#kilo-code]

- **Owner:** Kilo
- **What Hive does:** launches Kilo Code as a supported agentic CLI backend for Hive-managed work.
- **Hive config:** `backend: kilo`
- **Official link:** [Kilo CLI](https://kilo.ai/cli)

## ![Muse Code by Meta](/integrations/meta.svg) Muse Code [#muse-code]

- **Owner:** Meta
- **What Hive does:** launches Muse Code as a supported CLI backend when installed by the operator.
- **Hive config:** `backend: muse`
- **Official link:** [Muse Code docs](https://musecodes.io/docs/)

## Oh My Pi

- **Owner:** can1357
- **What Hive does:** launches Oh My Pi through the `omp` backend and passes Hive's selected model and approval behavior.
- **Hive config:** `backend: omp`
- **Official link:** [Oh My Pi](https://github.com/can1357/oh-my-pi)

## ![vLLM inference engine](/integrations/vllm.png) vLLM [#vllm]

- **Owner:** vLLM project
- **What Hive does:** routes inference through a vLLM-compatible OpenAI API endpoint while Hive drives agent turns and audit metadata.
- **Hive config:** `backend: vllm`
- **Official link:** [vLLM](https://www.vllm.ai/)

## ![llm-d inference engine](/integrations/llm-d.png) llm-d [#llm-d]

- **Owner:** llm-d project
- **What Hive does:** routes inference through an llm-d OpenAI-compatible endpoint for self-hosted model serving.
- **Hive config:** `backend: llm-d`
- **Official link:** [llm-d](https://llm-d.ai/)

## ![LiteLLM by BerriAI](/integrations/litellm.png) LiteLLM [#litellm]

- **Owner:** BerriAI
- **What Hive does:** routes model calls through LiteLLM as an OpenAI-compatible proxy for centrally managed models and keys.
- **Hive config:** `backend: litellm`
- **Official link:** [LiteLLM](https://www.litellm.ai/)

## ![IBM watsonx.ai by IBM](/integrations/ibm.svg) IBM watsonx.ai [#ibm-watsonx-ai]

- **Owner:** IBM
- **What Hive does:** routes model calls through watsonx.ai's OpenAI-compatible gateway and handles the IBM project and token settings required by Hive configuration.
- **Hive config:** `backend: watsonx`
- **Official link:** [IBM watsonx.ai](https://www.ibm.com/products/watsonx-ai)

## ![OpenRouter model gateway](/integrations/openrouter.svg) OpenRouter [#openrouter]

- **Owner:** OpenRouter
- **What Hive does:** uses OpenRouter as a named model gateway for OpenAI-compatible routing when configured by an operator.
- **Hive config:** `backend: openrouter`
- **Official link:** [OpenRouter](https://openrouter.ai/)

## ![Anthropic model provider](/integrations/anthropic.svg) Anthropic [#anthropic]

- **Owner:** Anthropic
- **What Hive does:** records and routes Anthropic-backed models through the configured CLI or gateway while preserving Hive audit metadata.
- **Hive config:** `backend: anthropic`
- **Official link:** [Anthropic](https://www.anthropic.com/)

## ![OpenAI model provider](/integrations/openai.svg) OpenAI [#openai]

- **Owner:** OpenAI
- **What Hive does:** records and routes OpenAI-backed models through the configured CLI or gateway while preserving Hive audit metadata.
- **Hive config:** `backend: openai`
- **Official link:** [OpenAI](https://openai.com/)

## ![DeepSeek model provider](/integrations/deepseek.svg) DeepSeek [#deepseek]

- **Owner:** DeepSeek
- **What Hive does:** routes DeepSeek-backed models through a configured OpenAI-compatible gateway such as LiteLLM.
- **Hive config:** `backend: deepseek`
- **Official link:** [DeepSeek](https://www.deepseek.com/)

## Infrastructure thanks


![Akamai (Linode) infrastructure provider](/integrations/akamai.svg) ![Oracle Cloud (OKE) infrastructure provider](/integrations/oracle.svg) ![Cloudflare DNS edge and tunnels provider](/integrations/cloudflare.svg) ![GitHub Copilot AI inference supporter](/integrations/github-copilot.svg) ![Bluehost domain hosting provider](/integrations/bluehost.svg)

Hive Commons thanks [Akamai (Linode)](https://www.linode.com/) and [Oracle Cloud (OKE)](https://www.oracle.com/cloud/cloud-native/kubernetes-engine/) for Kubernetes infrastructure donated through the CNCF, [Cloudflare](https://www.cloudflare.com/) for DNS, edge and tunnels, [GitHub Copilot](https://github.com/features/copilot) for AI inference donated to CNCF projects through the CNCF, and [Bluehost](https://www.bluehost.com/) for domain hosting.
