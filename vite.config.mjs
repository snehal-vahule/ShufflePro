import { rename } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [{
    name: "shufflepro-index-entry",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === "/") {
          request.url = "/Index.html";
        }
        next();
      });
    },
    async writeBundle() {
      const outputDirectory = resolve(projectRoot, "dist");
      const originalEntry = resolve(outputDirectory, "Index.html");
      const temporaryEntry = resolve(outputDirectory, "shufflepro-index.html");
      await rename(originalEntry, temporaryEntry);
      await rename(temporaryEntry, resolve(outputDirectory, "index.html"));
    }
  }],
  build: {
    rollupOptions: {
      input: {
        index: resolve(projectRoot, "Index.html")
      }
    }
  }
});
