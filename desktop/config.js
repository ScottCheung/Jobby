/** @format */

const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function getDesktopConfig(options = {}) {
  const connectionConfig = options.connectionConfig || {};
  const apiUrl = connectionConfig.apiUrl || process.env.AUTO_JOB_API_URL || '';
  const dashboardUrl =
    connectionConfig.dashboardUrl || process.env.AUTO_JOB_DASHBOARD_URL || '';
  const apiPort = process.env.AUTO_JOB_API_PORT || inferPort(apiUrl, '8000');
  const dashboardPort =
    process.env.AUTO_JOB_DASHBOARD_PORT || inferPort(dashboardUrl, '3000');

  return {
    rootDir,
    environmentName:
      connectionConfig.environmentName ||
      process.env.AUTO_JOB_ENVIRONMENT_NAME ||
      'Production',
    deploymentTarget:
      connectionConfig.deploymentTarget ||
      process.env.AUTO_JOB_DEPLOYMENT_TARGET ||
      'cloud',
    api: {
      mode:
        connectionConfig.apiMode || process.env.AUTO_JOB_API_MODE || 'external',
      url: apiUrl,
      healthUrl: apiUrl ? `${apiUrl}/ready` : '',
      host: process.env.AUTO_JOB_API_HOST || '127.0.0.1',
      port: apiPort,
      pythonPath: process.env.AUTO_JOB_PYTHON_PATH || 'python3',
      cwd: path.join(rootDir, 'backend'),
      command: ['-m', 'services.api'],
    },
    dashboard: {
      mode:
        connectionConfig.dashboardMode ||
        process.env.AUTO_JOB_DASHBOARD_MODE ||
        'external',
      url: dashboardUrl,
      healthUrl: dashboardUrl,
      port: dashboardPort,
      npmCommand: process.env.AUTO_JOB_NPM_PATH || 'npm',
      cwd: path.join(rootDir, 'Apps', 'user'),
      devCommand: [
        'run',
        'dev',
        '--',
        '--hostname',
        '127.0.0.1',
        '--port',
        dashboardPort,
      ],
      startCommand: [
        'run',
        'start',
        '--',
        '-H',
        '127.0.0.1',
        '-p',
        dashboardPort,
      ],
    },
    worker: {
      mode:
        connectionConfig.workerMode ||
        process.env.AUTO_JOB_WORKER_MODE ||
        'external',
      pythonPath: process.env.AUTO_JOB_PYTHON_PATH || 'python3',
      cwd: rootDir,
      command: [],
      apiBaseUrl: apiUrl,
    },
  };
}

function inferPort(urlValue, fallback) {
  if (!urlValue) {
    return fallback;
  }

  try {
    return String(new URL(urlValue).port || fallback);
  } catch {
    return fallback;
  }
}

module.exports = {
  getDesktopConfig,
};
