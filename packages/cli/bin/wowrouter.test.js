const assert = require("node:assert/strict");
const test = require("node:test");
const { parseArgs, urls } = require("./wowrouter.js");

test("default command starts and opens the panel", () => {
  const opts = parseArgs([]);
  assert.equal(opts.command, "start");
  assert.equal(opts.addr, "127.0.0.1:8787");
  assert.equal(opts.open, true);
  assert.equal(opts.detach, false);
});

test("flags select detach, address, and data", () => {
  const opts = parseArgs(["start", "--detach", "--no-open", "--addr", "127.0.0.1:8790", "--data", "C:\\router"]);
  assert.equal(opts.command, "start");
  assert.equal(opts.detach, true);
  assert.equal(opts.open, false);
  assert.equal(opts.addr, "127.0.0.1:8790");
  assert.equal(opts.data, "C:\\router");
});

test("stop and status are commands", () => {
  assert.equal(parseArgs(["stop"]).command, "stop");
  assert.equal(parseArgs(["status", "--addr", "127.0.0.1:8791"]).addr, "127.0.0.1:8791");
});

test("unknown arguments fail", () => {
  assert.throws(() => parseArgs(["--cloud"]), /Unknown argument/);
  assert.throws(() => parseArgs(["publish"]), /Unknown command/);
  assert.throws(() => parseArgs(["--addr"]), /--addr needs/);
});

test("base URL is the OpenAI prefix", () => {
  assert.deepEqual(urls("127.0.0.1:8787"), {
    panel: "http://127.0.0.1:8787",
    api: "http://127.0.0.1:8787/v1",
  });
});
