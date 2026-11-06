// Offline evidence for the skill's recovery guidance. No dependencies or live API calls.
// Usage: node audit/check-executor-contracts.mjs /path/to/nanoodle-js
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

assert.ok(process.argv[2], "pass a local nanoodle-js checkout; no package is downloaded");
const sdk = resolve(process.argv[2]);
const { Workflow, RunError } = await import(pathToFileURL(join(sdk, "src/index.mjs")));
const example = JSON.parse(await readFile(new URL("../examples/poster.noodle-graph.json", import.meta.url), "utf8"));
const graph = (nodes, links = []) => ({ nodes, links });
const image = (id, name, fields = {}) => ({ id, type: "image", name, fields: { model: "mock", prompt: "test", ...fields } });
const wire = (from, to, fromPort = "image", toPort = "image") => ({ from: { node: from, port: fromPort }, to: { node: to, port: toPort } });
let requests = 0;
const mockFetch = async () => {
  requests++;
  return new Response(JSON.stringify({ data: [{ b64_json: "iVBORw0KGgo=" }], cost: 0.01 }), {
    headers: { "content-type": "application/json" },
  });
};
// Explicit dummy key and injected fetch prevent environment credentials or network use.
const options = { apiKey: "offline-test-only", fetch: mockFetch, quiet: true };
const wf = Workflow.fromJSON(example, options);
assert.deepEqual(wf.inputs.filter(x => !x.optional).map(x => x.key), ["Idea"]);
assert.deepEqual(wf.outputs.map(x => x.key), ["Poster"]);
assert.deepEqual(wf.warnings, []);
assert.equal(requests, 0);
console.log("PASS example loads/inspects without any API request");

await assert.rejects(wf.run({ NotAnInput: "test" }));
assert.equal(requests, 0);
console.log("PASS unknown input fails before requests");

const lateFailure = Workflow.fromJSON(graph([
  image("n1", "Paid upstream"),
  { id: "n2", type: "vision", name: "Invalid downstream", fields: { model: "", q: "describe" } },
], [wire("n1", "n2")]), options);
const before = requests;
await assert.rejects(lateFailure.run(), e => {
  assert.ok(e instanceof RunError);
  assert.equal(e.result.nodes.n1.status, "done");
  assert.equal(e.result.nodes.n2.status, "error");
  assert.match(e.result.nodes.n2.error, /model/i);
  assert.equal(e.result.costUsd, 0.01);
  return true;
});
assert.equal(requests - before, 1);
console.log("PASS node-specific validation can fail after upstream reports a charge");

const independent = Workflow.fromJSON(graph([
  image("n1", "Delivered"), image("n2", "Broken", { model: "" }),
]), options);
await assert.rejects(independent.run(), e => {
  assert.ok(e instanceof RunError);
  assert.equal(e.result.nodes.n1.status, "done");
  assert.equal(e.result.nodes.n2.status, "error");
  assert.ok(e.result.outputs.Delivered);
  assert.equal(e.result.costUsd, 0.01);
  return true;
});
console.log("PASS a failed lane retains successful independent output and reported cost");

const rerun = Workflow.fromJSON(graph([image("n1", "Image")]), options);
const beforeRerun = requests;
const result = await rerun.run();
await rerun.run();
assert.equal(requests - beforeRerun, 2);
console.log("PASS running twice submits twice; no durable resume/cache");

const work = await mkdtemp(join(tmpdir(), "nanoodle-skill-audit-"));
try {
  const beforeSave = requests;
  await assert.rejects(result.get("Image").save(join(work, "missing", "output.png")));
  await mkdir(join(work, "recovered"));
  const output = join(work, "recovered", "output.png");
  await result.get("Image").save(output);
  assert.equal((await readFile(output)).length, 8);
  assert.equal(requests, beforeSave);
  console.log("PASS failed save can be retried from the retained result without generation");

  const { decodeShareUrl } = await import(pathToFileURL(join(sdk, "src/share.mjs")));
  const fragment = "#j=" + Buffer.from(JSON.stringify(example)).toString("base64url");
  let redirects = 0;
  const redirectFetch = async () => {
    redirects++;
    return new Response(null, { status: 302, headers: { location: "https://nanoodle.com/" + fragment } });
  };
  await decodeShareUrl("https://nanoodle.com/" + fragment, { fetch: redirectFetch });
  assert.equal(redirects, 0);
  await decodeShareUrl("https://short.invalid/example", { fetch: redirectFetch });
  assert.equal(redirects, 1);
  console.log("PASS direct links decode offline; short links require redirect I/O");

  const invalid = spawnSync(process.execPath, [join(sdk, "bin/nanoodle.mjs"), "run",
    fileURLToPath(new URL("../examples/poster.noodle-graph.json", import.meta.url)),
    "--input", "NotAnInput=test", "--json"], {
    cwd: work, encoding: "utf8", timeout: 10000,
    env: { ...process.env, NANOGPT_API_KEY: "", NANOGPT_BASE_URL: "http://127.0.0.1:1" },
  });
  assert.ifError(invalid.error);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout.trim(), "");
  assert.ok(invalid.stderr.trim());
  console.log("PASS Node CLI validation failure can have no JSON summary; stderr is required");

  const collisionGraph = join(work, "collision.json");
  await writeFile(collisionGraph, JSON.stringify(graph([
    { id: "n1", type: "upload", name: "A B", fields: { image: "data:image/png;base64,AQ==" } },
    { id: "n2", type: "upload", name: "A_B", fields: { image: "data:image/png;base64,Ag==" } },
  ])));
  const collision = spawnSync(process.execPath, [join(sdk, "bin/nanoodle.mjs"), "run",
    collisionGraph, "--out", join(work, "collision-out"), "--json"], {
    cwd: work, encoding: "utf8", timeout: 10000,
    env: { ...process.env, NANOGPT_API_KEY: "", NANOGPT_BASE_URL: "http://127.0.0.1:1" },
  });
  assert.ifError(collision.error);
  assert.equal(collision.status, 0, collision.stderr);
  const summary = JSON.parse(collision.stdout);
  assert.equal(summary.outputs["A B"], summary.outputs.A_B);
  assert.deepEqual(await readFile(summary.outputs.A_B), Buffer.from([2]));
  console.log("PASS distinct output names can sanitize to one path and overwrite (local fixture)");
} finally {
  await rm(work, { recursive: true, force: true });
}
