const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, engine } = require('../server/index');

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
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('runBrowserUseDomAudit inspects real HTML and returns domAuditScore', () => {
  const result = engine.runBrowserUseDomAudit();
  assert.equal(result.ok, true);
  assert.equal(typeof result.domAuditScore, 'number');
  assert.ok(result.domAuditScore >= 0 && result.domAuditScore <= 100);
  assert.ok(Array.isArray(result.domNodes));
  assert.equal(result.domNodes.length, 5);
});
