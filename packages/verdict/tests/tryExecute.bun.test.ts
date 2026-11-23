import { describe, expect, test } from "bun:test";
import { tryExecute } from "../src/utils";

describe("Try Execute", () => {
  test("Executes a function and returns a tuple", () => {
    const [err, res] = tryExecute(() => process.versions.bun);

    expect(res).toBe(process.versions.bun);
    expect(err).toBeNull();
  });
});
