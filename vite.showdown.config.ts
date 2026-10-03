import { defineConfig } from "vite";

// A self-contained browser ES module for consumers such as SnapCrop.
export default defineConfig({
  build: {
    outDir: "dist-showdown",
    lib: { entry: "src/showdown.ts", formats: ["es"], fileName: () => "showdown.js" },
  },
});
