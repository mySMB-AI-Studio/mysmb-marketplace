import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("packaged Bookkeeping AP record calls", () => {
  it("keeps the five changed automation content hashes valid", () => {
    const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key, canonical(value)])) : v;
    const dir = "plugins/xero-bookkeeping-ap/content/automations";
    const files = readdirSync(dir);
    expect(files).toHaveLength(5);
    for (const file of files) {
      const { contentHash, ...body } = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
      expect(contentHash, file).toBe(createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex"));
    }
  });
  it("runs the actual Python nodes against synthetic workspace and connector APIs", () => {
    const result = spawnSync(process.platform === "win32" ? "python" : "python3", ["scripts/xero-bookkeeping-ap-records.test.py"], { encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
