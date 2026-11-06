# nanoodle-skill

An [Agent Skill](https://agentskills.io) that teaches any AI agent to build and
run [nanoodle](https://nanoodle.com) graphs — multi-model AI media pipelines
(text, LLM, image, video, audio) saved as a single `noodle-graph.json` and
executed headlessly against the [NanoGPT](https://nano-gpt.com) API with the
user's own key.

The skill itself is [SKILL.md](SKILL.md). Once installed, an agent that supports
the Agent Skills format (Claude Code, Cursor, Gemini CLI, OpenCode, and
[many others](https://agentskills.io)) will pull it in whenever a task looks
like "generate an image/video/audio pipeline" or "run this nanoodle workflow".

This skill teaches your agent to design and run **any** graph — the right
pick for one workflow, or for making new ones. Want prebuilt one-task skills
instead (poster, jingle, video teaser)? →
[noodle-skills](https://github.com/nanoodlecom/noodle-skills). Built up a
whole folder of saved workflows to serve as typed, callable tools? →
[nanoodle-mcp](https://github.com/nanoodlecom/nanoodle-mcp). Running in GitHub
CI? → [run-noodle-action](https://github.com/nanoodlecom/run-noodle-action).

## Using your own workflow

You don't install your graphs — you just hand one to your agent. No extra setup.

1. Build a workflow at [nanoodle.com](https://nanoodle.com) and press **💾 Save**.
   You get a `noodle-graph.json` file, or a share link.
2. Ask your agent to run it — either works:
   - *"Run poster.noodle-graph.json with Idea='a cozy ramen shop'"*
   - *"Run https://nanoodle.com/#g=…"* (just paste the link)

The agent reads the workflow to find out what inputs it needs, then runs it.
That's it.

**Want a workflow to run automatically** whenever you ask for that kind of thing
(e.g. "make a poster")? Turn it into its own skill — see *Making one workflow
run automatically* in [SKILL.md](SKILL.md).

## Install

Via the open [skills CLI](https://github.com/vercel-labs/skills) (installs into
`~/.agents/skills/` with vendor symlinks):

```sh
npx skills add nanoodlecom/nanoodle-skill -g -y
```

Or manually: copy this directory to `.claude/skills/nanoodle-skill/`
(project-level), `~/.claude/skills/nanoodle-skill/` (user-level), or wherever
your agent reads skills from.

## What's inside

```
nanoodle-skill/
├── SKILL.md                        # the skill: run graphs via CLI or JS/Python library
├── references/graph-format.md      # noodle-graph.json format + node-type table
├── references/state-machines.md    # lifecycle, failure/recovery, and release audit
├── audit/check-executor-contracts.mjs # offline checks against a local nanoodle-js checkout
├── audit/check-python-contracts.py # offline checks against a local nanoodle-py checkout
└── examples/poster.noodle-graph.json  # runnable example: idea → LLM → poster image
```

Runs require a NanoGPT API key (`NANOGPT_API_KEY`) with balance — generations
spend real money. Loading and inspecting local files or direct fragment links
does not generate or spend; resolving a short link requires network access.

## Updates and recovery

This repository distributes skill files directly from Git. Merging a change to
`main` makes it available for subsequent installs/updates; an existing copied or
installed skill must be updated separately. There is no package publication or
running service in this repository.

For partial runs, timeouts, payment waits, and output-save failures, follow
[execution and recovery](SKILL.md#execution-failures-and-recovery). Re-running a
graph starts fresh and can repeat paid work.

## Related

- [nanoodle](https://github.com/nanoodlecom/nanoodle) — the browser editor (nanoodle.com)
- [nanoodle-js](https://github.com/nanoodlecom/nanoodle-js) — `nanoodle` on npm: library + CLI
- [nanoodle-py](https://github.com/nanoodlecom/nanoodle-py) — `nanoodle` on PyPI: library + CLI

## License

MIT — see [LICENSE](LICENSE). Not affiliated with NanoGPT.
