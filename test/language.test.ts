import assert from "node:assert/strict";
import test from "node:test";
import { NoCapError, parse, run } from "../src/index.js";

function execute(source: string, maxSteps?: number) {
  const output: string[] = [];
  const options = {
    filename: "test.np",
    stdout: (text: string) => output.push(text),
    ...(maxSteps === undefined ? {} : { maxSteps }),
  };
  const result = run(source, options);
  return { output, result };
}

test("runs declarations, expressions, values, and flex", () => {
  const { output, result } = execute(`
yo chat
soft launch score = 40 + 2;
soft launch honest = no cap;
soft launch missing = ghosted;
flex "score", score;
flex honest, delulu, missing;
aight, touch grass
`);

  assert.deepEqual(output, ["score 42", "no cap delulu ghosted"]);
  assert.equal(result.variables.get("score"), 42);
});

test("runs vibe checks and not-the-vibe branches", () => {
  const { output } = execute(`
yo chat
soft launch score = 95;
vibe check (score >= 90 && no cap) {
  flex "vibe check passed";
} not the vibe {
  flex "not the vibe";
}
aight, touch grass
`);

  assert.deepEqual(output, ["vibe check passed"]);
});

test("supports loops, ghosting, cooked, and assignment operators", () => {
  const { output, result } = execute(`
yo chat
soft launch count = 0;
keep cooking while (count < 10) {
  count += 1;
  vibe check (count == 2) {
    ghosting;
  }
  flex count;
  vibe check (count == 4) {
    cooked;
  }
}
aight, touch grass
`);

  assert.deepEqual(output, ["1", "3", "4"]);
  assert.equal(result.variables.get("count"), 4);
});

test("supports crash out and caught in 4K", () => {
  const { output } = execute(`
yo chat
try this {
  crash out "receipts missing";
} caught in 4K (error) {
  flex "handled:", error;
}
aight, touch grass
`);

  assert.deepEqual(output, ["handled: receipts missing"]);
});

test("supports functions and recursion", () => {
  const { output } = execute(`
yo chat
cook factorial(number) {
  vibe check (number <= 1) {
    serve 1;
  }
  serve number * factorial(number - 1);
}
flex factorial(6);
aight, touch grass
`);

  assert.deepEqual(output, ["720"]);
});

test("uses lexical block scope", () => {
  const { output } = execute(`
yo chat
soft launch value = 1;
{
  soft launch local = 2;
  value = value + local;
}
flex value;
aight, touch grass
`);

  assert.deepEqual(output, ["3"]);
});

test("reports source locations for syntax errors", () => {
  assert.throws(
    () => parse("yo chat\nflex \"oops\"\naight, touch grass", "broken.np"),
    (error: unknown) => {
      assert.ok(error instanceof NoCapError);
      assert.equal(error.kind, "SyntaxError");
      assert.equal(error.location.line, 3);
      assert.match(error.format(), /^broken\.np:3:1/);
      return true;
    },
  );
});

test("rejects non-boolean conditions", () => {
  assert.throws(
    () => execute("yo chat\nvibe check (1) { flex 1; }\naight, touch grass"),
    /must evaluate to 'no cap' or 'delulu'/,
  );
});

test("stops runaway programs at the configured step limit", () => {
  assert.throws(
    () => execute("yo chat\nkeep cooking while (no cap) { }\naight, touch grass", 20),
    /step safety limit/,
  );
});
