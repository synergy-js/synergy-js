import { describe, expect, test } from "bun:test";

import { container } from "./helpers";

describe("DI Container Context", () => {
  test("Gets the active container context", () => {
    expect(container).toBeDefined();
  });
});
