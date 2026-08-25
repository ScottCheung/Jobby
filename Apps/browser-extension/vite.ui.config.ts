import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const extensionEnv = loadEnv(mode, ".", "");
  const webAppEnv = loadEnv(mode, "../user", "");

  return {
    root: resolve(__dirname, "src/sidepanel"),
    publicDir: resolve(__dirname, "public"),
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
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
      port: 5174,
      open: true,
      cors: true,
      fs: {
        allow: [resolve(__dirname, "../..")],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
  };
});
