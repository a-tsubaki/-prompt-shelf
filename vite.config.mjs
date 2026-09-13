import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_REPOSITORY
    ? process.env.GITHUB_REPOSITORY.endsWith(".github.io")
      ? "/"
      : `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/`
    : "/",
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
