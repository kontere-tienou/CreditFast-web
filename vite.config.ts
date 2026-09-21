import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router")) return "router-vendor";
            if (id.includes("@heroui") || id.includes("react-aria-components"))
              return "ui-vendor";
            if (id.includes("react") || id.includes("scheduler"))
              return "react-vendor";
            return "vendor";
          }

          if (id.includes("/src/api/")) return "api-core";
          if (id.includes("/src/shared/")) return "shared-ui";
          if (id.includes("/src/features/")) return "feature-modules";
          if (id.includes("/src/app/")) return "app-shell";
          if (id.includes("/src/components/")) return "component-library";
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
