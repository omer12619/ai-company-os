const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, engine } = require('../server/index');
const { retrieveContext } = require('../server/rag-retriever');
const { selectArbitrageModel } = require('../server/llm-router');

function requestJson(baseUrl, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${baseUrl}${urlPath}`,
      {
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('sanitizeStateForClient masks raw API keys and supports slim SSE mode', () => {
  const sample = {
    providerConfig: {
      activeProvider: 'openai',
      providers: {
        openai: { model: 'gpt-4o-mini', apiKey: 'sk-super-secret-123456789' }
      }
    },
    workspaceFiles: [
      { id: 'f1', filename: 'app.js', department: 'Engineering', author: 'CTO', sizeBytes: 20, content: 'console.log(1);', updatedAt: '2026-01-01T00:00:00.000Z' }
    ]
  };

  const full = engine.sanitizeStateForClient(sample, { includeWorkspaceContent: true });
  assert.equal(full.providerConfig.providers.openai.apiKey, '');
  assert.equal(full.providerConfig.providers.openai.hasKey, true);
  assert.equal(full.providerConfig.providers.openai.apiKeyMasked, 'sk-s••••789');
  assert.equal(full.workspaceFiles[0].content, 'console.log(1);');

  const slim = engine.sanitizeStateForClient(sample, { includeWorkspaceContent: false });
  assert.equal(slim.workspaceFiles[0].content, undefined);
  assert.equal(slim.workspaceFiles[0].filename, 'app.js');
});

test('clampRingBuffers keeps workspaceFiles and logs bounded', () => {
  const dummy = {
    events: new Array(100).fill({}),
    workspaceFiles: new Array(80).fill({ filename: 'x.js' })
  };
  engine.clampRingBuffers(dummy);
  assert.equal(dummy.events.length, 45);
  assert.equal(dummy.workspaceFiles.length, 32);
});

test('HTTP API smoke tests (/api/state, /live-product/api/health, /api/mcp, 404 file)', async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const stateRes = await requestJson(baseUrl, 'GET', '/api/state');
    assert.equal(stateRes.status, 200);
    assert.ok(stateRes.body.state);
    for (const p of Object.values(stateRes.body.state.providerConfig.providers || {})) {
      assert.equal(p.apiKey, '');
    }

    const healthRes = await requestJson(baseUrl, 'GET', '/live-product/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.ok, true);

    const mcpRes = await requestJson(baseUrl, 'POST', '/api/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });
    assert.equal(mcpRes.status, 200);
    assert.equal(mcpRes.body.jsonrpc, '2.0');
    assert.ok(Array.isArray(mcpRes.body.result?.tools));

    const missingFileRes = await requestJson(baseUrl, 'GET', '/api/workspace/file/does_not_exist_12345.js');
    assert.equal(missingFileRes.status, 404);
    assert.equal(missingFileRes.body.ok, false);

    const liveRes = await new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}/live-product`, (res) => {
          let html = '';
          res.on('data', (c) => (html += c));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, html }));
        })
        .on('error', reject);
    });
    assert.equal(liveRes.status, 200);
    assert.equal(liveRes.headers['x-content-type-options'], 'nosniff');
    assert.equal(liveRes.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(liveRes.html.includes('aiOsLiveRuntimeBar'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('runBrowserUseDomAudit inspects real HTML and returns domAuditScore', () => {
  const prevMrr = engine.state.company.mrr;
  const prevCust = engine.state.company.customersCount;
  const result = engine.runBrowserUseDomAudit();
  if (engine.diskFlushTimer) {
    clearTimeout(engine.diskFlushTimer);
    engine.diskFlushTimer = null;
  }
  engine.state.company.mrr = prevMrr;
  engine.state.company.customersCount = prevCust;
  assert.equal(result.ok, true);
  assert.equal(typeof result.domAuditScore, 'number');
  assert.ok(result.domAuditScore >= 0 && result.domAuditScore <= 100);
  assert.ok(Array.isArray(result.domNodes));
  assert.equal(result.domNodes.length, 5);
});

test('BM25 + Graph RAG retriever ranks relevant workspace & wiki chunks', async () => {
  const sampleState = {
    workspaceFiles: [
      {
        filename: 'billing_schema.sql',
        department: 'Engineering',
        content: 'CREATE TABLE stripe_subscriptions (id UUID PRIMARY KEY, mrr_cents INT NOT NULL, plan_tier TEXT);'
      },
      {
        filename: 'gtm_copy.md',
        department: 'Marketing',
        content: 'Launch social ad campaign for B2B workflow automation teams.'
      }
    ],
    memoryWiki: [],
    cognitiveMemory: {
      knowledgeGraph: [
        { subject: 'Stripe Webhook', predicate: 'UPDATES', object: 'stripe_subscriptions.mrr_cents', department: 'Engineering', confidence: 0.98 }
      ]
    }
  };

  const res = retrieveContext({
    state: sampleState,
    query: 'stripe subscriptions mrr_cents schema',
    department: 'Engineering',
    topK: 2
  });
  assert.ok(res.hits.length >= 1);
  assert.equal(res.hits[0].sourceName, 'billing_schema.sql');
  assert.ok(res.formattedContext.includes('stripe_subscriptions'));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const port = server.address().port;
    const apiRes = await requestJson(`http://127.0.0.1:${port}`, 'POST', '/api/rag/query', {
      query: 'architecture schema event bus',
      topK: 3
    });
    assert.equal(apiRes.status, 200);
    assert.equal(apiRes.body.ok, true);
    assert.ok(apiRes.body.totalChunksIndexed > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Contract-first validators return 400 Bad Request on invalid payloads & spend circuit breaker halts loop', async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const badTask = await requestJson(baseUrl, 'POST', '/api/tasks/add', { title: '   ' });
    assert.equal(badTask.status, 400);
    assert.equal(badTask.body.ok, false);

    const badSettings = await requestJson(baseUrl, 'POST', '/api/company/settings', { speedMs: 10 });
    assert.equal(badSettings.status, 400);

    const badRag = await requestJson(baseUrl, 'POST', '/api/rag/query', { query: '' });
    assert.equal(badRag.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // Test Spend Circuit Breaker
  const prevRunning = engine.state.company.isRunning;
  const prevSpent = engine.state.company.budgetSpent;
  const prevTotal = engine.state.company.budgetTotal;
  engine.state.company.isRunning = true;
  engine.state.company.budgetTotal = 10;
  engine.state.company.budgetSpent = 9.99;
  engine.recordLedger({
    agent: null,
    action: 'Circuit Breaker Test',
    provider: 'simulator',
    model: 'test',
    totalTokens: 100,
    cost: 0.05
  });
  assert.equal(engine.state.company.isRunning, false);
  engine.state.company.isRunning = prevRunning;
  engine.state.company.budgetSpent = prevSpent;
  engine.state.company.budgetTotal = prevTotal;
});

test('AGENTS.md constitution loads, Smart Model Arbitrage routes tiers, and Typed HITL validates schema', async () => {
  const rules = engine.loadAgentsRules();
  assert.ok(rules.includes('Agentic AI Foundation'));

  const escalated = selectArbitrageModel({
    activeProvider: 'openai',
    configuredModel: 'gpt-4o-mini',
    taskAttempts: 2,
    budgetRemainingRatio: 0.8
  });
  assert.equal(escalated.model, 'gpt-4o');
  assert.equal(escalated.arbitrageTier, 'escalated');

  const economy = selectArbitrageModel({
    activeProvider: 'openai',
    configuredModel: 'gpt-4o',
    taskAttempts: 2,
    budgetRemainingRatio: 0.1
  });
  assert.equal(economy.model, 'gpt-4o-mini');
  assert.equal(economy.arbitrageTier, 'economy');

  const sampleProp = {
    id: 'prop-test-hitl',
    type: 'BUDGET_INCREASE',
    title: 'Test Typed HITL',
    status: 'pending',
    payload: { amount: 5 },
    responseSchema: { decision: { type: 'enum', options: ['approve', 'veto'] } }
  };
  engine.state.boardInbox.unshift(sampleProp);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const badHitl = await requestJson(baseUrl, 'POST', '/api/board/resolve', {
      proposalId: 'prop-test-hitl',
      decision: 'invalid_choice'
    });
    assert.equal(badHitl.status, 400);
  } finally {
    engine.state.boardInbox = engine.state.boardInbox.filter((p) => p.id !== 'prop-test-hitl');
    await new Promise((resolve) => server.close(resolve));
  }
});
