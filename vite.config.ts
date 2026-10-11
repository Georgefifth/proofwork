import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("pdfjs-dist")) return "pdf-renderer";
          if (id.includes("parse5") || id.includes("/entities/"))
            return "html-parser";
          if (id.includes("/react") || id.includes("/scheduler/"))
            return "react";
        },
      },
    },
  },
});
