require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
const zlib = require('zlib');
const engine = new CompanyEngine();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

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
    state: engine.state,
    providersCatalog: PROVIDERS,
    templates: COMPANY_TEMPLATES,
    githubIntegrations: GITHUB_INTEGRATIONS,
    mcpServers: MCP_SERVERS,
    toolRegistry: TOOL_REGISTRY,
    owaspRisks: OWASP_AGENTIC_RISKS,
    a2aCards: engine.getA2AAgentCards()
  });
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  engine.addSSEClient(res);
  req.on('close', () => {
    engine.removeSSEClient(res);
  });
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
  const state = engine.importCompanyPack(req.body);
  res.json({ state });
});

app.post('/api/company/init', (req, res) => {
  const { name, theme, goal, budget, templateId } = req.body;
  const state = engine.resetCompany({ name, theme, goal, budget, templateId });
  res.json({ state });
});

app.post('/api/company/settings', (req, res) => {
  const { speedMs, uiTheme } = req.body;
  const state = engine.setPipelineSpeed(speedMs, uiTheme);
  res.json({ state });
});

app.post('/api/company/optimize', (req, res) => {
  const state = engine.optimizeCompany();
  res.json({ state });
});

app.post('/api/pipeline/start', (req, res) => {
  engine.startLoop();
  res.json({ state: engine.state });
});

app.post('/api/pipeline/stop', (req, res) => {
  engine.stopLoop();
  res.json({ state: engine.state });
});

app.post('/api/pipeline/step', async (req, res) => {
  await engine.runSingleCycle();
  res.json({ state: engine.state });
});

app.post('/api/providers/config', (req, res) => {
  engine.updateProviderConfig(req.body);
  res.json({ state: engine.state });
});

app.post('/api/agents/hire', async (req, res) => {
  const { role, department, reason, providerOverride, modelOverride, harnessType, tools } = req.body;
  await engine.manualHire({ role, department, reason, providerOverride, modelOverride, harnessType, tools });
  res.json({ state: engine.state });
});

app.post('/api/agents/spawn-subagent', (req, res) => {
  const { parentAgentId, name, specialty, taskFocus, promoteToFullHire } = req.body;
  engine.manualSpawnSubAgent({ parentAgentId, name, specialty, taskFocus, promoteToFullHire });
  res.json({ state: engine.state });
});

app.post('/api/agents/update', (req, res) => {
  const { agentId, updates } = req.body;
  engine.updateAgentConfig(agentId, updates);
  res.json({ state: engine.state });
});

app.post('/api/agents/clone', (req, res) => {
  const { agentId } = req.body;
  engine.cloneAgent(agentId);
  res.json({ state: engine.state });
});

app.post('/api/agents/fire', (req, res) => {
  const { agentId, reason } = req.body;
  engine.manualFire(agentId, reason);
  res.json({ state: engine.state });
});

app.post('/api/agents/train', (req, res) => {
  const { agentId, sop } = req.body;
  engine.manualTrainAgent(agentId, sop);
  res.json({ state: engine.state });
});

app.post('/api/tasks/add', (req, res) => {
  const { title, department, collaboratorDept, priority, description } = req.body;
  engine.manualAddTask({ title, department, collaboratorDept, priority, description });
  res.json({ state: engine.state });
});

app.post('/api/tasks/handoff', (req, res) => {
  const { taskId, toAgentId, note } = req.body;
  engine.manualHandoffTask({ taskId, toAgentId, note });
  res.json({ state: engine.state });
});

app.post('/api/console/message', async (req, res) => {
  const { toAgentId, message } = req.body;
  await engine.postConsoleMessage({ toAgentId, message });
  res.json({ state: engine.state });
});

app.post('/api/board/resolve', (req, res) => {
  const { proposalId, decision } = req.body;
  engine.resolveBoardProposal({ proposalId, decision });
  res.json({ state: engine.state });
});

app.post('/api/agents/reassign-room', (req, res) => {
  const { agentId, targetRoom } = req.body;
  const result = engine.reassignAgentRoom({ agentId, targetRoom });
  res.json({ state: engine.state, result });
});

app.post('/api/workspace/run', async (req, res) => {
  const { filename } = req.body;
  const result = await engine.runWorkspaceModule(filename);
  res.json({ state: engine.state, result });
});

app.post('/api/workspace/save', (req, res) => {
  const { filename, content } = req.body;
  const file = engine.saveWorkspaceFileContent({ filename, content });
  res.json({ state: engine.state, file });
});

app.post('/api/company/war-room', async (req, res) => {
  const { topic } = req.body || {};
  await engine.runWarRoomStandup({ topic });
  res.json({ state: engine.state });
});

app.post('/api/company/checkpoints/create', (req, res) => {
  const { label } = req.body || {};
  const checkpoint = engine.createCheckpoint({ label });
  res.json({ state: engine.state, checkpoint });
});

app.post('/api/company/checkpoints/restore', (req, res) => {
  const { checkpointId } = req.body || {};
  engine.restoreCheckpoint({ checkpointId });
  res.json({ state: engine.state });
});

app.post('/api/company/red-team', (req, res) => {
  const audit = engine.runRedTeamAudit();
  res.json({ state: engine.state, audit });
});

app.post('/api/workspace/export-app', (req, res) => {
  const bundle = engine.exportStandaloneApp();
  res.json({ state: engine.state, bundle });
});

app.get('/api/workspace/export-app', (req, res) => {
  const bundle = engine.exportStandaloneApp();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
  res.send(bundle.content);
});

app.post('/api/company/poach-talent', (req, res) => {
  const result = engine.poachRivalTalent(req.body || {});
  res.json({ state: engine.state, result });
});

app.post('/api/workspace/test-all', (req, res) => {
  const testResult = engine.runAllTests();
  res.json({ state: engine.state, testResult });
});

app.post('/api/company/shift-mode', (req, res) => {
  engine.setOfficeShiftMode(req.body || {});
  res.json({ state: engine.state });
});

app.post('/api/tools/execute', async (req, res) => {
  const result = await engine.executeCustomToolScript(req.body || {});
  res.json({ state: engine.state, result });
});

app.post('/api/tools/create', async (req, res) => {
  const result = await engine.createCustomMcpTool(req.body || {});
  res.json({
    state: engine.state,
    toolRegistry: TOOL_REGISTRY,
    mcpServers: MCP_SERVERS,
    result
  });
});

app.post('/api/workspace/auto-heal', (req, res) => {
  const healResult = engine.runSelfHealingCodeDebugger();
  res.json({ state: engine.state, healResult });
});

app.post('/api/mcp', async (req, res) => {
  const rpcResponse = await handleMcpJsonRpc({ ...(req.body || {}), engine });
  res.json({ ...rpcResponse, state: engine.state });
});

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
  res.json({ state: engine.state, memory });
});

app.post('/api/evals/run', (req, res) => {
  const evalResult = engine.runCompanyEvalBenchmark();
  res.json({ state: engine.state, evalResult });
});

// v12: Live LLM API connection test (verify key + latency before running pipeline)
app.post('/api/providers/test', async (req, res) => {
  const { providerKey, model, apiKey, baseUrl } = req.body || {};
  const saved = engine.state.providerConfig?.providers?.[providerKey] || {};
  const result = await testProviderConnection({
    providerKey,
    model: model || saved.model,
    apiKey: apiKey || saved.apiKey,
    baseUrl: baseUrl || saved.baseUrl
  });
  res.json({ result });
});

// v12: Live product runtime — serves the company's generated landing page + pricing
app.get('/live-product', (req, res) => {
  const html = (engine.state.workspaceFiles || []).find((f) => f.filename.endsWith('_landing.html'));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html?.content || `<!DOCTYPE html><html><body style="background:#090d16;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:60px"><h1>${engine.state.company.name}</h1><p>No landing page generated yet — run a Marketing pipeline step.</p></body></html>`);
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
  res.json({ state: engine.state, traffic });
});

app.post('/api/agents/tournament', (req, res) => {
  const tournament = engine.runDspyPromptTournament(req.body || {});
  res.json({ state: engine.state, tournament });
});

app.post('/api/tasks/edit-state', (req, res) => {
  const result = engine.editTaskStateAndResume(req.body || {});
  res.json({ state: engine.state, result });
});

app.post('/api/product/browser-agent-audit', (req, res) => {
  const result = engine.runBrowserUseDomAudit();
  res.json({ state: engine.state, result });
});

app.post('/api/company/market-blitz', (req, res) => {
  const result = engine.runCompetitiveMarketBlitz(req.body || {});
  res.json({ state: engine.state, result });
});

app.get('/api/github/status', (req, res) => {
  const { execFileSync } = require('child_process');
  const rootDir = path.join(__dirname, '..');
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim();
    const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: rootDir, encoding: 'utf8' }).trim();
    const statusRaw = execFileSync('git', ['status', '--short'], { cwd: rootDir, encoding: 'utf8' }).trim();
    const logRaw = execFileSync('git', ['log', '-n', '6', '--pretty=format:%h|%s|%cr'], { cwd: rootDir, encoding: 'utf8' }).trim();
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
});

app.post('/api/github/sync', (req, res) => {
  const { execFileSync } = require('child_process');
  const rootDir = path.join(__dirname, '..');
  const commitMsg = String(req.body?.message || `feat(aci-studio): autonomous workspace & telemetry sync (${new Date().toISOString().slice(0, 16)})`).slice(0, 120);
  try {
    execFileSync('git', ['add', '-A'], { cwd: rootDir, stdio: 'pipe' });
    const statusAfterAdd = execFileSync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8' }).trim();
    let commitOutput = 'Working tree clean — already up to date with origin/main';
    if (statusAfterAdd) {
      commitOutput = execFileSync('git', ['commit', '-m', commitMsg], { cwd: rootDir, encoding: 'utf8' }).trim();
    }
    execFileSync('git', ['push', 'origin', 'main'], { cwd: rootDir, stdio: 'pipe', timeout: 15000 });
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
      state: engine.state
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 AI Company OS v13 at: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
