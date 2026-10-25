'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openStore } = require('./db.cjs');
const { createApi } = require('./api.cjs');

const root = path.resolve(__dirname, '..');

function loadProjectEnv({
  envPath = path.join(root, '.env'),
  loadEnvFile = process.loadEnvFile,
  existsSync = fs.existsSync
} = {}) {
  if (typeof existsSync === 'function' && !existsSync(envPath)) {
    return false;
  }
  const loader =
    typeof loadEnvFile === 'function'
      ? loadEnvFile
      : function fallbackLoadEnvFile(p) {
          const content = fs.readFileSync(p, 'utf8');
          for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const eq = line.indexOf('=');
            if (eq <= 0) continue;
            const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
            let val = line.slice(eq + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (key && process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        };
  try {
    loader.call(process, envPath);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

function createServer({ dbPath, mysqlPool, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const resolvedDbPath =
    dbPath || env.DB_PATH || path.join(root, 'data', 'charred-ground.sqlite');
  const store = openStore({
    file: resolvedDbPath,
    mysqlPool,
    env
  });
  const handleApi = createApi({ store, env, fetchImpl });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res);
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(path.join(root, 'index.html')).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  server.store = store;
  server.on('close', () => {
    try {
      store.close();
    } catch {}
  });

  return server;
}

if (require.main === module) {
  loadProjectEnv();
  const port = Number(process.env.PORT || 8187);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Charred Ground: http://${host}:${port}`);
  });
}

module.exports = { createServer, loadProjectEnv };
