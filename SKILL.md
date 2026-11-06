---
name: nanoodle-skill
description: Build and run nanoodle graphs — multi-model AI media pipelines (text, LLM, image, video, audio) saved as a single noodle-graph.json and executed headlessly against the NanoGPT API. Use when the user wants an AI image/video/audio or multi-model generation pipeline, wants to run or automate a nanoodle workflow / noodle-graph.json file, or brings a nanoodle.com share link (#g= graph or #a= app).
license: MIT
metadata:
  author: nanoodlecom
  homepage: https://nanoodle.com
---

# nanoodle: build and run multi-model AI pipelines

[nanoodle](https://nanoodle.com) is a browser-based node editor for AI workflows:
you wire text, LLM, image, video, and audio nodes into a feed-forward graph
("noodle"), run it against the [NanoGPT](https://nano-gpt.com) API with your own
key, turn it into a shareable app, and export it as a single self-contained HTML
file. There is no backend and no analytics — the API key and workflows stay in
the browser (or, headlessly, in your process). A saved workflow is one JSON file
(`noodle-graph.json`) that the official executor packages re-run byte-for-byte:
`nanoodle` on npm (zero dependencies) and `nanoodle` on PyPI (standard library
only). Use patched Node 22.23.4, 24.22.1, or 26.12.1 and later security releases
in those branches, or Python 3.11.17 / 3.12.15 and later security releases in
those branches. Package metadata alone does not update an installed interpreter.
Same graphs, same semantics, in either runtime.

These runtime floors cover the [October Node security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
and [CPython server-side SNI issue](https://mail.python.org/archives/list/security-announce@python.org/thread/QMQIUQB6WGGC3MI7I3WKQXOYOBDSPPS3/).
The latter does not affect the executor's HTTPS client calls. Verify the actual
Node/Python process and its TLS trust store separately; package updates do not
guarantee complete certificate distrust.

## API key (bring your own)

Every generation is billed by NanoGPT against the user's own balance:

1. The user creates an API key at [nano-gpt.com](https://nano-gpt.com) (an OAuth
   access token also works) and funds the balance.
2. Export it as `NANOGPT_API_KEY` — both executors read that env var by default.

Never print or log the key. Loading, validating, and inspecting a workflow never
calls the API; only `run` spends money.

## Run a graph headlessly

### CLI (Node — `nanoodle` on npm; core surface needs >= 0.2.0; --pay needs 0.4+)

```sh
export NANOGPT_API_KEY=...

# Inspect first — offline, free; prints the graph's inputs, outputs, settings, nodes
npx nanoodle inspect graph.json

# Run — calls NanoGPT and spends from the balance
npx nanoodle run graph.json --input Text="a cozy ramen shop"
```

Common surface (check the installed version's `--help` for the full interface):

```
nanoodle run <graph.json|share-url> [--input k=v]... [--set k=v]... [--out dir] [--json] [--key K] [--env-file path] [--timeout ms]
nanoodle inspect <graph.json|share-url>
nanoodle init [path]
nanoodle --help | --version
```

- `run` executes a workflow (needs an API key, spends from the balance);
  `inspect` shows a workflow's inputs, outputs, and settings — no generation or
  key needed; local files and direct fragment links decode offline, while short
  links need a network redirect lookup; `init` writes the starter graph
  (text → LLM prompt-writer → image)
  to path (default `./noodle-graph.json`). Both `run` and `inspect` take a local
  file or a share URL directly.
- `--input k=v` — set a workflow input (`Text=hello`, `n2.system=@notes.txt`;
  `@path` reads a file — media files ride as media, `.txt`/`.md`/`.json` as text)
- `--set k=v` — override a setting (`n3.model=flux-pro`, `n3.size=1k`)
- `--out dir` — directory for media outputs (default `./noodle-out`, created
  only when needed). Media is always written to disk as `<OutputKey>.<ext>` —
  extension follows MIME, so use the path the CLI prints, don't hard-code
  `.png`. Text outputs land in the run summary.
- `--json` — quiet mode: skips the progress/log lines on stderr. The JSON run
  summary — `outputs` (paths/text), `costUsd`, `costExact`, `remainingBalance`,
  `errors`, per-node statuses — is printed to stdout after execution and output
  saving; `--json` silences the human-readable progress chatter. Validation or
  media-save failures can exit before a summary is printed: capture stderr too,
  and never interpret empty stdout as proof that nothing was billed.
- `--key K` / `--env-file p` — key precedence here: `--key` > `--env-file` >
  `NANOGPT_API_KEY`
- `--pay` (0.4+) — accountless run, no API key or account: each paid call
  prints a Nano (XNO) invoice as a scannable QR + `nano:` URI on stderr and
  waits for the deposit (x402; ignores any configured key; a self-custody
  wallet does the send)
- `--timeout ms` — workflow execution timeout, in milliseconds; graph loading
  and saving outputs are separate stages outside that deadline
- Exit code 0 on success, 1 on failure. When available, the JSON summary
  carries partial results when an output node failed. Check node statuses and
  `errors` even on exit 0; see [execution and recovery](#execution-failures-and-recovery).

### CLI (Python — `pip install nanoodle`, >= 0.2.0)

Installed as `nanoodle-py` (`python -m nanoodle` always works); same `run` /
`inspect` commands and graph semantics, but a narrower and slightly different
flag surface:

```sh
nanoodle-py inspect graph.json
nanoodle-py run graph.json --input Text="a cozy ramen shop" --set n3.size=1k --out ./out --json
```

Porting notes (Python vs Node CLI):

- Use `--json` for a machine-readable summary and partial `RunError` results.
  Python's default output is human-readable; unlike Node, it does not always
  print JSON. Media files are saved only when `--out` is supplied. In JSON mode
  media outputs are objects with `url`, `mime`, and `file`, rather than Node's
  path strings. Saving can fail after generation; retain stderr as well.
- The key flag is `--api-key` (not `--key`).
- `--timeout` is in **seconds** (not milliseconds).
- An ambient `NANOGPT_API_KEY` wins over `--env-file`; in the Node CLI
  `--env-file` wins.
- PyPI 0.2.0 runs share URLs directly (same as the Node CLI). Both published
  CLIs have the accountless x402 `--pay` mode (npm needs 0.4+). There is no
  `init` command — for the starter-graph scaffold, use the Node CLI.

### Library (JavaScript)

```js
import { Workflow } from "nanoodle";

const wf = await Workflow.load("noodle-graph.json");           // key from NANOGPT_API_KEY
const result = await wf.run({ Text: "a cozy ramen shop on a rainy night" });
await result.get("Image").save("ramen.png");                   // media: MediaRef (url + bytes()/save())
console.log(result.costUsd, result.remainingBalance);
```

Discover the interface programmatically: `wf.inputs`, `wf.outputs`,
`wf.settings`. Media inputs: `mediaFromFile("photo.jpg")`, an `https://` URL, or
raw bytes. Settings/timeout/progress ride on the second argument:
`wf.run(inputs, { settings: { "n3.model": "flux-dev" }, timeoutMs, onProgress })`.
`run()` rejects with `RunError` when an output node fails; `err.result` still
has partial results and cost so far.

### Library (Python)

```python
from nanoodle import Workflow

wf = Workflow.load("noodle-graph.json")
result = wf.run({"Text": "a cozy ramen shop on a rainy night"})
result["Image"].save("ramen.png")            # media: MediaRef (url + bytes()/save())
print(result.cost_usd, result.remaining_balance)
```

Same shape, snake_case: `wf.inputs/outputs/settings`, `media_from_file(...)`,
`wf.run(inputs, settings={...}, timeout=600, on_progress=...)`, `RunError` with
`error.result`.

### Input, output, and setting keys

Input keys are flexible and case-insensitive: the node's custom name (`"Idea"`),
`nodeId.field` (`"n2.system"`), or the input's label when unique. Output keys
are the sink node's custom name (or its type name). Settings use `nodeId.field`
keys (`"n3.model"`). A workflow with exactly one required input also accepts a
bare value: `wf.run("hello")`. Run `inspect` to see the real keys — what it
prints is authoritative.

## Execution, failures, and recovery

Treat a run as several transitions: load → inspect → resolve inputs/settings →
execute nodes → collect outcomes/costs → download/save outputs → verify files.
`inspect` describes the interface; it does **not** execute nodes or prove that
models, media codecs, credentials, remote inputs, or the output directory work.

- Nodes wait for their own dependencies; independent lanes can run concurrently.
  A failure in one lane does not undo successful or still-running paid work in
  another. Downstream failures may happen after an upstream generation spent.
- Distinguish `done`, `error`, and `skipped` node outcomes. Executors supporting
  Decide gates also report `gated`: a closed gate is a successful stop, and its
  skipped descendants have no output. Do not retry a closed gate as a failure.
  `onError: "skip"`, where supported, can also leave errors in a successful run.
  Use the installed executor's statuses, `errors`, and `gated` records to explain
  which outputs actually exist; do not assume exit 0 means every node generated.
- A timeout, Ctrl-C, lost response, or failed media download does not prove a
  provider job was cancelled or unbilled. Preserve stderr, the result/summary,
  any provider job IDs, payment records, and already-saved files. Check accepted
  jobs with the provider before submitting again; job-ID availability depends
  on executor/version. Never blindly retry a generation or send a second payment.
- Each `run` is a fresh execution, with no durable checkpoint or automatic resume
  of completed nodes. Re-running the same graph can repeat paid calls. If only
  saving failed, reuse an available `MediaRef`, output URL, or local artifact
  and retry the download/save instead of running the graph again. If no result
  survived, reconcile provider status first.
- Use a fresh `--out` directory for each run. Output names are derived from node
  names and can overwrite prior files; names that sanitize to the same filename
  can also collide. Give output nodes distinct, filename-safe names, and verify
  that the expected files exist before reporting completion. Generation success
  and durable local delivery are separate outcomes.
- Cost is the sum **reported so far**. `costExact: false` (Python library:
  `cost_exact`) means a lower bound, and a missing balance is unknown. Neither a
  missing summary nor a reported zero establishes that an interrupted request
  was free. `--pay` selects a different payment mode; it ignores a configured
  API key and can request a separate invoice for each paid call.

See [the state-machine audit](references/state-machines.md) for the complete
lifecycle inventory, source evidence, offline checks, and release behavior.

## The noodle-graph.json shape

A graph is plain JSON — nodes with typed ports, links between matching port
kinds (text | image | audio | video), no cycles:

```json
{
  "v": 1,
  "nodes": [
    { "id": "n1", "type": "text",  "name": "Idea",   "fields": { "text": "a cozy ramen shop" } },
    { "id": "n2", "type": "llm",   "fields": { "model": "zai-org/glm-5.2", "system": "You write image prompts..." } },
    { "id": "n3", "type": "image", "name": "Poster", "fields": { "model": "nano-banana-2-lite", "size": "1k" } }
  ],
  "links": [
    { "id": "l1", "from": { "node": "n1", "port": "text" }, "to": { "node": "n2", "port": "prompt" } },
    { "id": "l2", "from": { "node": "n2", "port": "text" }, "to": { "node": "n3", "port": "prompt" } }
  ]
}
```

You can author this by hand (both executors accept the minimal `{nodes, links}`
form) or build it visually at nanoodle.com and press 💾 Save. Node `name` values
become the input/output keys agents use — name every node you'll touch.

Media inputs (upload / aupload / vupload, inpaint image+mask): leave the field
**empty** (`"image": ""` or omit it) — the input then shows as *required* in
`inspect` and you pass the file at run time with `--input "Image=@photo.jpg"`.
Never write a prose placeholder like `"[image provided separately]"` into a
media field: anything that isn't a `data:`/`http(s)` URL is treated as empty at
load (with a warning), never sent to the API. Full
field-by-field detail and the node-type table:
[references/graph-format.md](references/graph-format.md). A complete runnable
example (idea → LLM prompt-writer → poster image) is at
[examples/poster.noodle-graph.json](examples/poster.noodle-graph.json):

```sh
npx nanoodle run examples/poster.noodle-graph.json --input "Idea=..." --out ./out
```

## Running the user's own workflow

The user doesn't install their graphs — they just give you one. Two forms, both
run the same way:

- **A file** they saved from nanoodle.com — `something.noodle-graph.json`.
- **A share link** — `https://nanoodle.com/#g=...`.

When they hand you either, do this:

```sh
# 1. Read its interface (free, offline) — this tells you the input names to ask for
npx nanoodle inspect their-graph.json      # or the "#g=..." URL, quoted

# 2. Run it with those inputs
npx nanoodle run their-graph.json --input "Idea=a cozy ramen shop" --out ./out
```

`inspect` prints the exact input and output names (they come from the names the
user gave their nodes), so you never have to guess. That's the whole thing — no
setup beyond the API key.

### Making one workflow run automatically

If the user wants a graph to fire on its own whenever they ask for that kind of
thing (e.g. "make a poster" always running *their* poster graph), it becomes its
own little skill — a folder with the `.noodle-graph.json` and a short `SKILL.md`.
Step-by-step recipe:
[docs/agent-skills.md](https://github.com/nanoodlecom/nanoodle-js/blob/main/docs/agent-skills.md).
Ready-made examples: [noodle-skills](https://github.com/nanoodlecom/noodle-skills).
Each workflow as a callable tool instead:
[nanoodle-mcp](https://github.com/nanoodlecom/nanoodle-mcp).

## Share links

nanoodle workflows are shared as URL fragments: `https://nanoodle.com/#g=...`
opens a graph in the editor, `https://nanoodle.com/play#a=...` opens a runnable
app. The payload lives entirely in the `#` fragment, which browsers never send
to any server — sharing a link does not upload the workflow anywhere. The Node
CLI (>= 0.2.0) takes share URLs directly — no browser round-trip needed:

```sh
npx nanoodle inspect "https://nanoodle.com/#g=..."     # offline, free
npx nanoodle run "https://nanoodle.com/#g=..." --input Text="..."
```

App links (`play#a=` / `play.html#a=`) work the same way. Quote the URL — `#` starts a shell
comment otherwise. The Python CLI (PyPI 0.2.0+) runs share URLs the same way.

## Limits and cost — be honest with the user

- **Stateless feed-forward DAG.** No loops, no branches that re-enter, no
  durable workflow checkpoint between runs. Dependencies determine execution
  order; independent lanes run concurrently. Decide gates, where supported by
  the installed executor, can stop a lane without an error.
- **Every run spends real money** (except nodes that run locally). Costs are
  per-generation via NanoGPT; the result reports `costUsd`/`cost_usd`,
  `costExact` / `cost_exact` (false means the total is a floor)
  and `remainingBalance` / `remaining_balance`. A reported price of 0 means
  subscription-included, not unknown.
- **Headless executors support the NanoGPT-backed nodes** (llm, image,
  edit, inpaint, vision, tvideo, ivideo, vedit, lipsync, music, remix, tts,
  transcribe) plus local ones (text, uploads, choice, join, comment). Local
  media-processing nodes (resize, vframes, combine, soundtrack, trim,
  extractaudio) also run headlessly (npm 0.4+, PyPI 0.2+): the Node CLI prefers
  a pure-JS path that matches the browser (lossless mp4 remux, PCM-WAV trim,
  PNG resize) and falls back to ffmpeg on `PATH` for everything else; the
  Python CLI needs ffmpeg on `PATH` for all of them. ffmpeg is a soft
  dependency — a clear error if it's required and missing. That error arrives
  when the node runs, so paid upstream nodes may already have spent. Run a
  media-only graph with representative inputs once to prove the setup first.
- **Media rides inline as base64** (NanoGPT has no upload endpoint). Network
  inputs face an inline-size budget of ~4.4 MB (~3.5 MB for transcription).
  Checks and image fitting depend on node/runtime; oversized generated media
  can fail at a later node after upstream work has already spent.
- Upfront checks catch missing credentials, unknown input/setting keys, required
  inputs, cycles, and unsupported node types before execution. Node-specific
  model, media, codec, and provider validation can fail later, after another
  node has spent. Inspection alone does not establish a free or successful run.

## Full reference

- Machine-readable overview: https://nanoodle.com/llms.txt
- Format / engine / IO specs: `docs/SPEC-format.md`, `docs/SPEC-engine.md`,
  `docs/SPEC-io.md` in [nanoodle-js](https://github.com/nanoodlecom/nanoodle-js)
  (the [nanoodle-py](https://github.com/nanoodlecom/nanoodle-py) docs mirror them)
- Turning one of your own workflows into a dedicated agent skill:
  `docs/agent-skills.md` in either executor repo
