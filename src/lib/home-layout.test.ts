import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, resolveLayout, sanitiseLayout } from "./home-layout";

describe("home layouts", () => {
  it("drops invalid and duplicate widget ids", () => {
    expect(sanitiseLayout("mobile", ["my-flight", "bad", "my-flight"], ["bad", "today", "my-flight"]))
      .toEqual({ order: ["my-flight"], hidden: ["my-flight"] });
  });

  it("appends newly introduced defaults without losing the saved order", () => {
    const result = resolveLayout("mobile", { order: ["airport-runs", "my-flight"], hidden: [] });
    expect(result.map((widget) => widget.id)).toEqual([
      "airport-runs", "my-flight", ...DEFAULT_LAYOUT.mobile.filter((id) => !["airport-runs", "my-flight"].includes(id)),
    ]);
  });
});
