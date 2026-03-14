#!/usr/bin/env node
// Claude Code Statusline
// Shows: model | git branch | directory | context bar | cost | block timer
// GSD-compatible: auto-activates task, update notif, and context bridge when GSD is present

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const VERSION = '1.1.0';
const UPDATE_URL = 'https://raw.githubusercontent.com/Andreesch/claude-code-extensions/main/extensions/statusline/statusline.js';

const CACHE_DIR = path.join(os.homedir(), '.cache', 'claude-statusline');
const USAGE_CACHE = path.join(CACHE_DIR, 'usage.json');
const USAGE_LOCK = path.join(CACHE_DIR, 'usage.lock');
const UPDATE_CACHE = path.join(CACHE_DIR, 'update.json');
const UPDATE_LOCK = path.join(CACHE_DIR, 'update.lock');

// ── Widgets ──────────────────────────────────────────────────────────────────

function getSessionCost(data) {
  const totalCost = data?.cost?.total_cost_usd;
  if (totalCost == null) return '';
  return ` \u2502 \x1b[32m$${totalCost.toFixed(2)}\x1b[0m`;
}

function getGitBranch(dir) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir, timeout: 1000, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8'
    }).trim();
    return branch ? ` \u2502 \x1b[35m${branch}\x1b[0m` : '';
  } catch { return ''; }
}

function getContextBar(remaining) {
  if (remaining == null) return '';

  const rem = Math.round(remaining);
  const rawUsed = Math.max(0, Math.min(100, 100 - rem));
  // Claude Code enforces an 80% context limit — scale so 80% real = 100% displayed
  const used = Math.min(100, Math.round((rawUsed / 80) * 100));

  // Progress bar (10 segments)
  const filled = Math.floor(used / 10);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

  // Color thresholds (scaled)
  if (used < 63) {        // ~50% real
    return ` \x1b[32m${bar} ${used}%\x1b[0m`;
  } else if (used < 81) { // ~65% real
    return ` \x1b[33m${bar} ${used}%\x1b[0m`;
  } else if (used < 95) { // ~76% real
    return ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
  } else {
    return ` \x1b[5;31m\uD83D\uDC80 ${bar} ${used}%\x1b[0m`;
  }
}

// ── Block Timer (OAuth usage API) ────────────────────────────────────────────

function getOAuthToken() {
  const platform = os.platform();

  // macOS: read from Keychain
  if (platform === 'darwin') {
    try {
      const raw = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: 'utf8', timeout: 2000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      const creds = JSON.parse(raw);
      return creds?.claudeAiOauth?.accessToken || null;
    } catch { return null; }
  }

  // Linux: read from credentials file
  if (platform === 'linux') {
    try {
      const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      return creds?.claudeAiOauth?.accessToken || null;
    } catch { return null; }
  }

  return null;
}

function getBlockTimer() {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Check file cache (valid for 10 min)
    try {
      const stat = fs.statSync(USAGE_CACHE);
      const age = now - Math.floor(stat.mtimeMs / 1000);
      if (age < 600) {
        const cached = JSON.parse(fs.readFileSync(USAGE_CACHE, 'utf8'));
        if (cached.resetAt) return formatBlockInfo(cached.resetAt, cached.utilization);
      }
    } catch {}

    // Rate limit: 1 API call per 1 min
    try {
      const lockAge = now - Math.floor(fs.statSync(USAGE_LOCK).mtimeMs / 1000);
      if (lockAge < 60) return readCachedBlock();
    } catch {}

    // Get OAuth token (cross-platform)
    const token = getOAuthToken();
    if (!token) return readCachedBlock();

    // Touch lock
    try {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(USAGE_LOCK, '');
    } catch {}

    // Call API in subprocess to avoid blocking
    const script = `
      const https = require('https');
      const req = https.request({
        hostname: 'api.anthropic.com', path: '/api/oauth/usage', method: 'GET',
        headers: { 'Authorization': 'Bearer ' + process.env.T, 'anthropic-beta': 'oauth-2025-04-20' },
        timeout: 4000
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { if (res.statusCode === 200) process.stdout.write(d); else process.exit(1); });
      });
      req.on('error', () => process.exit(1));
      req.on('timeout', () => { req.destroy(); process.exit(1); });
      req.end();
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      encoding: 'utf8', timeout: 5000, env: { ...process.env, T: token }
    });
    if (result.status !== 0 || !result.stdout) return readCachedBlock();

    const api = JSON.parse(result.stdout);
    const resetAt = api?.five_hour?.resets_at || api?.five_hour?.reset_at;
    const utilization = api?.five_hour?.utilization;
    if (!resetAt) return readCachedBlock();

    // Cache result
    try { fs.writeFileSync(USAGE_CACHE, JSON.stringify({ resetAt, utilization })); } catch {}

    return formatBlockInfo(resetAt, utilization);
  } catch { return ''; }
}

function readCachedBlock() {
  try {
    const cached = JSON.parse(fs.readFileSync(USAGE_CACHE, 'utf8'));
    if (cached.resetAt) return formatBlockInfo(cached.resetAt, cached.utilization);
  } catch {}
  return '';
}

function formatBlockInfo(resetAt, utilization) {
  const resetMs = Date.parse(resetAt);
  if (isNaN(resetMs)) return '';
  const remainMs = Math.max(0, resetMs - Date.now());
  const h = Math.floor(remainMs / 3600000);
  const m = Math.floor((remainMs % 3600000) / 60000);

  // Color: green < 50%, yellow < 80%, red >= 80%
  const usePct = utilization != null ? Math.round(utilization) : null;
  const color = usePct == null || usePct < 50 ? '\x1b[32m' : usePct < 80 ? '\x1b[33m' : '\x1b[31m';

  const usage = usePct != null ? `${usePct}% ` : '';
  return ` \u2502 ${color}${usage}(${h}h${m}m left)\x1b[0m`;
}

// ── Auto-update check ─────────────────────────────────────────────────────────

function parseVersion(v) {
  return (v || '').split('.').map(Number);
}

function isNewer(remote, local) {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

function getStatuslineUpdate() {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Serve from cache if fresh (24h)
    try {
      const stat = fs.statSync(UPDATE_CACHE);
      const age = now - Math.floor(stat.mtimeMs / 1000);
      if (age < 86400) {
        const cached = JSON.parse(fs.readFileSync(UPDATE_CACHE, 'utf8'));
        if (cached.update_available) return '\x1b[33m\u2B06 statusline-update\x1b[0m \u2502 ';
        return '';
      }
    } catch {}

    // Rate limit: retry at most once per hour
    try {
      const lockAge = now - Math.floor(fs.statSync(UPDATE_LOCK).mtimeMs / 1000);
      if (lockAge < 3600) return '';
    } catch {}

    // Touch lock + ensure cache dir
    try {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(UPDATE_LOCK, '');
    } catch {}

    // Fetch remote version in background subprocess
    const script = `
      const https = require('https');
      const url = new URL(process.env.U);
      const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'GET', timeout: 4000 }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          const m = d.match(/^const VERSION = '([^']+)'/m);
          if (m) process.stdout.write(m[1]);
          else process.exit(1);
        });
      });
      req.on('error', () => process.exit(1));
      req.on('timeout', () => { req.destroy(); process.exit(1); });
      req.end();
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      encoding: 'utf8', timeout: 5000, env: { ...process.env, U: UPDATE_URL }
    });

    if (result.status !== 0 || !result.stdout) return '';

    const remoteVersion = result.stdout.trim();
    const updateAvailable = isNewer(remoteVersion, VERSION);
    try {
      fs.writeFileSync(UPDATE_CACHE, JSON.stringify({ remote: remoteVersion, update_available: updateAvailable }));
    } catch {}

    return updateAvailable ? '\x1b[33m\u2B06 statusline-update\x1b[0m \u2502 ' : '';
  } catch { return ''; }
}

// ── GSD Widgets (auto-activate when GSD is installed) ────────────────────────

function getActiveTask(session) {
  if (!session) return '';
  const todosDir = path.join(os.homedir(), '.claude', 'todos');
  if (!fs.existsSync(todosDir)) return '';
  try {
    const files = fs.readdirSync(todosDir)
      .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 0) {
      const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
      const inProgress = todos.find(t => t.status === 'in_progress');
      if (inProgress) return inProgress.activeForm || '';
    }
  } catch {}
  return '';
}

function getGsdUpdate() {
  const cacheFile = path.join(os.homedir(), '.claude', 'cache', 'gsd-update-check.json');
  if (!fs.existsSync(cacheFile)) return '';
  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cache.update_available) return '\x1b[33m\u2B06 /gsd:update\x1b[0m \u2502 ';
  } catch {}
  return '';
}

function writeContextBridge(session, remaining, used) {
  if (!session) return;
  try {
    const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
    fs.writeFileSync(bridgePath, JSON.stringify({
      session_id: session,
      remaining_percentage: remaining,
      used_pct: used,
      timestamp: Math.floor(Date.now() / 1000)
    }));
  } catch {}
}

// ── Main ─────────────────────────────────────────────────────────────────────

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || data.model || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    const dirname = path.basename(dir);
    const ctx = getContextBar(remaining);
    const cost = getSessionCost(data);
    const branch = getGitBranch(dir);
    const block = getBlockTimer();

    // GSD widgets (no-op when GSD is not installed)
    const task = getActiveTask(session);
    const gsdUpdate = getGsdUpdate();
    const statuslineUpdate = getStatuslineUpdate();

    // Context bridge for GSD context-monitor hook
    if (remaining != null) {
      const rawUsed = Math.max(0, Math.min(100, 100 - Math.round(remaining)));
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));
      writeContextBridge(session, remaining, used);
    }

    const updates = `${statuslineUpdate}${gsdUpdate}`;

    // Output
    if (task) {
      process.stdout.write(
        `${updates}\x1b[2m${model}\x1b[0m \u2502 \x1b[1m${task}\x1b[0m${branch} \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${cost}${block}`
      );
    } else {
      process.stdout.write(
        `${updates}\x1b[2m${model}\x1b[0m${branch} \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${cost}${block}`
      );
    }
  } catch {
    // Silent fail — don't break the statusline
  }
});
