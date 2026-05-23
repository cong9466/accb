#!/usr/bin/env node
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Port resolution: read from server/config.json, default 4099
// ---------------------------------------------------------------------------
function resolvePort() {
  const candidates = [
    path.join(__dirname, '..', 'server', 'config.json'),
    path.join(process.cwd(), 'server', 'config.json'),
  ];

  for (const cfgPath of candidates) {
    try {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      const cfg = JSON.parse(raw);
      if (cfg.port && Number.isFinite(cfg.port)) {
        return cfg.port;
      }
    } catch (_) {
      // ignore – try next candidate
    }
  }

  return 4099;
}

// ---------------------------------------------------------------------------
// HTTP helpers (zero dependencies)
// ---------------------------------------------------------------------------
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Check if the local server is already running
// ---------------------------------------------------------------------------
function checkStatus(port) {
  return httpGet(`http://127.0.0.1:${port}/v1/status`)
    .then(() => true)
    .catch(() => false);
}

// ---------------------------------------------------------------------------
// Poll /v1/status every 300ms, up to maxAttempts times
// ---------------------------------------------------------------------------
function waitForServer(port, maxAttempts) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function poll() {
      attempts++;
      checkStatus(port).then((alive) => {
        if (alive) return resolve(true);
        if (attempts >= maxAttempts) return resolve(false);
        setTimeout(poll, 300);
      });
    }

    poll();
  });
}

// ---------------------------------------------------------------------------
// Spawn the MCP server as a detached background process
// ---------------------------------------------------------------------------
function startServer() {
  const serverCwd = path.join(__dirname, '..', 'server');
  const serverEntry = path.join(serverCwd, 'dist', 'index.cjs');

  const child = spawn(process.execPath, [serverEntry], {
    cwd: serverCwd,
    stdio: 'ignore',
    detached: true,
  });

  child.unref();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const key = process.argv[2];

  if (!key) {
    process.stderr.write('用法: node <skill_path>/script/get_token.js <key>\n');
    process.exit(1);
  }

  const port = resolvePort();

  // Auto-detect & auto-start --------------------------------------------------
  const alreadyRunning = await checkStatus(port);

  if (!alreadyRunning) {
    process.stderr.write('[accb] 本地服务未运行，正在后台启动...\n');

    try {
      startServer();
    } catch (_) {
      process.stderr.write('[accb] 本地服务启动失败，请检查 Node.js 是否可用\n');
      process.exit(1);
    }

    const ready = await waitForServer(port, 10);

    if (!ready) {
      process.stderr.write(`[accb] 无法连接本地服务 (端口 ${port})，启动失败。\n`);
      process.exit(1);
    }

    process.stderr.write('[accb] 本地服务已就绪\n');
  }

  // Fetch the context value ----------------------------------------------------
  try {
    const { statusCode, body } = await httpGet(
      `http://127.0.0.1:${port}/v1/credentials/${encodeURIComponent(key)}`
    );

    if (statusCode === 200) {
      // Parse JSON response and output raw value (no trailing newline)
      let value;
      try {
        const parsed = JSON.parse(body);
        value = typeof parsed === 'object' && parsed !== null
          ? (parsed.value !== undefined ? String(parsed.value) : body)
          : String(parsed);
      } catch (_) {
        // Response is already plain text
        value = body;
      }
      process.stdout.write(value);
      process.exit(0);
    }

    if (statusCode === 404) {
      process.stderr.write(
        `[accb] 未找到 key: ${key}，请确认浏览器插件已安装并刷新了目标网页。\n`
      );
      process.exit(1);
    }

    process.stderr.write(`[accb] 本地服务返回 HTTP ${statusCode}\n`);
    process.exit(1);
  } catch (_) {
    process.stderr.write(`[accb] 无法连接本地服务 (端口 ${port})，启动失败。\n`);
    process.exit(1);
  }
}

main();
