import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { resolve } from "node:path";

function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html
        .replace(/<script([^>]*)\s+crossorigin(="")?/gi, "<script$1")
        .replace(/<link([^>]*)\s+crossorigin(="")?/gi, "<link$1");
    },
  };
}

import manifest from "./manifest.config";

export default defineConfig(({ command, mode }) => {
  if (command === "serve" && process.env.VITEST !== "true") {
    throw new Error(
      "Browser-extension dev mode uses `vite build --watch --mode development` because the extension content scripts cannot use the CRX/Vite HMR client.",
    );
  }

  const extensionEnv = loadEnv(mode, ".", "");
  const webAppEnv = loadEnv(mode, "../user", "");
  const isDevelopment = mode === "development";

  return {
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        isDevelopment ? "development" : "production",
      ),
      "import.meta.env.VITE_WEB_APP_URL": JSON.stringify(
        extensionEnv.VITE_WEB_APP_URL || "http://localhost:3000",
      ),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        extensionEnv.VITE_SUPABASE_URL || webAppEnv.NEXT_PUBLIC_SUPABASE_URL || "",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        extensionEnv.VITE_SUPABASE_ANON_KEY || webAppEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      ),
    },
    resolve: {
      alias: {
        "@jobby/ui": resolve(__dirname, "../../packages/ui/src"),
        "@jobby/ui/*": resolve(__dirname, "../../packages/ui/src/*"),
        "@": resolve(__dirname, "../../packages/ui/src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      hmr: {
        port: 5173,
      },
      fs: {
        allow: [resolve(__dirname, "../..")],
      },
    },
    build: {
      outDir: isDevelopment ? "dist-dev" : "dist",
    },
    worker: {
      format: "es",
    },
    plugins: [
      react(),
      tailwindcss(),
      stripCrossorigin(),
      crx({
        manifest,
        liveReload: false,
        contentScripts: {
          standaloneFiles: [
            "src/content/main-world-bridge.ts",
            "src/content/bootstrap.ts",
          ],
        },
      }),
    ],
  };
});
