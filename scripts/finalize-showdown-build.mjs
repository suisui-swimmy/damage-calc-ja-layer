import { copyFile, writeFile } from "node:fs/promises";

const output = new URL("../dist-showdown/", import.meta.url);
await writeFile(new URL("showdown.d.ts", output), 'export * from "./types/showdown";\n');
await writeFile(new URL("package.json", output), JSON.stringify({
  name: "damage-calc-ja-layer-showdown-display", private: true, type: "module",
  main: "./showdown.js", types: "./showdown.d.ts",
  exports: { ".": { types: "./showdown.d.ts", import: "./showdown.js" } },
}, null, 2) + "\n");
await copyFile(new URL("./data/showdown-LICENSE.txt", import.meta.url), new URL("showdown-LICENSE.txt", output));
