import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

test("product extension guides name the inventory and completion commands", () => {
  for (const name of fs.readdirSync(path.join(process.cwd(), "documentation", "guides"))) {
    if (!name.startsWith("add-new-") || !name.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(process.cwd(), "documentation", "guides", name), "utf8");
    if (!content.includes("npm run inventory:write") || !content.includes("npm run check:all")) {
      throw new Error(`${name} must name inventory:write and check:all`);
    }
  }
});
