import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";

/**
 * Chrome extensions run in isolated worlds. Vite's default HTML transform
 * adds `crossorigin` to every <script> and <link rel="modulepreload"> it
 * emits. That attribute causes Chrome to log:
 *   "preload … not used because it is a cross-world extension resource mismatch"
 * Strip it from every page the plugin generates so the console stays clean.
 */
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

export default defineConfig(({ mode, command }) => {
  const extensionEnv = loadEnv(mode, ".", "");
  const webAppEnv = loadEnv(mode, "../user", "");
  const isDevServer = command === "serve";

  return {
    define: {
      // Reuse the web app's public Supabase values when the extension does not
      // have its own .env.local. A VITE_* value beside the extension wins.
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
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
    // Never let a production build replace the unpacked Vite development
    // extension, otherwise the HMR connection is silently lost.
    build: {
      outDir: isDevServer ? "dist-dev" : "dist",
    },
    plugins: [
      react(),
      tailwindcss(),
      stripCrossorigin(),
      crx({ manifest }),
    ],
  };
});
