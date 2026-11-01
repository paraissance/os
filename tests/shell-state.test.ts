import { describe, expect, it } from "vitest";
import { NAV_KEY, SHELL_SCRIPT, THEME_KEY } from "@/components/shell/shell-state";

/** Runs the head script against a pretend browser and returns what it set on <html>. */
function run(stored: Record<string, string>, systemDark = false, storageBlocked = false) {
  const dataset: Record<string, string> = {};
  const localStorage = {
    getItem(key: string) {
      if (storageBlocked) throw new Error("blocked");
      return stored[key] ?? null;
    },
  };
  new Function("document", "localStorage", "matchMedia", SHELL_SCRIPT)({ documentElement: { dataset } }, localStorage, () => ({ matches: systemDark }));
  return dataset;
}

describe("shell head script", () => {
  it("folds the sidebar unless it was left open", () => {
    expect(run({}).nav).toBe("closed");
    expect(run({ [NAV_KEY]: "closed" }).nav).toBe("closed");
    expect(run({ [NAV_KEY]: "open" }).nav).toBeUndefined();
  });

  it("follows the system's theme until one is chosen", () => {
    expect(run({}).theme).toBeUndefined();
    expect(run({}, true).theme).toBe("dark");
    expect(run({ [THEME_KEY]: "dark" }).theme).toBe("dark");
    expect(run({ [THEME_KEY]: "light" }, true).theme).toBeUndefined();
  });

  it("still works when storage is refused", () => {
    expect(run({}, true, true)).toEqual({ nav: "closed", theme: "dark" });
  });
});
