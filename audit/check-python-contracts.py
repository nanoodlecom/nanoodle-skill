"""Offline CLI/interface evidence. Usage: python3 audit/check-python-contracts.py /path/to/nanoodle-py"""
import contextlib
import io
import json
import pathlib
import sys
import tempfile

if len(sys.argv) != 2:
    raise SystemExit("pass a local nanoodle-py checkout; no package is downloaded")
sys.path.insert(0, str(pathlib.Path(sys.argv[1]).resolve() / "src"))
from nanoodle import Workflow
from nanoodle.__main__ import main

example = pathlib.Path(__file__).resolve().parents[1] / "examples/poster.noodle-graph.json"
wf = Workflow.load(str(example), api_key="offline-test-only")
assert [i.key for i in wf.inputs if not i.optional] == ["Idea"]
assert [o.key for o in wf.outputs] == ["Poster"]
assert not wf.warnings
print("PASS Python example loads/inspects with expected interface, without generation")


def cli(*args):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = main(list(args))
    return code, out.getvalue(), err.getvalue()


with tempfile.TemporaryDirectory(prefix="nanoodle-skill-python-") as directory:
    work = pathlib.Path(directory)
    local = work / "local.json"
    local.write_text(json.dumps({"nodes": [{"id": "n1", "type": "text", "name": "Text",
                                           "fields": {"text": "offline"}}]}))
    code, out, err = cli("run", str(local), "--api-key", "offline-test-only",
                         "--base-url", "http://127.0.0.1:1")
    assert code == 0 and "offline" in out
    try:
        json.loads(out)
    except json.JSONDecodeError:
        pass
    else:
        raise AssertionError("Python default output unexpectedly JSON")
    print("PASS Python default CLI output is human-readable")

    code, out, err = cli("run", str(local), "--json", "--api-key", "offline-test-only",
                         "--base-url", "http://127.0.0.1:1")
    assert code == 0 and json.loads(out)["outputs"]["Text"] == "offline"
    print("PASS Python --json emits a machine-readable result")

    local.write_text(json.dumps({"nodes": [{"id": "n1", "type": "upload", "name": "Image",
                           "fields": {"image": "data:image/png;base64,iVBORw0KGgo="}}]}))
    code, out, err = cli("run", str(local), "--json", "--api-key", "offline-test-only",
                         "--base-url", "http://127.0.0.1:1")
    media = json.loads(out)["outputs"]["Image"]
    assert code == 0 and media["file"] is None and media["url"].startswith("data:")
    print("PASS Python without --out returns media metadata and does not save a media file")

    code, out, err = cli("run", str(local), "--json", "--out", str(work / "out"),
                         "--api-key", "offline-test-only", "--base-url", "http://127.0.0.1:1")
    media = json.loads(out)["outputs"]["Image"]
    assert code == 0 and media["url"] is None and pathlib.Path(media["file"]).read_bytes() == b"\x89PNG\r\n\x1a\n"
    print("PASS Python --out saves media and JSON names the delivered file")
