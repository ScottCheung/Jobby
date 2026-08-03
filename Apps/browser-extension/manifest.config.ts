import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Jobby Browser Automation",
  version: "0.2.4",
  description: "The browser execution layer for Jobby job applications.",
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  content_scripts: [
    {
      matches: [
        "http://*/*",
        "https://*/*",
      ],
      js: ["src/content/main-world-bridge.ts"],
      all_frames: true,
      run_at: "document_idle",
      world: "MAIN",
    },
    {
      matches: [
        "http://*/*",
        "https://*/*",
      ],
      js: ["src/content/bootstrap.ts"],
      all_frames: true,
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "sidePanel", "activeTab", "scripting", "identity", "webNavigation"],
  host_permissions: [
    "http://*/*",
    "https://*/*",
    "https://seek.com/*",
    "https://au.seek.com/*",
    "https://www.seek.com/*",
    "https://*.seek.com/*",
    "https://seek.com.au/*",
    "https://au.seek.com.au/*",
    "https://www.seek.com.au/*",
    "https://*.seek.com.au/*",
    "https://www.linkedin.com/*",
    "https://linkedin.com/*",
    "https://*.linkedin.com/*",
    "http://127.0.0.1:8000/*",
    "http://localhost:8000/*",
    "http://127.0.0.1:3000/*",
    "http://localhost:3000/*",
    "http://127.0.0.1:3001/*",
    "http://localhost:3001/*",
    "https://*.supabase.co/*",
  ],
  action: {
    default_title: "Open Jobby automation",
  },
});
