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

  const bothEnv = { GEMINI_API_KEY: 'gem-secret-key', GEMINI_MODEL: 'gem-model', OPENAI_API_KEY: 'sk-openai-secret-key', OPENAI_MODEL: 'gpt-4o-mini' };
  let lastReq;
  let nextContent = JSON.stringify({ weaponOrItem: 'Missile', angle: 60, power: 550, az: 15, targetX: 140, targetZ: 10 });
  const dualMock = async (url, opts) => {
    lastReq = { url, opts };
    if (url.includes('openai.com')) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: nextContent } }] }) };
    }
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: nextContent }] } }] }) };
  };
  const dualService = createAiDecisionService({ env: bothEnv, fetchImpl: dualMock, allowedWeapons: ALLOWED_WEAPONS });
  const oaRes = await dualService(user, { ...payload, provider: 'openai' });
  assert.equal(lastReq.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(lastReq.opts.headers.Authorization, 'Bearer ' + bothEnv.OPENAI_API_KEY);
  assert(!lastReq.url.includes(bothEnv.OPENAI_API_KEY));
  assert(!lastReq.opts.body.includes(bothEnv.OPENAI_API_KEY));
  const oaBody = JSON.parse(lastReq.opts.body);
  assert.equal(oaBody.model, 'gpt-4o-mini');
  assert.deepEqual(oaBody.response_format, { type: 'json_object' });
  assert.equal(oaBody.max_completion_tokens, 400);
  assert.equal(oaBody.messages.length, 2);
  assert.equal(oaBody.messages[0].role, 'system');
  assert.equal(oaBody.messages[1].role, 'user');
  assert.equal(oaRes.weaponOrItem, 'Missile');
  assert.equal(oaRes.angle, 60);
  assert.equal(oaRes.power, 550);
  assert.equal(oaRes.az, 15);
  assert.equal(oaRes.targetZ, 10);
  assert.equal(oaRes.taunt, undefined);

  const defRes = await dualService(user, payload);
  assert(lastReq.url.includes('generativelanguage.googleapis.com'));
  assert.equal(defRes.weaponOrItem, 'Missile');

  await assert.rejects(dualService(user, { ...payload, provider: 'anthropic' }), { status: 400 });

  const gemOnly = createAiDecisionService({ env: { GEMINI_API_KEY: 'gem-k', GEMINI_MODEL: 'gem-m' }, fetchImpl: dualMock, allowedWeapons: ALLOWED_WEAPONS });
  await assert.rejects(gemOnly(user, { ...payload, provider: 'openai' }), { status: 503 });
  assert.equal((await gemOnly(user, { ...payload, provider: 'gemini' })).weaponOrItem, 'Missile');

  const oaOnly = createAiDecisionService({ env: { OPENAI_API_KEY: 'oa-k', OPENAI_MODEL: 'oa-m' }, fetchImpl: dualMock, allowedWeapons: ALLOWED_WEAPONS });
  await assert.rejects(oaOnly(user, { ...payload, provider: 'gemini' }), { status: 503 });
  assert.equal((await oaOnly(user, { ...payload, provider: 'openai' })).weaponOrItem, 'Missile');

  for (const badText of [
    JSON.stringify({ weaponOrItem: 'UnknownLaser', angle: 45, power: 500 }),
    JSON.stringify({ weaponOrItem: 'Missile', angle: 220, power: 500 }),
    'not-valid-json{'
  ]) {
    const badOa = createAiDecisionService({
      env: bothEnv,
      allowedWeapons: ALLOWED_WEAPONS,
      fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: badText } }] }) })
    });
    await assert.rejects(badOa(user, { ...payload, provider: 'openai' }), e => e.status === 502 && e.message === 'Server AI unavailable. Local AI remains available.');
  }

  const leakOa = createAiDecisionService({
    env: bothEnv,
    allowedWeapons: ALLOWED_WEAPONS,
    fetchImpl: async () => { throw new Error('Auth failed for ' + bothEnv.OPENAI_API_KEY); }
  });
  await assert.rejects(leakOa(user, { ...payload, provider: 'openai' }), e => e.status === 502 && !e.message.includes(bothEnv.OPENAI_API_KEY));

  nextContent = JSON.stringify({ weaponOrItem: 'Missile', angle: 45, power: 500, taunt: '  <b>Fire\u0007\n\t  in   the <script>hole!</script> ' + 'x'.repeat(200), extraSecret: 'drop-me' });
  const tauntSvc = createAiDecisionService({ env: bothEnv, fetchImpl: dualMock, allowedWeapons: ALLOWED_WEAPONS });
  const tauntRes = await tauntSvc(user, { ...payload, provider: 'openai' });
  assert.equal(tauntRes.extraSecret, undefined);
  assert(!tauntRes.taunt.includes('<') && !tauntRes.taunt.includes('>') && !tauntRes.taunt.includes('\u0007'));
  assert(tauntRes.taunt.startsWith('bFire in the script'));
  assert.equal(tauntRes.taunt.length, 80);

  nextContent = JSON.stringify({ weaponOrItem: 'Missile', angle: 45, power: 500, taunt: '   <>\u0000  ' });
  const emptyTauntRes = await tauntSvc(user, { ...payload, provider: 'openai' });
  assert.equal(emptyTauntRes.taunt, undefined);

  nextContent = JSON.stringify({ weaponOrItem: 'Missile', angle: 45, power: 500 });
  const sharedSvc = createAiDecisionService({ env: bothEnv, fetchImpl: dualMock, allowedWeapons: ALLOWED_WEAPONS });
  for (let i = 0; i < 6; i++) {
    await sharedSvc(user, { ...payload, provider: 'gemini' });
    await sharedSvc(user, { ...payload, provider: 'openai' });
  }
  await assert.rejects(sharedSvc(user, { ...payload, provider: 'openai' }), { status: 429 });
  await assert.rejects(sharedSvc(user, { ...payload, provider: 'gemini' }), { status: 429 });

  const { createServer } = require('../scripts/serve.cjs');
  const auth = require('../scripts/auth.cjs');
  const server = createServer({ dbPath: ':memory:', env, fetchImpl: mock });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = 'http://127.0.0.1:' + server.address().port;
    const provRes = await fetch(baseUrl + '/api/ai/providers');
    assert.equal(provRes.status, 200);
    const provText = await provRes.text();
    assert(!provText.includes(env.GEMINI_API_KEY) && !provText.includes(env.GEMINI_MODEL));
    assert.deepEqual(JSON.parse(provText), {
      providers: {
        gemini: { available: true, label: 'Gemini 4 Argon' },
        openai: { available: false, label: 'ChatGPT' }
      }
    });
    const url = baseUrl + '/api/ai/decision';
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
