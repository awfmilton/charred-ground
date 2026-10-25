'use strict';

const { loadProjectEnv } = require('./serve.cjs');
const { openStore, buildMysqlSslConfig, formatTlsError, redactPassword } = require('./db.cjs');

async function runDbCheck({ env = process.env, store, log = console.log } = {}) {
  const password = String(env.DB_PASSWORD ?? '');
  let tlsMeta = {};
  if (String(env.DB_HOST ?? '').trim()) {
    try {
      const cfg = buildMysqlSslConfig({ env });
      tlsMeta = { sslMode: cfg.mode, caPath: cfg.caPath, fingerprint: cfg.fingerprint };
    } catch {
      // openStore will surface any configuration validation error
    }
  }

  let activeStore = store;
  try {
    if (!activeStore) {
      activeStore = openStore({ env, warn: () => {} });
    }
    if (activeStore.tlsMeta && typeof activeStore.tlsMeta === 'object') {
      tlsMeta = activeStore.tlsMeta;
    }
    await activeStore.ready;

    const backend = activeStore.backend;
    let sslVersion = 'n/a';
    let sslCipher = 'n/a';
    let pinMatched = 'n/a';
    let tableCount = 0;

    if (backend === 'mysql') {
      const conn = await activeStore.db.getConnection();
      try {
        const queryFn =
          typeof conn.query === 'function'
            ? conn.query.bind(conn)
            : conn.execute.bind(conn);
        const [statusRows] = await queryFn(
          "SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')"
        );
        if (Array.isArray(statusRows)) {
          for (const row of statusRows) {
            const name = row.Variable_name ?? row.variable_name;
            const value = row.Value ?? row.value;
            if (name === 'Ssl_version' && value) sslVersion = String(value);
            if (name === 'Ssl_cipher' && value) sslCipher = String(value);
          }
        }
        const [cntRows] = await queryFn(
          'SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE()'
        );
        if (Array.isArray(cntRows) && cntRows[0]) {
          tableCount = Number(cntRows[0].cnt ?? cntRows[0].CNT ?? 0);
        }
        if (tlsMeta.sslMode === 'verify' && tlsMeta.fingerprint) {
          pinMatched = 'yes';
        }
      } finally {
        if (conn && typeof conn.release === 'function') {
          conn.release();
        }
      }
    } else {
      const row = activeStore.db
        .prepare("SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .get();
      tableCount = Number(row?.cnt ?? 0);
    }

    await activeStore.close();
    activeStore = null;

    log(`backend: ${backend}`);
    log(`Ssl_version: ${sslVersion}`);
    log(`Ssl_cipher: ${sslCipher}`);
    log(`pin matched: ${pinMatched}`);
    log(`tables: ${tableCount}`);

    return { backend, sslVersion, sslCipher, pinMatched, tables: tableCount };
  } catch (err) {
    if (activeStore && !store) {
      try {
        await activeStore.close();
      } catch {}
    }
    throw redactPassword(formatTlsError(err, tlsMeta), password);
  }
}

if (require.main === module) {
  loadProjectEnv();
  runDbCheck().catch(err => {
    const msg = redactPassword(err, String(process.env.DB_PASSWORD ?? ''))?.message || 'Database check failed';
    console.error(msg);
    process.exit(1);
  });
}

module.exports = { runDbCheck };
