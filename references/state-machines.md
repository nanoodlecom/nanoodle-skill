# State-machine audit — 2026-11-06

This repository contains an Agent Skill, one JSON example, and documentation.
It has no application runtime, database, queue, server, package manifest, or
deployment workflow. Its implicit state machines are the agent decisions it
teaches and the executor lifecycles those decisions rely on. Executor changes
belong in nanoodle-js/nanoodle-py; this audit changes only this skill.

## Scope and source snapshots

The complete tracked tree was reviewed at skill base
[`bf7c1ef5d81099118010e5b80746bf75c976d450`](https://github.com/nanoodlecom/nanoodle-skill/tree/bf7c1ef5d81099118010e5b80746bf75c976d450).
There were no open PRs, tags, GitHub Releases, Actions workflows, or GitHub
deployment records when checked. All seven previous PRs were merged. This is
distribution from Git, not a running service or an npm/PyPI publication.

Executor evidence uses independently verified main snapshots, isolated from
other owners' working changes:

- JavaScript: [`7734e7f6209f153a634b37bd1a691b67cc276817`](https://github.com/nanoodlecom/nanoodle-js/tree/7734e7f6209f153a634b37bd1a691b67cc276817).
- Python: [`0ce5cf49ef8b1cf263a30fc4135c847a207fcad1`](https://github.com/nanoodlecom/nanoodle-py/tree/0ce5cf49ef8b1cf263a30fc4135c847a207fcad1).

These are source contracts, not a claim that every feature is present in every
installed or published version. Use the installed executor's `--version`,
`--help`, inspection output, and result schema. The stale claim that npm 0.8.0
was current was removed rather than replaced with another moving version.

## Inventory

| Lifecycle | States and transitions | Invariant / recovery rule |
|---|---|---|
| Skill distribution | absent → installed/copied snapshot → upstream changed → explicitly updated snapshot | A Git merge makes files available; it does not update an already installed copy. |
| Workflow source | local file/direct fragment → decoded JSON; short URL → redirects → fragment; damaged payload → recovered graph or rejected | Inspection must precede execution; a recovery warning requires reviewing the recovered graph. Direct fragments decode offline; short links require network I/O. |
| Materialization | raw graph → type aliases/media normalization/link migration → materialized graph + warnings → topology accepted/rejected | Loading is not execution. Unsupported nodes/cycles can still be rejected at run time; warnings are evidence to review. |
| Credentials | absent → explicit flag/env-file/environment key; or `--pay` → explicitly keyless invoice mode | Node/Python precedence differs. Do not log keys; do not accidentally switch to payment mode while diagnosing a keyed run. |
| Input resolution | stored default/blank → inspect required/optional keys → explicit input/setting overrides → media coercion → required/key validation | Empty optional inputs can clear defaults; wired fields come from upstream at execution. A valid interface does not prove a valid model or codec. |
| Scheduling | dependency waiting → runnable → running; independent lanes run concurrently | A downstream node waits for its own dependencies. One lane's failure does not roll back or necessarily stop another lane. |
| Node outcome | running → done/error; gate → gated, descendants → skipped; optional error policy → skipped with error | `skipped` is not proof of free execution: an error-skipped node may have started. A closed gate is a deliberate success; distinguish it from an execution error. |
| Remote generation | not submitted → submitted → synchronous result or accepted job ID → polling → completed/failed/unknown | A timeout or lost response can leave an accepted/billed provider job. Keep any job ID and inspect provider status before resubmission; persistence/receipt fields vary by runtime. |
| Payment | request → invoice → user-authorized wallet deposit → settlement wait → generation; expiry/cancel/lost response → uncertain state | Never infer a refund or an unpaid invoice from process exit. Retain invoice/payment IDs and receipts where available; reconcile a deposit before another payment. This audit sends none. |
| Cancellation/deadlines | active → timeout/abort → local failure/result; remote job may remain active | Execution deadline does not bound CLI graph loading or later output saving. Aborting the client is not a provider cancellation guarantee. |
| Run collection | node outcomes → output selection + errors/gates + reported costs → resolved result or `RunError.result` | Exit 0 need not mean every output exists. Preserve successful lanes and costs from partial results; an inexact cost is a lower bound. |
| Media delivery | result/URL/inline bytes → download → filename sanitization → local write → verified artifact; any step may fail after generation | Reuse retained media for save retries. Use fresh directories and unique filename-safe output names; do not overwrite a prior run or collapse two keys onto one file. |
| Retry/restart | failed/partial/interrupted → reconcile → reuse artifact/job when possible; explicit new `run` → fresh scheduling/submissions | No durable graph checkpoint or automatic resume. Do not treat rerunning the graph as retrying only the failed node. Per-instance learned prompt limits are not a durable checkpoint. |
| Workflow automation | user-supplied graph → inspected interface → dedicated skill wrapper → installed trigger → run lifecycle above | A wrapper does not remove input, payment, partial-result, or recovery obligations. Saved graphs are data; they need no installation just to run. |

Source implementations:

- [JS workflow validation, scheduler, gates, cancellation, results](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/src/workflow.mjs),
  [Python workflow](https://github.com/nanoodlecom/nanoodle-py/blob/0ce5cf49ef8b1cf263a30fc4135c847a207fcad1/src/nanoodle/workflow.py).
- [JS CLI, credentials, output saving, summaries](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/bin/nanoodle.mjs),
  [Python CLI](https://github.com/nanoodlecom/nanoodle-py/blob/0ce5cf49ef8b1cf263a30fc4135c847a207fcad1/src/nanoodle/__main__.py).
- [JS graph materialization](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/src/graph.mjs),
  [share decoding/recovery](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/src/share.mjs),
  [node-specific validation](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/src/nodes.mjs),
  [provider polling](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/src/client.mjs),
  [x402](https://github.com/nanoodlecom/nanoodle-js/blob/7734e7f6209f153a634b37bd1a691b67cc276817/src/x402.mjs).

## Findings and fixes in this repository

1. **High: inspection and validation were presented as proof against spending.**
   A downstream vision node with a blank model fails only after its image
   upstream completes. An offline injected response reported a $0.01 upstream
   charge before that validation error. The skill now separates upfront checks
   from execution-time checks and describes concurrent lanes and partial cost.
2. **High: replay and save recovery were unspecified.** A second `run()` makes
   a second submission; a retained `MediaRef` can instead retry a failed save
   without generation. The skill now requires reconciliation of uncertain jobs
   and deposits, preserving partial outputs, and retrying delivery separately.
3. **Medium: CLI completion was conflated with artifact delivery.** Node can
   exit 1 with empty stdout during validation or output saving. Python needs
   `--json` for machine output and `--out` to write media. The skill now covers
   these differences, stderr capture, and file verification.
4. **Medium: output persistence could silently discard artifacts.** In a local
   Node CLI fixture, output names `A B` and `A_B` both save as `A_B.png`; the
   second overwrites the first and the process exits 0. Fresh directories and
   distinct filename-safe names are now required by the skill. The underlying
   SDK collision remains an executor-owner issue; this repository cannot fix
   its filename allocator or create durable executor run receipts.
5. **Medium: gates and optional failures were omitted.** The skill now treats
   closed Decide gates as successful stops and requires checking node/error/gate
   records instead of assuming every sink has an output after exit 0.
6. **Low: inspection/network and version claims were stale.** Direct fragments
   are offline; short links resolve over the network. The moving "0.8.0 is
   current" claim was removed, and installed capabilities are authoritative.

## Reproduction and validation

From this repository, using local executor checkouts at the snapshots above:

```sh
node audit/check-executor-contracts.mjs /path/to/nanoodle-js
python3 audit/check-python-contracts.py /path/to/nanoodle-py
git diff --check
```

Verified with Node 24.22.1 and Python 3.11.8: **9 JavaScript checks and 5 Python
checks passed**. JavaScript requests use an injected mock, Python fixtures use
local-only graphs, and CLI child processes have a closed local API endpoint.
No provider requests, financial transactions, invoice deposits, or live data
changes occur. The malformed eight-byte "PNG" and one-byte media fixtures test
transport/persistence only, not image validity or codec quality. The available
Python interpreter is below the skill's recommended patched runtime; these
offline checks do not certify host runtime security.

Checks cover example interface parity, upfront rejection, downstream late
validation, independent partial success, fresh submissions on replay, retained
result save recovery, short-link I/O, missing Node failure JSON, output filename
collision, Python human/JSON output, and Python media save/no-save behavior.

Live provider polling, actual cancellation, settlement, remote job recovery,
codec availability, and executor concurrency defects are not proven by these
offline checks and remain responsibilities of the executor audits. No claim
is made that a documentation change repairs those implementations.

## Release and rollback

The applicable release is a reviewed PR merged to `main`, making the revised
skill available to subsequent installs/updates. No package version, tag,
registry publication, server deployment, credential change, or installed skill
update is needed to release this repository. Verify the merged Git tree and
its files against the reviewed head. Existing installs still require an update.
If rollback is needed, revert the merge through a PR; that changes future skill
distribution without touching provider jobs, payments, or saved workflows.
