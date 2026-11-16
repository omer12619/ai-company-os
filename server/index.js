require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { promisify } = require('util');
const { execFile } = require('child_process');
const execFileAsync = promisify(execFile);
const { PROVIDERS, testProviderConnection } = require('./llm-router');
const {
  COMPANY_TEMPLATES,
  GITHUB_INTEGRATIONS,
  MCP_SERVERS,
  TOOL_REGISTRY,
  OWASP_AGENTIC_RISKS,
  handleMcpJsonRpc,
  CompanyEngine
} = require('./company-engine');

const app = express();
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '127.0.0.1';
const engine = new CompanyEngine();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const safeState = () => engine.sanitizeStateForClient(engine.state);
const escapeHtml = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Built-in Zero-Dependency Gzip Compression for JSON API payloads (>1.5KB)
app.use((req, res, next) => {
  if (req.path === '/api/stream') return next();
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();
  const origJson = res.json.bind(res);
  res.json = (body) => {
    const raw = JSON.stringify(body);
    if (raw.length < 1500) return origJson(body);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    return res.send(zlib.gzipSync(Buffer.from(raw, 'utf8')));
  };
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/state', (req, res) => {
  res.json({
    state: safeState(),
    providersCatalog: PROVIDERS,
    templates: COMPANY_TEMPLATES,
    githubIntegrations: GITHUB_INTEGRATIONS,
    mcpServers: MCP_SERVERS,
    toolRegistry: TOOL_REGISTRY,
    owaspRisks: OWASP_AGENTIC_RISKS,
    a2aCards: engine.getA2AAgentCards()
  });
});

app.get('/api/workspace/file/:filename', (req, res) => {
  const safeName = path.basename(String(req.params.filename || '')).replace(/[^a-zA-Z0-9._-]/g, '_');
  const found = (engine.state.workspaceFiles || []).find((f) => f.filename === safeName);
  if (found && typeof found.content === 'string') {
    return res.json({ ok: true, file: found });
  }
  const diskPath = path.join(__dirname, '..', 'workspace', safeName);
  if (fs.existsSync(diskPath)) {
    const content = fs.readFileSync(diskPath, 'utf8');
    return res.json({ ok: true, file: { filename: safeName, content } });
  }
  return res.status(404).json({ ok: false, error: 'Workspace file not found' });
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  engine.addSSEClient(res);
  const keepAlive = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(keepAlive);
      engine.removeSSEClient(res);
    }
  }, 25000);
  keepAlive.unref?.();
  const cleanup = () => {
    clearInterval(keepAlive);
    engine.removeSSEClient(res);
  };
  req.on('close', cleanup);
  res.on('error', cleanup);
});

app.get('/api/company/export', (req, res) => {
  const safeExport = {
    company: engine.state.company,
    agents: engine.state.agents,
    skillsRegistry: engine.state.skillsRegistry,
    tasks: engine.state.tasks,
    workspaceFiles: engine.state.workspaceFiles,
    memoryWiki: engine.state.memoryWiki,
    exportedAt: new Date().toISOString()
  };
  res.setHeader('Content-Disposition', `attachment; filename="company-pack-${Date.now()}.json"`);
  res.json(safeExport);
});

app.post('/api/company/import', (req, res) => {
  engine.importCompanyPack(req.body);
  res.json({ state: safeState() });
});

app.post('/api/company/init', (req, res) => {
  const { name, theme, goal, budget, templateId } = req.body;
  engine.resetCompany({ name, theme, goal, budget, templateId });
  res.json({ state: safeState() });
});

app.post('/api/company/settings', (req, res) => {
  const { speedMs, uiTheme } = req.body;
  engine.setPipelineSpeed(speedMs, uiTheme);
  res.json({ state: safeState() });
});

app.post('/api/company/optimize', (req, res) => {
  engine.optimizeCompany();
  res.json({ state: safeState() });
});

app.post('/api/pipeline/start', (req, res) => {
  engine.startLoop();
  res.json({ state: safeState() });
});

app.post('/api/pipeline/stop', (req, res) => {
  engine.stopLoop();
  res.json({ state: safeState() });
});

app.post('/api/pipeline/step', asyncHandler(async (req, res) => {
  await engine.runSingleCycle();
  res.json({ state: safeState() });
}));

app.post('/api/providers/config', (req, res) => {
  engine.updateProviderConfig(req.body);
  res.json({ state: safeState() });
});

app.post('/api/agents/hire', asyncHandler(async (req, res) => {
  const { role, department, reason, providerOverride, modelOverride, harnessType, tools } = req.body;
  await engine.manualHire({ role, department, reason, providerOverride, modelOverride, harnessType, tools });
  res.json({ state: safeState() });
}));

app.post('/api/agents/spawn-subagent', (req, res) => {
  const { parentAgentId, name, specialty, taskFocus, promoteToFullHire } = req.body;
  engine.manualSpawnSubAgent({ parentAgentId, name, specialty, taskFocus, promoteToFullHire });
  res.json({ state: safeState() });
});

app.post('/api/agents/update', (req, res) => {
  const { agentId, updates } = req.body;
  engine.updateAgentConfig(agentId, updates);
  res.json({ state: safeState() });
});

app.post('/api/agents/clone', (req, res) => {
  const { agentId } = req.body;
  engine.cloneAgent(agentId);
  res.json({ state: safeState() });
});

app.post('/api/agents/fire', (req, res) => {
  const { agentId, reason } = req.body;
  engine.manualFire(agentId, reason);
  res.json({ state: safeState() });
});

app.post('/api/agents/train', (req, res) => {
  const { agentId, sop } = req.body;
  engine.manualTrainAgent(agentId, sop);
  res.json({ state: safeState() });
});

app.post('/api/tasks/add', (req, res) => {
  const { title, department, collaboratorDept, priority, description } = req.body;
  engine.manualAddTask({ title, department, collaboratorDept, priority, description });
  res.json({ state: safeState() });
});

app.post('/api/tasks/handoff', (req, res) => {
  const { taskId, toAgentId, note } = req.body;
  engine.manualHandoffTask({ taskId, toAgentId, note });
  res.json({ state: safeState() });
});

app.post('/api/console/message', asyncHandler(async (req, res) => {
  const { toAgentId, message } = req.body;
  await engine.postConsoleMessage({ toAgentId, message });
  res.json({ state: safeState() });
}));

app.post('/api/board/resolve', (req, res) => {
  const { proposalId, decision } = req.body;
  engine.resolveBoardProposal({ proposalId, decision });
  res.json({ state: safeState() });
});

app.post('/api/agents/reassign-room', (req, res) => {
  const { agentId, targetRoom } = req.body;
  const result = engine.reassignAgentRoom({ agentId, targetRoom });
  res.json({ state: safeState(), result });
});

app.post('/api/workspace/run', asyncHandler(async (req, res) => {
  const { filename } = req.body;
  const result = await engine.runWorkspaceModule(filename);
  res.json({ state: safeState(), result });
}));

app.post('/api/workspace/save', (req, res) => {
  const { filename, content } = req.body;
  const file = engine.saveWorkspaceFileContent({ filename, content });
  res.json({ state: safeState(), file });
});

app.post('/api/company/war-room', asyncHandler(async (req, res) => {
  const { topic } = req.body || {};
  await engine.runWarRoomStandup({ topic });
  res.json({ state: safeState() });
}));

app.post('/api/company/checkpoints/create', (req, res) => {
  const { label } = req.body || {};
  const checkpoint = engine.createCheckpoint({ label });
  res.json({ state: safeState(), checkpoint });
});

app.post('/api/company/checkpoints/restore', (req, res) => {
  const { checkpointId } = req.body || {};
  engine.restoreCheckpoint({ checkpointId });
  res.json({ state: safeState() });
});

app.post('/api/company/red-team', (req, res) => {
  const audit = engine.runRedTeamAudit();
  res.json({ state: safeState(), audit });
});

app.post('/api/workspace/export-app', (req, res) => {
  const bundle = engine.exportStandaloneApp();
  res.json({ state: safeState(), bundle });
});

app.get('/api/workspace/export-app', (req, res) => {
  const bundle = engine.exportStandaloneApp();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
  res.send(bundle.content);
});

app.post('/api/company/poach-talent', (req, res) => {
  const result = engine.poachRivalTalent(req.body || {});
  res.json({ state: safeState(), result });
});

app.post('/api/workspace/test-all', (req, res) => {
  const testResult = engine.runAllTests();
  res.json({ state: safeState(), testResult });
});

app.post('/api/company/shift-mode', (req, res) => {
  engine.setOfficeShiftMode(req.body || {});
  res.json({ state: safeState() });
});

app.post('/api/tools/execute', asyncHandler(async (req, res) => {
  const result = await engine.executeCustomToolScript(req.body || {});
  res.json({ state: safeState(), result });
}));

app.post('/api/tools/create', asyncHandler(async (req, res) => {
  const result = await engine.createCustomMcpTool(req.body || {});
  res.json({
    state: safeState(),
    toolRegistry: TOOL_REGISTRY,
    mcpServers: MCP_SERVERS,
    result
  });
}));

app.post('/api/workspace/auto-heal', (req, res) => {
  const healResult = engine.runSelfHealingCodeDebugger();
  res.json({ state: safeState(), healResult });
});

app.post('/api/mcp', asyncHandler(async (req, res) => {
  const rpcResponse = await handleMcpJsonRpc({ ...(req.body || {}), engine });
  res.json({ ...rpcResponse, state: safeState() });
}));

app.get('/api/a2a/cards', (req, res) => {
  res.json({
    protocol: 'Google-A2A-1.0',
    company: engine.state.company.name,
    agents: engine.getA2AAgentCards()
  });
});

app.get('/.well-known/agent-card.json', (req, res) => {
  res.json({
    protocolVersion: 'A2A-1.0',
    organization: engine.state.company.name,
    mission: engine.state.company.goal,
    mcpEndpoint: '/api/mcp',
    a2aDirectoryEndpoint: '/api/a2a/cards',
    agents: engine.getA2AAgentCards()
  });
});

app.get('/api/otel/traces', (req, res) => {
  res.json({
    schemaUrl: 'https://opentelemetry.io/schemas/1.28.0',
    serviceName: 'ai-company-os',
    spansCount: (engine.state.otelSpans || []).length,
    spans: engine.state.otelSpans || []
  });
});

app.get('/api/memory/graph', (req, res) => {
  res.json({
    cognitiveMemory: engine.state.cognitiveMemory || { episodicEvents: [], knowledgeGraph: [], consolidationsCount: 1 }
  });
});

app.post('/api/memory/consolidate', (req, res) => {
  const memory = engine.consolidateCognitiveMemory();
  res.json({ state: safeState(), memory });
});

app.post('/api/rag/query', (req, res) => {
  const { query = '', department = null, topK = 4 } = req.body || {};
  const result = engine.retrieveRagContext({ query: String(query), department, topK: Math.min(10, Math.max(1, Number(topK) || 4)) });
  res.json({ ok: true, ...result });
});

app.post('/api/evals/run', (req, res) => {
  const evalResult = engine.runCompanyEvalBenchmark();
  res.json({ state: safeState(), evalResult });
});

// v12: Live LLM API connection test (verify key + latency before running pipeline)
app.post('/api/providers/test', asyncHandler(async (req, res) => {
  const { providerKey, model, apiKey, baseUrl } = req.body || {};
  const saved = engine.state.providerConfig?.providers?.[providerKey] || {};
  const result = await testProviderConnection({
    providerKey,
    model: model || saved.model,
    apiKey: apiKey || saved.apiKey,
    baseUrl: baseUrl || saved.baseUrl
  });
  res.json({ result });
}));

// v12 + v13: Live product runtime — serves the company's generated landing page + interactive Stripe checkout dock
app.get('/live-product', (req, res) => {
  const html = (engine.state.workspaceFiles || []).find((f) => f.filename.endsWith('_landing.html'));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const rawHtml =
    html?.content ||
    `<!DOCTYPE html><html><body style="background:#090d16;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:60px"><h1>${escapeHtml(engine.state.company.name)}</h1><p>No landing page generated yet — run a Marketing pipeline step.</p></body></html>`;

  const interactiveWidget = `
  <!-- AI Company OS Live Product Runtime Telemetry & Interactive Stripe Checkout Bar -->
  <div id="aiOsLiveRuntimeBar" style="position:fixed;bottom:12px;right:12px;left:12px;background:rgba(6,10,20,0.94);border:1px solid rgba(56,189,248,0.45);border-radius:10px;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-family:Inter,system-ui,sans-serif;font-size:12px;color:#f8fafc;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,0.65);backdrop-filter:blur(10px);">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="color:#10b981;font-weight:800;">● LIVE RUNTIME</span>
      <span id="lpMrrBadge" style="background:rgba(16,185,129,0.15);color:#34d399;padding:2px 8px;border-radius:999px;font-weight:700;">MRR: $${(engine.state.company.mrr || 0).toLocaleString()}/mo</span>
      <span id="lpCustBadge" style="background:rgba(56,189,248,0.15);color:#38bdf8;padding:2px 8px;border-radius:999px;font-weight:700;">Customers: ${engine.state.company.customersCount || 0}</span>
      <span style="color:#94a3b8;font-size:11px;">Source: ${escapeHtml(html?.filename || 'default_funnel.html')}</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.triggerLiveCheckout()" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-weight:700;font-size:11.5px;cursor:pointer;">💳 Test Live Customer Checkout (+MRR)</button>
      <a href="/live-product/api/health" target="_blank" style="background:rgba(30,41,59,0.9);color:#cbd5e1;text-decoration:none;border:1px solid #334155;border-radius:6px;padding:5px 10px;font-size:11px;">🩺 Health JSON</a>
    </div>
  </div>
  <script>
    window.triggerLiveCheckout = async function() {
      try {
        const r = await fetch('/api/product/simulate-traffic', { method: 'POST' });
        const d = await r.json();
        if (d && d.state && d.state.company) {
          document.getElementById('lpMrrBadge').textContent = 'MRR: $' + (d.state.company.mrr || 0).toLocaleString() + '/mo';
          document.getElementById('lpCustBadge').textContent = 'Customers: ' + (d.state.company.customersCount || 0);
        }
      } catch (e) {}
    };
  </script>`;

  const injected = rawHtml.includes('</body>')
    ? rawHtml.replace('</body>', `${interactiveWidget}\n</body>`)
    : `${rawHtml}\n${interactiveWidget}`;
  res.send(injected);
});

app.get('/live-product/api/health', (req, res) => {
  res.json({
    ok: true,
    company: engine.state.company.name,
    mrr: engine.state.company.mrr || 0,
    customers: engine.state.company.customersCount || 0,
    timestamp: new Date().toISOString()
  });
});

app.get('/live-product/api/pricing', (req, res) => {
  const model = (engine.state.workspaceFiles || []).find((f) => f.filename.endsWith('_unit_model.json'));
  try {
    res.json(model ? JSON.parse(model.content) : { tiers: [] });
  } catch {
    res.json({ tiers: [] });
  }
});

app.post('/api/product/simulate-traffic', (req, res) => {
  const traffic = engine.simulateLiveCustomerTraffic();
  res.json({ state: safeState(), traffic });
});

app.post('/api/agents/tournament', (req, res) => {
  const tournament = engine.runDspyPromptTournament(req.body || {});
  res.json({ state: safeState(), tournament });
});

app.post('/api/tasks/edit-state', (req, res) => {
  const result = engine.editTaskStateAndResume(req.body || {});
  res.json({ state: safeState(), result });
});

app.post('/api/product/browser-agent-audit', (req, res) => {
  const result = engine.runBrowserUseDomAudit();
  res.json({ state: safeState(), result });
});

app.post('/api/company/market-blitz', (req, res) => {
  const result = engine.runCompetitiveMarketBlitz(req.body || {});
  res.json({ state: safeState(), result });
});

app.get('/api/github/status', asyncHandler(async (req, res) => {
  const rootDir = path.join(__dirname, '..');
  try {
    const [branchOut, remoteOut, statusOut, logOut] = await Promise.all([
      execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }),
      execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd: rootDir, encoding: 'utf8' }),
      execFileAsync('git', ['status', '--short'], { cwd: rootDir, encoding: 'utf8' }),
      execFileAsync('git', ['log', '-n', '6', '--pretty=format:%h|%s|%cr'], { cwd: rootDir, encoding: 'utf8' })
    ]);
    const branch = branchOut.stdout.trim();
    const remoteUrl = remoteOut.stdout.trim();
    const statusRaw = statusOut.stdout.trim();
    const logRaw = logOut.stdout.trim();
    const commits = logRaw
      ? logRaw.split('\n').map((line) => {
          const [hash, subject, relativeTime] = line.split('|');
          return { hash, subject, relativeTime };
        })
      : [];
    res.json({
      ok: true,
      branch,
      remoteUrl,
      changedFiles: statusRaw ? statusRaw.split('\n').filter(Boolean) : [],
      commits
    });
  } catch (err) {
    res.json({ ok: false, error: err.message, branch: 'main', remoteUrl: 'https://github.com/omer12619/ai-company-os', changedFiles: [], commits: [] });
  }
}));

app.post('/api/github/sync', asyncHandler(async (req, res) => {
  const rootDir = path.join(__dirname, '..');
  const commitMsg = String(req.body?.message || `feat(aci-studio): autonomous workspace & telemetry sync (${new Date().toISOString().slice(0, 16)})`).slice(0, 120);
  try {
    await execFileAsync('git', ['add', '-A'], { cwd: rootDir });
    const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8' });
    let commitOutput = 'Working tree clean — already up to date with origin/main';
    if (statusOut.trim()) {
      const { stdout: cOut } = await execFileAsync('git', ['commit', '-m', commitMsg], { cwd: rootDir, encoding: 'utf8' });
      commitOutput = cOut.trim();
    }
    await execFileAsync('git', ['push', 'origin', 'main'], { cwd: rootDir, timeout: 45000 });
    engine.logEvent({
      type: 'SYSTEM',
      department: 'Engineering',
      actor: 'OpenHands ACI GitHub Studio',
      title: `Pushed Commit to GitHub (omer12619/ai-company-os)`,
      detail: commitMsg
    });
    res.json({
      ok: true,
      commitMsg,
      commitOutput,
      summary: `Synced & pushed to https://github.com/omer12619/ai-company-os (${commitMsg})`,
      state: safeState()
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}));

// Global Express Error Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal server error' });
});

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 AI Company OS v13 at: http://${HOST}:${PORT}`);
    console.log(`======================================================\n`);
  });

  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, flushing state to disk...`);
    engine.stopLoop();
    engine.flushStateSync();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { app, engine };
