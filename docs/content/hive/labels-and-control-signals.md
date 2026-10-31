> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals.md) during the docs build. Edit the canonical source in the Hive repository.

# Hive Labels and Control Signals

This is the operator view of Hive labels: if you add or remove a label, this is what the v5 code does. It also calls out non-label controls that look like labels from the dashboard.

The page is split into one file per area under [`labels-and-control-signals/`](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/) so concurrent edits do not collide. Every section keeps its heading and anchor inside its page.

## Pages

| Page | Covers |
|---|---|
| [`labels-and-control-signals/reference.md`](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/reference.md) | First use, label axes, categories and the full reference table |
| [`labels-and-control-signals/stage-labels.md`](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/stage-labels.md) | Stage labels (`stage/NNN-*`) and the pipeline state machine |
| [`labels-and-control-signals/glossary-and-operations.md`](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md) | Decision glossary, blockers, matching rules, config, question auto-close, lifecycle examples and follow-ups |

## Sections

- <a id="first-use-choose-the-control"></a>[First use: choose the control](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/reference.md#first-use-choose-the-control)
- <a id="label-axes"></a>[Label axes](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/reference.md#label-axes)
- <a id="categories"></a>[Categories](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/reference.md#categories)
- <a id="reference-table"></a>[Reference table](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/reference.md#reference-table)
- <a id="stage-labels-stagennn--the-pipeline-state-machine"></a>[Stage labels (`stage/NNN-*`): the pipeline state machine](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/stage-labels.md#stage-labels-stagennn--the-pipeline-state-machine)
- <a id="decision-glossary"></a>[Decision glossary](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#decision-glossary)
- <a id="blockers-hiveblocker-marker"></a>[Blockers (`hive:blocker` marker)](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#blockers-hiveblocker-marker)
- <a id="how-labels-reach-agents"></a>[How labels reach agents](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#how-labels-reach-agents)
- <a id="matching-rules"></a>[Matching rules](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#matching-rules)
- <a id="config-that-changes-label-behavior"></a>[Config that changes label behavior](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#config-that-changes-label-behavior)
- <a id="question-auto-close"></a>[Question auto-close](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#question-auto-close)
- <a id="lifecycle-examples"></a>[Lifecycle examples](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#lifecycle-examples)
- <a id="non-label-equivalents"></a>[Non-label equivalents](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#non-label-equivalents)
- <a id="repo-card-legend-vocabulary"></a>[Repo-card legend vocabulary](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#repo-card-legend-vocabulary)
- <a id="documented-inconsistencies-and-follow-ups"></a>[Documented inconsistencies and follow-ups](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/glossary-and-operations.md#documented-inconsistencies-and-follow-ups)

<a id="the-regressed-marker-when-it-is-set-when-it-clears"></a>The `regressed` marker rules are in [stage labels](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/stage-labels.md#the-regressed-marker-when-it-is-set-when-it-clears).
