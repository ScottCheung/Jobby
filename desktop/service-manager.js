const { spawn } = require("child_process");
const EventEmitter = require("events");
const http = require("http");
const https = require("https");

class ServiceManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.processes = new Map();
    this.healthPollTimer = null;
    this.healthState = {
      api: { healthy: null, checkedAt: null, detail: "Waiting for first check" },
      dashboard: { healthy: null, checkedAt: null, detail: "Waiting for first check" },
      worker: { healthy: null, checkedAt: null, detail: "Waiting for first check" },
    };
  }

  getRuntimeInfo() {
    return {
      environmentName: this.config.environmentName,
      deploymentTarget: this.config.deploymentTarget,
      api: {
        mode: this.config.api.mode,
        url: this.config.api.url,
      },
      dashboard: {
        mode: this.config.dashboard.mode,
        url: this.config.dashboard.url,
      },
      worker: {
        mode: this.config.worker.mode,
      },
    };
  }

  updateConfig(nextConfig) {
    this.config = nextConfig;
  }

  getServiceStatus() {
    return {
      api: this.#buildServiceStatus("api", this.config.api),
      dashboard: this.#buildServiceStatus("dashboard", this.config.dashboard),
      worker: this.#buildServiceStatus("worker", this.config.worker),
    };
  }

  async startManagedServices() {
    await this.#startApiIfNeeded();
    await this.#startWorkerIfNeeded();
    await this.#startDashboardIfNeeded();
    await this.#refreshHealthState();
    this.#startHealthPolling();
  }

  async stopManagedServices() {
    this.#stopHealthPolling();
    for (const [serviceName, entry] of this.processes.entries()) {
      this.#stopProcess(serviceName, entry);
    }
    this.processes.clear();
    this.emit("status", this.getServiceStatus());
  }

  async waitForDashboard(timeoutMs = 60000) {
    if (!this.config.dashboard.healthUrl) {
      throw new Error("Dashboard URL is not configured");
    }
    return this.#waitForHealthyUrl(this.config.dashboard.healthUrl, timeoutMs);
  }

  async #startApiIfNeeded() {
    if (this.config.api.mode !== "local-python") {
      return;
    }

    this.#spawnProcess("api", this.config.api.pythonPath, this.config.api.command, {
      cwd: this.config.api.cwd,
      env: {
        ...process.env,
        API_HOST: this.config.api.host,
        API_PORT: this.config.api.port,
      },
    });
    await this.#waitForHealthyUrl(this.config.api.healthUrl, 45000);
  }

  async #startDashboardIfNeeded() {
    if (this.config.dashboard.mode === "local-next-dev") {
      this.#spawnProcess("dashboard", this.config.dashboard.npmCommand, this.config.dashboard.devCommand, {
        cwd: this.config.dashboard.cwd,
        env: {
          ...process.env,
          NEXT_PUBLIC_API_BASE_URL: this.config.api.url,
        },
      });
      await this.#waitForHealthyUrl(this.config.dashboard.healthUrl, 60000);
      return;
    }

    if (this.config.dashboard.mode === "local-next-start") {
      this.#spawnProcess("dashboard", this.config.dashboard.npmCommand, this.config.dashboard.startCommand, {
        cwd: this.config.dashboard.cwd,
        env: {
          ...process.env,
          NEXT_PUBLIC_API_BASE_URL: this.config.api.url,
        },
      });
      await this.#waitForHealthyUrl(this.config.dashboard.healthUrl, 30000);
    }
  }

  async #startWorkerIfNeeded() {
    if (this.config.worker.mode !== "local-python") {
      return;
    }

    this.#spawnProcess("worker", this.config.worker.pythonPath, this.config.worker.command, {
      cwd: this.config.worker.cwd,
      env: {
        ...process.env,
        AUTO_JOB_API_BASE_URL: this.config.worker.apiBaseUrl,
      },
    });
  }

  #spawnProcess(serviceName, command, args, options) {
    if (this.processes.has(serviceName)) {
      return;
    }

    const child = spawn(command, args, {
      ...options,
      stdio: "pipe",
      windowsHide: true,
    });

    const entry = {
      process: child,
      startedAt: new Date().toISOString(),
      logs: [],
    };

    child.stdout.on("data", (chunk) => {
      this.#appendLog(serviceName, chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      this.#appendLog(serviceName, chunk.toString());
    });

    child.on("exit", (code, signal) => {
      this.#appendLog(serviceName, `Process exited with code=${code} signal=${signal}`);
      this.processes.delete(serviceName);
      this.emit("status", this.getServiceStatus());
    });

    child.on("error", (error) => {
      this.#appendLog(serviceName, `Process failed to start: ${error.message}`);
      this.emit("status", this.getServiceStatus());
    });

    this.processes.set(serviceName, entry);
    this.emit("status", this.getServiceStatus());
  }

  #stopProcess(serviceName, entry) {
    if (!entry || !entry.process || entry.process.killed) {
      return;
    }

    this.#appendLog(serviceName, "Stopping process");
    entry.process.kill();
  }

  #appendLog(serviceName, rawLine) {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const entry = this.processes.get(serviceName);
    if (!entry) {
      return;
    }

    entry.logs.push({
      at: new Date().toISOString(),
      line,
    });
    entry.logs = entry.logs.slice(-200);
    this.emit("status", this.getServiceStatus());
  }

  #buildServiceStatus(serviceName, config) {
    const processEntry = this.processes.get(serviceName);
    const health = this.healthState[serviceName];
    return {
      mode: config.mode,
      url: config.url || null,
      running: Boolean(processEntry && processEntry.process && processEntry.process.exitCode === null),
      startedAt: processEntry?.startedAt || null,
      recentLogs: processEntry?.logs || [],
      healthy: health?.healthy ?? null,
      checkedAt: health?.checkedAt ?? null,
      detail: health?.detail ?? null,
    };
  }

  #startHealthPolling() {
    this.#stopHealthPolling();
    this.healthPollTimer = setInterval(() => {
      this.#refreshHealthState().catch(() => {
        this.emit("status", this.getServiceStatus());
      });
    }, 3000);
  }

  #stopHealthPolling() {
    if (this.healthPollTimer) {
      clearInterval(this.healthPollTimer);
      this.healthPollTimer = null;
    }
  }

  async #waitForHealthyUrl(url, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.#checkUrl(url)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for ${url}`);
  }

  #checkUrl(url) {
    return new Promise((resolve) => {
      const client = url.startsWith("https:") ? https : http;
      const request = client.get(url, (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 500);
      });
      request.on("error", () => resolve(false));
      request.setTimeout(3000, () => {
        request.destroy();
        resolve(false);
      });
    });
  }

  async #refreshHealthState() {
    const [apiHealth, dashboardHealth] = await Promise.all([
      this.#checkHttpService("api", this.config.api.healthUrl),
      this.#checkHttpService("dashboard", this.config.dashboard.healthUrl),
    ]);

    this.healthState.api = apiHealth;
    this.healthState.dashboard = dashboardHealth;
    this.healthState.worker = this.#checkWorkerHealth();
    this.emit("status", this.getServiceStatus());
  }

  async #checkHttpService(serviceName, url) {
    const checkedAt = new Date().toISOString();
    if (!url) {
      return {
        healthy: false,
        checkedAt,
        detail: `${serviceName} URL is not configured`,
      };
    }

    try {
      const response = await this.#fetchResponse(url);
      if (serviceName === "api") {
        return {
          healthy: response.json?.status === "ready",
          checkedAt,
          detail: response.json?.database === "connected" ?
            `Database connected; tenancy=${response.json?.capabilities?.tenancy_mode || "unknown"}`
          : "Database unavailable",
        };
      }

      const looksLikeHtml =
        response.contentType.includes("text/html") ||
        /^\s*<!doctype html/i.test(response.body) ||
        /^\s*<html/i.test(response.body);

      return {
        healthy: looksLikeHtml,
        checkedAt,
        detail:
          looksLikeHtml ?
            "Dashboard HTML is reachable"
          : `Unexpected response for dashboard: ${response.contentType || "unknown content type"}`,
      };
    } catch (error) {
      return {
        healthy: false,
        checkedAt,
        detail: error instanceof Error ? error.message : `Could not reach ${serviceName}`,
      };
    }
  }

  #checkWorkerHealth() {
    const checkedAt = new Date().toISOString();
    const workerProcess = this.processes.get("worker");

    if (this.config.worker.mode === "external") {
      return {
        healthy: null,
        checkedAt,
        detail: "Managed outside the desktop shell",
      };
    }

    if (workerProcess && workerProcess.process && workerProcess.process.exitCode === null) {
      return {
        healthy: true,
        checkedAt,
        detail: "Local worker agent running",
      };
    }

    return {
      healthy: false,
      checkedAt,
      detail: "Local worker agent not running",
    };
  }

  #fetchResponse(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https:") ? https : http;
      const request = client.get(url, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode < 200 || response.statusCode >= 400) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const contentType = String(response.headers["content-type"] || "");
          let json = null;
          try {
            json = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            json = null;
          }

          resolve({
            statusCode: response.statusCode,
            contentType,
            body: rawBody,
            json,
          });
        });
      });
      request.on("error", reject);
      request.setTimeout(3000, () => {
        request.destroy(new Error(`Request timeout for ${url}`));
      });
    });
  }
}

module.exports = {
  ServiceManager,
};
