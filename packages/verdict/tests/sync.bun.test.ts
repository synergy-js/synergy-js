import { describe, expect, test } from "bun:test";

import { trySync } from "../src/sync-helpers";

const getBunVersion = trySync(() => process.versions.bun, "");

describe("Rustify Synchronous Operations", () => {
  test("Runs a function and checks if it is Ok()", () => {
    expect(getBunVersion.isOk()).toBe(true);
  });

  test("Runs a function and checks if it is Err()", () => {
    expect(getBunVersion.isErr()).toBe(false);
  });

  test("Runs function and matches on the result", () => {
    const matcher = getBunVersion.match({
      Ok: (v) => v,
      Err: (e) => e.message,
    });
    expect(matcher).toBe(process.versions.bun);
  });
});
