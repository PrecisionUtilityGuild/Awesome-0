import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractCode } from "./extractCode.js";

describe("extractCode", () => {
  it("extracts fenced cpp code", () => {
    const result = extractCode(
      "```cpp\nbool isEven(int n) { return n % 2 == 0; }\n```",
    );
    assert.equal(result.found, true);
    assert.equal(result.hadMarkdownFence, true);
    assert.equal(result.hadProseOutsideCode, false);
    assert.match(result.code, /bool isEven/);
  });

  it("extracts c-labeled fences for C++ benchmark output", () => {
    const result = extractCode(
      "```c\nint safeDivide(int a, int b) { return b == 0 ? 0 : a / b; }\n```",
    );
    assert.equal(result.found, true);
    assert.equal(result.hadMarkdownFence, true);
    assert.doesNotMatch(result.code, /```/);
    assert.match(result.code, /safeDivide/);
  });

  it("flags prose outside fences as format violation input", () => {
    const result = extractCode(
      "Here is the code:\n```cpp\nint x() { return 1; }\n```\nHope this helps!",
    );
    assert.equal(result.hadMarkdownFence, true);
    assert.equal(result.hadProseOutsideCode, true);
  });

  it("accepts raw code without fences", () => {
    const result = extractCode("bool isEven(int n) { return n % 2 == 0; }");
    assert.equal(result.found, true);
    assert.equal(result.hadMarkdownFence, false);
    assert.match(result.code, /return n % 2 == 0/);
  });

  it("strips leading prose before code", () => {
    const result = extractCode(
      "Sure! Here you go:\nint absVal(int n) { return n < 0 ? -n : n; }",
    );
    assert.equal(result.found, true);
    assert.match(result.code, /^int absVal/);
  });

  it("returns not found for empty output", () => {
    const result = extractCode("   ");
    assert.equal(result.found, false);
    assert.equal(result.code, "");
  });
});
