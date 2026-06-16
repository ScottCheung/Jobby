const fs = require("fs");
const path = require("path");

const CONFIG_FILE_NAME = "desktop-config.json";

function getDefaultConnectionConfig() {
  return {
    environmentName: process.env.AUTO_JOB_ENVIRONMENT_NAME || "Production",
    deploymentTarget: process.env.AUTO_JOB_DEPLOYMENT_TARGET || "cloud",
    apiUrl: process.env.AUTO_JOB_API_URL || "",
    dashboardUrl: process.env.AUTO_JOB_DASHBOARD_URL || "",
    apiMode: process.env.AUTO_JOB_API_MODE || "external",
    dashboardMode: process.env.AUTO_JOB_DASHBOARD_MODE || "external",
    workerMode: process.env.AUTO_JOB_WORKER_MODE || "local-python",
  };
}

class DesktopConfigStore {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.configPath = path.join(userDataPath, CONFIG_FILE_NAME);
  }

  load() {
    const defaults = getDefaultConnectionConfig();
    if (!fs.existsSync(this.configPath)) {
      return defaults;
    }

    try {
      const raw = fs.readFileSync(this.configPath, "utf8");
      const parsed = JSON.parse(raw);
      return migrateConnectionConfig({
        ...defaults,
        ...sanitizeConnectionConfig(parsed),
      });
    } catch {
      return defaults;
    }
  }

  save(nextConfig) {
    const merged = migrateConnectionConfig({
      ...getDefaultConnectionConfig(),
      ...sanitizeConnectionConfig(nextConfig),
    });
    fs.mkdirSync(this.userDataPath, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2));
    return merged;
  }

  reset() {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
    return this.load();
  }
}

function sanitizeConnectionConfig(value) {
  return {
    environmentName: stringOrFallback(value?.environmentName, "Production"),
    deploymentTarget: stringOrFallback(value?.deploymentTarget, "cloud"),
    apiUrl: normalizeUrl(value?.apiUrl, ""),
    dashboardUrl: normalizeUrl(value?.dashboardUrl, ""),
    apiMode: stringOrFallback(value?.apiMode, "external"),
    dashboardMode: stringOrFallback(value?.dashboardMode, "external"),
    workerMode: stringOrFallback(value?.workerMode, "local-python"),
  };
}

function migrateConnectionConfig(config) {
  let nextConfig = { ...config };

  if (
    nextConfig.deploymentTarget === "cloud" &&
    nextConfig.apiMode === "external" &&
    nextConfig.dashboardMode === "external" &&
    nextConfig.workerMode === "external"
  ) {
    nextConfig = {
      ...nextConfig,
      workerMode: "local-python",
    };
  }

  if (shouldAutoRepairDashboardUrl(nextConfig)) {
    nextConfig = {
      ...nextConfig,
      dashboardUrl: inferDashboardUrlFromApi(nextConfig.apiUrl),
    };
  }

  return nextConfig;
}

function shouldAutoRepairDashboardUrl(config) {
  if (!config.apiUrl || !config.dashboardUrl) {
    return false;
  }

  try {
    const api = new URL(config.apiUrl);
    const dashboard = new URL(config.dashboardUrl);
    const sameOrigin = api.origin === dashboard.origin;
    const sameHost = api.hostname === dashboard.hostname;
    const dashboardLooksLikeApiPort = dashboard.port === "8000";
    return sameOrigin || (sameHost && dashboardLooksLikeApiPort);
  } catch {
    return false;
  }
}

function inferDashboardUrlFromApi(apiUrl) {
  try {
    const url = new URL(apiUrl);
    url.port = "3000";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://127.0.0.1:3000";
  }
}

function normalizeUrl(value, fallback) {
  const normalized = stringOrFallback(value, fallback).trim().replace(/\/+$/, "");
  return normalized || fallback;
}

function stringOrFallback(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

module.exports = {
  DesktopConfigStore,
  getDefaultConnectionConfig,
  inferDashboardUrlFromApi,
  migrateConnectionConfig,
  sanitizeConnectionConfig,
};
