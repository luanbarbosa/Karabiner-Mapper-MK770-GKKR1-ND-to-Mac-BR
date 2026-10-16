#!/usr/bin/env node
// Local server for the key mapper UI. No dependencies.
// Source of truth: ./mappings.json (Karabiner complex_modifications asset format).
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = +process.env.PORT || 4777;
const DIR = __dirname;
const RULES = path.join(DIR, 'mappings.json');
const CONFIG = path.join(DIR, 'mapper.config.json');
const KARABINER_ASSET = path.join(os.homedir(), '.config/karabiner/assets/complex_modifications/mk770-nordic-to-mac.json');

const DEFAULT_CONFIG = {
  devices: [
    { vendor_id: 9494, product_id: 469, note: 'MK770 wired' },
    { vendor_id: 9494, product_id: 451, note: 'MK770 2.4GHz dongle' }
  ],
  right_command: 'right_command',
  codes: {}
};

const readJson = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
};
const writeJson = (f, data) => fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');

function body(req) {
  return new Promise((res, rej) => {
    let s = '';
    req.on('data', c => (s += c));
    req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch (e) { rej(e); } });
  });
}

function send(res, code, data, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      return send(res, 200, fs.readFileSync(path.join(DIR, 'index.html')), 'text/html; charset=utf-8');
    }
    if (req.url === '/api/state' && req.method === 'GET') {
      return send(res, 200, {
        mappings: readJson(RULES, { title: 'MK-770 Nordic → MacBook Brazil', rules: [] }),
        config: { ...DEFAULT_CONFIG, ...readJson(CONFIG, {}) },
        karabinerAsset: KARABINER_ASSET,
        installed: fs.existsSync(KARABINER_ASSET)
      });
    }
    if (req.url === '/api/mappings' && req.method === 'PUT') {
      const data = await body(req);
      if (!Array.isArray(data.rules)) return send(res, 400, { error: 'rules must be an array' });
      writeJson(RULES, data);
      return send(res, 200, { ok: true });
    }
    if (req.url === '/api/config' && req.method === 'PUT') {
      writeJson(CONFIG, await body(req));
      return send(res, 200, { ok: true });
    }
    if (req.url === '/api/install' && req.method === 'POST') {
      fs.mkdirSync(path.dirname(KARABINER_ASSET), { recursive: true });
      fs.copyFileSync(RULES, KARABINER_ASSET);
      return send(res, 200, { ok: true, path: KARABINER_ASSET });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Key mapper running at http://localhost:${PORT}`);
  console.log(`Source of truth: ${RULES}`);
});
