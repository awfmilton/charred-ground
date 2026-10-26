'use strict';
const assert = require('node:assert/strict');
const { createAiDecisionService } = require('../scripts/ai.cjs');
const { ALLOWED_WEAPONS } = require('../scripts/api.cjs');
async function runAiTests() {
  const env = { GEMINI_API_KEY: 'test-only-provider-value', GEMINI_MODEL: 'test-model' };
  const user = { id: 1, emailVerified: true };
  const payload = { self: { x: 40, y: 20, hp: 100, inventory: { Missile: 2 } }, enemies: [{ x: 140, y: 20, hp: 100 }], wind: 4 };
  let calls = 0, request;
  const mock = async (url, opts) => { calls++; request = { url, opts };return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ weaponOrItem: 'Missile', angle: 45, power: 600 }) }] } }] }) }; };
  const service = createAiDecisionService({ env, fetchImpl: mock, allowedWeapons: ALLOWED_WEAPONS });
  await assert.rejects(service(null, payload), { status: 403 });
  await assert.rejects(service({ id: 1, emailVerified: false }, payload), { status: 403 });
  assert.equal(calls, 0);
  await assert.rejects(createAiDecisionService({ env: {}, fetchImpl: mock, allowedWeapons: ALLOWED_WEAPONS })(user, payload), { status: 503 });
  await assert.rejects(service(user, { ...payload, wind: NaN }), { status: 400 });
  const result = await service(user, payload);
  assert.equal(result.weaponOrItem, 'Missile');
  assert(!request.url.includes(env.GEMINI_API_KEY));
  assert.equal(request.opts.headers['x-goog-api-key'], env.GEMINI_API_KEY);
  assert(!request.opts.body.includes(env.GEMINI_API_KEY));
  assert(!JSON.stringify(result).includes(env.GEMINI_API_KEY));
  for (let i = 0; i < 11; i++) await service(user, payload);
  await assert.rejects(service(user, payload), { status: 429 });
  assert.equal(calls, 12);
  const broken = createAiDecisionService({ env, allowedWeapons: ALLOWED_WEAPONS, fetchImpl: async () => { throw Error(env.GEMINI_API_KEY); } });
  await assert.rejects(broken(user, payload), e => e.status === 502 && !e.message.includes(env.GEMINI_API_KEY));
  const bad = createAiDecisionService({ env, allowedWeapons: ALLOWED_WEAPONS, fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"weaponOrItem":"Nuke","angle":45,"power":600}' }] } }] }) }) });
  await assert.rejects(bad(user, payload), { status: 502 });
  const { createServer } = require('../scripts/serve.cjs');
  const auth = require('../scripts/auth.cjs');
  const server = createServer({ dbPath: ':memory:', env, fetchImpl: mock });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/api/ai/decision';
    const send = headers => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
    assert.equal((await send({})).status, 401);
    const player = await server.store.createUser({ username: 'aiplayer', email: 'ai@example.test', passwordHash: 'unused-fixture', emailVerified: true, displayName: 'AI Tester' });
    const session = auth.mintSessionToken(1);
    await server.store.createSession({ tokenHash: session.tokenHash, userId: player.id, expiresAt: session.expiresAt });
    assert.equal((await send({ Cookie: 'cg_session=' + session.token })).status, 401);
    const response = await send({ Authorization: 'Bearer ' + session.token });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).weaponOrItem, 'Missile');
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('Server AI: authentication, configuration, validation, credential isolation and rate limits passed.');
}
if (require.main === module) runAiTests().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { runAiTests };
