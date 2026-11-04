let appState = null;
let providersCatalog = {};
let companyTemplates = [];
let githubIntegrations = [];
let mcpServersCatalog = [];
let toolRegistry = [];
let a2aCardsCatalog = [];
let pollInterval = null;
let lastStateHash = '';
let lastSeenEventId = null;
let orgViewMode = 'office'; // 'office' | 'cards' | 'graph'

if (window.mermaid) {
  window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
}

function triggerSyntaxAndMermaidRender(containerEl) {
  if (!containerEl) return;
  try {
    if (window.hljs) {
      containerEl.querySelectorAll('pre code').forEach((block) => {
        if (!block.classList.contains('language-mermaid')) {
          window.hljs.highlightElement(block);
        }
      });
    }
    if (window.mermaid) {
      const mermaidBlocks = containerEl.querySelectorAll('code.language-mermaid');
      mermaidBlocks.forEach((codeEl, idx) => {
        const pre = codeEl.parentElement;
        if (!pre) return;
        const graphDiv = document.createElement('div');
        graphDiv.className = 'mermaid';
        graphDiv.id = `mermaid-diag-${Date.now()}-${idx}`;
        graphDiv.textContent = codeEl.textContent;
        pre.replaceWith(graphDiv);
      });
      window.mermaid.run({ querySelector: '.mermaid' }).catch(() => {});
    }
  } catch (e) {
    console.warn('Syntax/Mermaid render notice:', e);
  }
}

// React 18 Roots
let reactOfficeRoot = null;
let reactGraphRoot = null;
let reactWorkspaceRoot = null;
let reactAnalyticsRoot = null;
let reactGitHubRoot = null;
let reactToolRouterRoot = null;

// Restore saved theme immediately on load
const savedLocalTheme = localStorage.getItem('ai_company_theme') || 'classic';
document.body.setAttribute('data-theme', savedLocalTheme);

function showToast(title, detail = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = `<div style="font-weight:700;">${escapeHtml(title)}</div>` +
    (detail ? `<div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(detail.slice(0, 110))}</div>` : '');
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 3600);
}

window.triggerCelebrationBurst = function(x, y, count = 38) {
  const canvas = document.getElementById('celebrationFxCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const originX = x != null ? x : window.innerWidth / 2;
  const originY = y != null ? y : window.innerHeight * 0.35;

  const colors = ['#10b981', '#38bdf8', '#818cf8', '#f59e0b', '#ec4899', '#eab308'];
  const confetti = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = 4 + Math.random() * 8.5;
    confetti.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.8,
      w: 6 + Math.random() * 5,
      h: 4 + Math.random() * 4,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 16,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1.0,
      decay: 0.016 + Math.random() * 0.014
    });
  }

  let raf;
  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = 0;
    confetti.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.rot += p.rotSpeed;
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        active++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });

    if (active > 0) {
      raf = requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(raf);
    }
  }
  step();
};

async function fetchState(forceRender = false) {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.providersCatalog) providersCatalog = data.providersCatalog;
    if (data.templates) companyTemplates = data.templates;
    if (data.githubIntegrations) githubIntegrations = data.githubIntegrations;
    if (data.mcpServers) mcpServersCatalog = data.mcpServers;
    if (data.toolRegistry) toolRegistry = data.toolRegistry;
    if (data.a2aCards) a2aCardsCatalog = data.a2aCards;

    const newestEvt = data.state.events?.[0];
    if (newestEvt && lastSeenEventId && newestEvt.id !== lastSeenEventId) {
      showToast(`${newestEvt.type}: ${newestEvt.title}`, newestEvt.detail);
    }
    if (newestEvt) lastSeenEventId = newestEvt.id;

    const stateSig = JSON.stringify({
      c: data.state.company.cycleCount,
      r: data.state.company.isRunning,
      s: data.state.company.statusMessage,
      p: data.state.company.activePhase,
      b: data.state.company.budgetSpent,
      h: data.state.company.handoffsCount,
      sa: data.state.company.subAgentsCount,
      tc: data.state.company.toolCallsCount,
      sk: (data.state.skillsRegistry || []).length,
      wf: (data.state.workspaceFiles || []).length,
      bi: (data.state.boardInbox || []).map((x) => `${x.id}:${x.status}`),
      a: data.state.agents.map((x) => `${x.id}:${x.department}:${x.status}:${x.kpi}:${(x.subAgents || []).length}`),
      f: data.state.firedAgents.length,
      t: data.state.tasks.map((x) => `${x.id}:${x.status}:${x.stage}:${x.assigneeId}`),
      m: data.state.consoleMessages.length,
      e: data.state.events.length
    });

    appState = data.state;
    if (forceRender || stateSig !== lastStateHash) {
      lastStateHash = stateSig;
      renderAll();
    }
  } catch (err) {
    console.error('Failed to fetch state:', err);
  }
}

function setOrgViewMode(mode) {
  orgViewMode = mode;
  const btnOffice = document.getElementById('btnViewOffice');
  const btnCards = document.getElementById('btnViewCards');
  const btnGraph = document.getElementById('btnViewGraph');
  if (btnOffice) btnOffice.className = mode === 'office' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  if (btnCards) btnCards.className = mode === 'cards' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  if (btnGraph) btnGraph.className = mode === 'graph' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';

  const officeEl = document.getElementById('reactVirtualOfficeRoot');
  const graphEl = document.getElementById('reactNodeGraphRoot');
  const cardsEl = document.getElementById('orgChartContainer');
  if (officeEl) officeEl.classList.toggle('hidden', mode !== 'office');
  if (graphEl) graphEl.classList.toggle('hidden', mode !== 'graph');
  if (cardsEl) cardsEl.classList.toggle('hidden', mode === 'graph');
  renderReactComponents();
}

function renderAll() {
  if (!appState) return;
  const {
    company,
    agents,
    firedAgents,
    hireQueue,
    tasks,
    skillsRegistry = [],
    workspaceFiles = [],
    consoleMessages = [],
    memoryWiki = [],
    ledger = [],
    events = [],
    providerConfig
  } = appState;

  const activeTheme = localStorage.getItem('ai_company_theme') || company.uiTheme || 'classic';
  document.body.setAttribute('data-theme', activeTheme);
  document.querySelectorAll('.theme-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.t === activeTheme);
  });

  const phases = ['strategy', 'hiring', 'execution', 'qa_evolution'];
  const currentPhase = company.activePhase || 'strategy';
  phases.forEach((ph) => {
    const node = document.getElementById(`step-${ph}`);
    if (node) node.classList.toggle('active', ph === currentPhase);
  });

  document.getElementById('companyName').textContent = company.name;
  document.getElementById('companyTheme').textContent = company.theme;
  document.getElementById('companyGoal').textContent = `Shared Mission: ${company.goal}`;

  const activeProv = providerConfig?.activeProvider || 'simulator';
  const activeModel = providerConfig?.providers?.[activeProv]?.model || '';
  const provName = providersCatalog[activeProv]?.name?.split(' ')[0] || activeProv;
  document.getElementById('activeProviderBadge').textContent = `🔌 ${provName}: ${activeModel}`;

  const btnToggle = document.getElementById('btnToggleLoop');
  const statusDot = document.getElementById('statusDot');
  if (company.isRunning) {
    btnToggle.textContent = '⏸ Pause Auto-Pilot';
    btnToggle.className = 'btn btn-danger';
    statusDot.className = 'pulse-dot running';
  } else {
    btnToggle.textContent = '▶ Start Auto-Pilot';
    btnToggle.className = 'btn btn-primary btn-glow';
    statusDot.className = 'pulse-dot idle';
  }

  document.getElementById('statusMessage').textContent = company.statusMessage;
  document.getElementById('cycleCount').textContent = company.cycleCount;
  document.getElementById('handoffsCount').textContent = company.handoffsCount || 0;
  document.getElementById('subAgentsCount').textContent = company.subAgentsCount || 0;
  document.getElementById('workspaceFilesCount').textContent = workspaceFiles.length;
  document.getElementById('tabBadgeFiles').textContent = workspaceFiles.length;
  document.getElementById('tokensSavedCount').textContent = (company.tokensSaved || 0).toLocaleString();

  const totalActiveSubs = agents.reduce((sum, a) => sum + ((a.subAgents || []).length), 0);
  document.getElementById('kpiActiveAgents').textContent = agents.length;
  document.getElementById('kpiFiredAgents').textContent = firedAgents.length;
  document.getElementById('kpiHireQueue').textContent = hireQueue.length;
  document.getElementById('kpiActiveSubs').textContent = totalActiveSubs;

  document.getElementById('kpiBudgetSpent').textContent = `$${company.budgetSpent.toFixed(2)}`;
  document.getElementById('kpiBudgetTotal').textContent = company.budgetTotal.toFixed(2);
  const pct = Math.min(100, (company.budgetSpent / Math.max(0.01, company.budgetTotal)) * 100);
  document.getElementById('budgetProgressBar').style.width = `${pct}%`;
  document.getElementById('kpiTotalTokens').textContent = company.totalTokens.toLocaleString();

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  document.getElementById('kpiCompletedTasks').textContent = completedCount;
  document.getElementById('kpiTotalTasks').textContent = tasks.length;

  const avgKpi = agents.length
    ? Math.round(agents.reduce((sum, a) => sum + (a.kpi || 80), 0) / agents.length)
    : 90;
  const totalSops = agents.reduce((sum, a) => sum + (a.sops?.length || 0), 0);
  document.getElementById('kpiAvgScore').textContent = `${avgKpi}%`;
  document.getElementById('kpiTotalSops').textContent = totalSops;
  document.getElementById('kpiSkillsCount').textContent = skillsRegistry.length;
  document.getElementById('tabBadgeSkills').textContent = skillsRegistry.length;

  renderOrgChart(agents, firedAgents, hireQueue);
  renderMiniConsole(consoleMessages);
  renderHermesTab(agents, skillsRegistry);
  renderSharedConsole(consoleMessages, agents);
  renderKanban(tasks);
  renderFinance(ledger);
  renderEvents(events);
  renderReactComponents();
}

// ============================================================================
// REACT 18 INTERACTIVE COMPONENTS (XYFlow-style Node Graph, IDE Workspace,
// Paperclip Per-Agent Budget Telemetry, & GitHub Ecosystem Hub)
// ============================================================================

function renderReactComponents() {
  if (!window.React || !window.ReactDOM || !appState) return;
  const h = React.createElement;

  // 0. React 60fps Animated Virtual Office Simulation Component
  const officeEl = document.getElementById('reactVirtualOfficeRoot');
  if (officeEl && window.VirtualOfficeComponent) {
    if (!reactOfficeRoot) reactOfficeRoot = ReactDOM.createRoot(officeEl);
    reactOfficeRoot.render(h(window.VirtualOfficeComponent, { state: appState }));
  }

  // 1. React Interactive SVG Node-Graph Component
  const graphEl = document.getElementById('reactNodeGraphRoot');
  if (graphEl) {
    if (!reactGraphRoot) reactGraphRoot = ReactDOM.createRoot(graphEl);
    reactGraphRoot.render(h(InteractiveOrgGraphComponent, { state: appState }));
  }

  // 2. React IDE Workspace & Markdown Artifact Explorer Component
  const wsEl = document.getElementById('reactWorkspaceRoot');
  if (wsEl) {
    if (!reactWorkspaceRoot) reactWorkspaceRoot = ReactDOM.createRoot(wsEl);
    reactWorkspaceRoot.render(h(WorkspaceExplorerComponent, {
      files: appState.workspaceFiles || [],
      wiki: appState.memoryWiki || []
    }));
  }

  // 3. React CFO Telemetry & Paperclip Agent Budget Cap Component
  const finEl = document.getElementById('reactAnalyticsRoot');
  if (finEl) {
    if (!reactAnalyticsRoot) reactAnalyticsRoot = ReactDOM.createRoot(finEl);
    reactAnalyticsRoot.render(h(CFOAnalyticsComponent, { state: appState }));
  }

  // 4. React GitHub Open-Source Stack & Portable Company Pack Manager
  const ghEl = document.getElementById('reactGitHubRoot');
  if (ghEl) {
    if (!reactGitHubRoot) reactGitHubRoot = ReactDOM.createRoot(ghEl);
    reactGitHubRoot.render(h(GitHubEcosystemComponent, {
      repos: githubIntegrations,
      state: appState
    }));
  }

  // 5. React Smart Tool & Script Router Studio
  const trEl = document.getElementById('reactToolRouterRoot');
  if (trEl) {
    if (!reactToolRouterRoot) reactToolRouterRoot = ReactDOM.createRoot(trEl);
    reactToolRouterRoot.render(h(ToolRouterStudioComponent, {
      tools: toolRegistry,
      mcpServers: mcpServersCatalog,
      a2aCards: a2aCardsCatalog,
      state: appState
    }));
  }
}

function ToolRouterStudioComponent({ tools, mcpServers, a2aCards, state }) {
  const h = React.createElement;
  const [runningToolId, setRunningToolId] = React.useState(null);
  const [selectedMcpServer, setSelectedMcpServer] = React.useState('all');
  const [protocolPreview, setProtocolPreview] = React.useState(null);
  const agents = state.agents || [];
  const executions = state.toolExecutions || [];

  const runToolNow = async (toolId) => {
    setRunningToolId(toolId);
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      });
      const data = await res.json();
      if (data.state && window.syncFromExternalState) {
        window.syncFromExternalState(data.state);
      }
      showToast(`🛠️ Executed ${toolId}`, data.result?.logs?.[0]?.output || data.result?.output || 'Completed script execution');
    } catch (e) {
      console.error('Tool execution error:', e);
    } finally {
      setRunningToolId(null);
    }
  };

  const queryMcpProtocol = async (method, params = {}) => {
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
      });
      const data = await res.json();
      setProtocolPreview({ title: `MCP JSON-RPC 2.0 (${method})`, payload: data.result || data });
    } catch (e) {
      setProtocolPreview({ title: 'MCP Error', payload: { error: e.message } });
    }
  };

  const queryA2ACards = async () => {
    try {
      const res = await fetch('/.well-known/agent-card.json');
      const data = await res.json();
      setProtocolPreview({ title: 'Google A2A Protocol (/.well-known/agent-card.json)', payload: data });
    } catch (e) {
      setProtocolPreview({ title: 'A2A Error', payload: { error: e.message } });
    }
  };

  const filteredTools = (tools || []).filter((t) =>
    selectedMcpServer === 'all' ? true : t.mcpServer === selectedMcpServer
  );

  return h('div', { className: 'wiki-card' },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } },
      h('div', null,
        h('h3', null, `🔌 Model Context Protocol (MCP) Hub, Google A2A & Smart Tool Router (${(tools || []).length} Tools)`),
        h('p', { className: 'sub-hint', style: { marginTop: '3px' } },
          'Bounded-context MCP servers with Progressive Tool Discovery, strict JSON Schemas, Google A2A Agent Cards, and isolated Node VM custom tools.'
        )
      ),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        h('button', {
          className: 'btn btn-sm btn-secondary',
          onClick: () => openModal('customToolModal')
        }, '🔌 + New Custom MCP Tool'),
        h('button', {
          className: 'btn btn-sm btn-secondary',
          onClick: async () => {
            const res = await fetch('/api/workspace/auto-heal', { method: 'POST' });
            const d = await res.json();
            if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
            showToast('🩹 Self-Healing AST Debugger', d.healResult?.summary || 'Workspace verified');
          }
        }, '🩹 Auto-Heal Code'),
        h('button', {
          className: 'btn btn-sm btn-primary',
          onClick: () => optimizeCompanyPipeline()
        }, '⚡ Auto-Calibrate Tools & Prompts')
      )
    ),

    // MCP Server Bounded-Context Filter Bar + Live Protocol Inspector Buttons
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' } },
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        h('button', {
          className: `btn btn-sm ${selectedMcpServer === 'all' ? 'btn-primary' : 'btn-secondary'}`,
          onClick: () => setSelectedMcpServer('all')
        }, `All MCP Servers (${(tools || []).length})`),
        (mcpServers || []).map((srv) =>
          h('button', {
            key: srv.id,
            className: `btn btn-sm ${selectedMcpServer === srv.id ? 'btn-primary' : 'btn-secondary'}`,
            onClick: () => setSelectedMcpServer(srv.id),
            title: srv.description
          }, `${srv.icon} ${srv.id}`)
        )
      ),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        h('button', { className: 'btn btn-sm btn-outline', onClick: () => queryMcpProtocol('tools/list') }, '📡 MCP tools/list'),
        h('button', { className: 'btn btn-sm btn-outline', onClick: () => queryMcpProtocol('resources/list') }, '📂 MCP resources/list'),
        h('button', { className: 'btn btn-sm btn-outline', onClick: queryA2ACards }, '🤝 Google A2A Cards')
      )
    ),

    // Live Protocol JSON-RPC / A2A Inspector Drawer
    protocolPreview && h('div', {
      style: {
        marginBottom: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#060911',
        border: '1px solid #38bdf8',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.73rem'
      }
    },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
        h('strong', { style: { color: '#38bdf8' } }, `🔍 ${protocolPreview.title}`),
        h('button', { className: 'btn btn-sm btn-secondary', onClick: () => setProtocolPreview(null) }, '✕ Close')
      ),
      h('pre', { style: { margin: 0, maxHeight: '190px', overflowY: 'auto', color: '#e2e8f0' } },
        JSON.stringify(protocolPreview.payload, null, 2)
      )
    ),

    // Tool Catalog Grid
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: '10px', marginBottom: '14px' } },
      filteredTools.map((t) => {
        const runCount = executions.filter((ex) => ex.tool === t.id).length;
        const equippedCount = agents.filter((a) => (a.tools || []).includes(t.id)).length;
        const schemaProps = Object.keys(t.inputSchema?.properties || {}).join(', ') || 'context';
        return h('div', {
          key: t.id,
          style: {
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px'
          }
        },
          h('div', null,
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' } },
              h('strong', { style: { fontSize: '0.8rem', color: 'var(--text-main)' } }, `${t.icon} ${t.name}`),
              h('span', { className: 'task-dept-tag' }, t.mcpServer || t.department)
            ),
            h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.67rem', color: '#38bdf8', marginTop: '4px' } },
              `$ ${t.scriptCommand}`
            ),
            h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: '#a855f7', marginTop: '2px' } },
              `Schema params: { ${schemaProps} }`
            ),
            h('p', { style: { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.4 } }, t.description)
          ),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border)' } },
            h('span', { className: 'sub-hint' }, `Equipped: ${equippedCount} • Runs: ${runCount}`),
            h('button', {
              className: 'btn btn-sm btn-success',
              disabled: runningToolId === t.id,
              onClick: () => runToolNow(t.id)
            }, runningToolId === t.id ? '⏳ Running...' : '▶ Run MCP Tool')
          )
        );
      })
    ),

    // Live Agent Tool-Routing Decision Traces
    h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px', marginBottom: '12px' } },
      h('div', { style: { fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' } },
        '🧠 Live Agent Smart Tool-Routing Decisions (Why Each Agent Picked Its Tools)'
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px' } },
        agents.filter((a) => a.lastToolRouting || a.activeTool).slice(0, 6).map((a) =>
          h('div', {
            key: a.id,
            style: {
              padding: '7px 10px',
              borderRadius: '8px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border)',
              fontSize: '0.72rem'
            }
          },
            h('div', { style: { fontWeight: 700, color: 'var(--text-main)' } },
              `${a.avatar || '🤖'} ${a.name} (${a.department}) • Active Script: ⚙️ ${a.activeTool || 'workspace_coder'}`
            ),
            h('div', { style: { color: 'var(--text-muted)', marginTop: '2px', fontSize: '0.68rem' } },
              a.lastToolRouting || `Equipped with [${(a.tools || []).join(', ')}]`
            )
          )
        )
      )
    ),

    // v11: 2026 ENTERPRISE STANDARDS COMMAND CENTER (OTel GenAI + 4-Tier Knowledge Graph + OWASP ASI + SWE-Bench/GAIA Evals)
    h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '12px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' } },
        h('div', null,
          h('h4', { style: { margin: 0, fontSize: '0.84rem' } },
            `🏛️ 2026 Enterprise Industry Standards Hub (OTel GenAI • Mem0/Zep Knowledge Graph • OWASP ASI • SWE-Bench/GAIA)`
          ),
          h('span', { className: 'sub-hint' },
            `Benchmark Score: ${state.company?.evalBenchmarkScore || 98}/100 • OTel Spans: ${(state.otelSpans || []).length} • Knowledge Graph Triples: ${(state.cognitiveMemory?.knowledgeGraph || []).length}`
          )
        ),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          h('button', {
            className: 'btn btn-sm btn-secondary',
            onClick: async () => {
              const res = await fetch('/api/memory/consolidate', { method: 'POST' });
              const d = await res.json();
              if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
              showToast('🧠 4-Tier Memory Consolidated', `${d.memory?.knowledgeGraph?.length || 0} bi-temporal triples active`);
            }
          }, '🧠 Consolidate Memory ("Reflect")'),
          h('button', {
            className: 'btn btn-sm btn-success',
            onClick: async () => {
              const res = await fetch('/api/evals/run', { method: 'POST' });
              const d = await res.json();
              if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
              if (d.evalResult) {
                setProtocolPreview({
                  title: `🏆 SWE-Bench & GAIA Benchmark Report (${d.evalResult.compositeScore}/100)`,
                  payload: d.evalResult.trials
                });
                showToast(`🏆 SWE-Bench & GAIA Score: ${d.evalResult.compositeScore}/100`, d.evalResult.summary);
              }
            }
          }, '🏆 Run SWE-Bench & GAIA Eval Suite')
        )
      ),

      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '10px' } },
        // Panel 1: OpenTelemetry GenAI Trace Waterfall
        h('div', {
          style: {
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '9px 11px'
          }
        },
          h('div', { style: { fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' } },
            `📊 OpenTelemetry GenAI Spans (gen_ai.*)`
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.67rem' } },
            (state.otelSpans || []).slice(0, 6).map((sp) =>
              h('div', {
                key: sp.spanId,
                style: { padding: '4px 6px', borderRadius: '5px', background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid #38bdf8' }
              },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 700 } },
                  h('span', null, `${sp.attributes?.['gen_ai.operation.name'] || 'span'}: ${sp.name.slice(0, 26)}`),
                  h('span', { style: { color: '#10b981' } }, `${sp.durationMs}ms`)
                ),
                h('div', { style: { color: 'var(--text-muted)', fontSize: '0.63rem' } },
                  `${sp.attributes?.['gen_ai.agent.name']} • in:${sp.attributes?.['gen_ai.usage.input_tokens'] || 0} out:${sp.attributes?.['gen_ai.usage.output_tokens'] || 0}`
                )
              )
            )
          )
        ),

        // Panel 2: 4-Tier Cognitive Memory & Bi-Temporal Knowledge Graph (Mem0 / Zep Graphiti)
        h('div', {
          style: {
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '9px 11px'
          }
        },
          h('div', { style: { fontSize: '0.74rem', fontWeight: 700, color: '#a855f7', marginBottom: '6px' } },
            `🧠 Bi-Temporal Semantic Knowledge Graph`
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.67rem' } },
            (state.cognitiveMemory?.knowledgeGraph || []).slice(0, 6).map((kg) =>
              h('div', {
                key: kg.id,
                style: { padding: '4px 6px', borderRadius: '5px', background: 'rgba(168, 85, 247, 0.08)', borderLeft: '3px solid #a855f7' }
              },
                h('span', { style: { color: '#e2e8f0', fontWeight: 700 } }, kg.subject),
                h('span', { style: { color: '#a855f7' } }, ` ➔ ${kg.predicate} ➔ `),
                h('span', { style: { color: '#10b981', fontWeight: 700 } }, kg.object)
              )
            )
          )
        ),

        // Panel 3: OWASP Agentic Top 10 (ASI01-ASI06) Pre-Action RBAC Firewall
        h('div', {
          style: {
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '9px 11px'
          }
        },
          h('div', { style: { fontSize: '0.74rem', fontWeight: 700, color: '#10b981', marginBottom: '6px' } },
            `🛡️ OWASP Agentic Firewall (ASI01–ASI06)`
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.67rem' } },
            (state.owaspAuditLog || []).length === 0
              ? h('div', { className: 'sub-hint' }, 'All pre-action RBAC & schema guards active (ASI01–ASI06).')
              : (state.owaspAuditLog || []).slice(0, 6).map((ow) =>
                  h('div', {
                    key: ow.id,
                    style: { padding: '4px 6px', borderRadius: '5px', background: 'rgba(16, 185, 129, 0.08)', borderLeft: '3px solid #10b981' }
                  },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 700 } },
                      h('span', null, `[${ow.verdict}] ${ow.mcpServer}::${ow.toolId}`),
                      h('span', { style: { color: '#10b981' } }, 'ASI01-06 ✓')
                    ),
                    h('div', { style: { color: 'var(--text-muted)', fontSize: '0.63rem' } }, ow.reason)
                  )
                )
          )
        )
      )
    )
  );
}

function InteractiveOrgGraphComponent({ state }) {
  const h = React.createElement;
  const agents = state.agents || [];
  const ceo = agents.find((a) => a.id === 'ceo');
  const depts = [
    { id: 'hr', x: 110, label: 'HR' },
    { id: 'cfo', x: 300, label: 'Finance' },
    { id: 'cto', x: 490, label: 'Engineering' },
    { id: 'cmo', x: 680, label: 'Marketing' },
    { id: 'qa', x: 870, label: 'QA' }
  ];

  const nodes = [];
  const edges = [];

  if (ceo) {
    nodes.push({ ...ceo, x: 490, y: 45, nodeType: 'ceo' });
  }

  depts.forEach((d) => {
    const head = agents.find((a) => a.id === d.id);
    if (head) {
      nodes.push({ ...head, x: d.x, y: 155, nodeType: 'c-suite' });
      edges.push({ x1: 490, y1: 75, x2: d.x, y2: 130, color: 'var(--accent)', dashed: false });

      const workers = agents.filter(
        (w) => w.tier === 'worker' && (w.reportsTo === d.id || w.department.toLowerCase() === d.label.toLowerCase())
      );
      workers.forEach((w, idx) => {
        const wy = 275 + idx * 105;
        nodes.push({ ...w, x: d.x, y: wy, nodeType: 'worker' });
        edges.push({ x1: d.x, y1: 185, x2: d.x, y2: wy - 25, color: 'var(--success)', dashed: false });

        (w.subAgents || []).slice(-2).forEach((sub, sIdx) => {
          const sx = d.x + (sIdx === 0 ? -42 : 42);
          const sy = wy + 58;
          nodes.push({
            id: sub.id,
            name: sub.name,
            role: sub.specialty,
            avatar: '🧬',
            kpi: 90,
            status: 'working',
            x: sx,
            y: sy,
            nodeType: 'subagent',
            parentId: w.id
          });
          edges.push({ x1: d.x, y1: wy + 22, x2: sx, y2: sy - 14, color: 'var(--info)', dashed: true });
        });
      });
    }
  });

  return h('div', { className: 'react-graph-canvas' },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.76rem', color: 'var(--text-muted)' } },
      h('span', null, '🕸️ XYFlow / React Interactive Node Topology (Click any node to configure agent)'),
      h('span', null, `Active Nodes: ${nodes.length} • Live Edges: ${edges.length}`)
    ),
    h('svg', { width: '100%', height: '460', viewBox: '0 0 980 450', style: { display: 'block', margin: '0 auto' } },
      edges.map((e, i) => {
        const midY = (e.y1 + e.y2) / 2;
        const dPath = `M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`;
        return h('path', {
          key: `edge-${i}`,
          d: dPath,
          fill: 'none',
          stroke: e.color,
          strokeWidth: e.dashed ? 1.5 : 2.2,
          strokeDasharray: e.dashed ? '4 4' : 'none',
          opacity: 0.75
        });
      }),
      nodes.map((n) => {
        const isSub = n.nodeType === 'subagent';
        const boxW = isSub ? 82 : 158;
        const boxH = isSub ? 32 : 52;
        const strokeColor = n.status === 'working' ? 'var(--success)' : isSub ? 'var(--info)' : 'var(--border)';
        return h('g', {
          key: n.id,
          transform: `translate(${n.x - boxW / 2}, ${n.y - boxH / 2})`,
          style: { cursor: 'pointer' },
          onClick: () => openAgentInspector(isSub ? n.parentId : n.id)
        },
          h('rect', {
            width: boxW,
            height: boxH,
            rx: isSub ? 6 : 9,
            fill: 'var(--bg-card)',
            stroke: strokeColor,
            strokeWidth: n.status === 'working' ? 2.5 : 1.5
          }),
          h('text', {
            x: boxW / 2,
            y: isSub ? 14 : 20,
            textAnchor: 'middle',
            fill: 'var(--text-main)',
            fontSize: isSub ? '9px' : '11px',
            fontWeight: '700'
          }, `${n.avatar || '🤖'} ${n.name.slice(0, isSub ? 12 : 18)}`),
          !isSub && h('text', {
            x: boxW / 2,
            y: 37,
            textAnchor: 'middle',
            fill: 'var(--text-muted)',
            fontSize: '9.5px'
          }, `KPI: ${n.kpi}% • ${n.department}`)
        );
      })
    )
  );
}

function WorkspaceExplorerComponent({ files, wiki }) {
  const h = React.createElement;
  const allItems = [
    ...files.map((f) => ({ ...f, sourceType: 'WORKSPACE FILE' })),
    ...wiki.map((w) => ({
      id: w.id,
      filename: `${w.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}.md`,
      department: w.department,
      author: w.author,
      content: w.content,
      updatedAt: w.createdAt,
      sourceType: w.type || 'WIKI ARTIFACT'
    }))
  ];

  const [selectedId, setSelectedId] = React.useState(allItems[0]?.id || null);
  const [viewMode, setViewMode] = React.useState('preview'); // 'preview' | 'source' | 'edit'
  const [editBuffer, setEditBuffer] = React.useState('');
  const [runResult, setRunResult] = React.useState(null);
  const [isRunningCode, setIsRunningCode] = React.useState(false);
  const previewContainerRef = React.useRef(null);

  const activeFile = allItems.find((x) => x.id === selectedId) || allItems[0];
  const isHtml = activeFile?.filename?.endsWith('.html');
  const isJs = activeFile?.filename?.endsWith('.js');
  const isJson = activeFile?.filename?.endsWith('.json');
  const isSql = activeFile?.filename?.endsWith('.sql');

  React.useEffect(() => {
    setRunResult(null);
    if (activeFile) {
      setEditBuffer(activeFile.content || '');
      if (viewMode === 'edit') setViewMode('preview');
    }
  }, [activeFile?.id]);

  React.useEffect(() => {
    if (previewContainerRef.current && viewMode !== 'edit') {
      triggerSyntaxAndMermaidRender(previewContainerRef.current);
    }
  }, [activeFile?.id, activeFile?.content, viewMode]);

  const downloadFile = (file) => {
    if (!file) return;
    const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename || 'deliverable.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runJsSandbox = async () => {
    if (!activeFile) return;
    setIsRunningCode(true);
    try {
      const res = await fetch('/api/workspace/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: activeFile.filename })
      });
      const data = await res.json();
      setRunResult(data.result);
      if (data.state && window.syncFromExternalState) {
        window.syncFromExternalState(data.state);
      }
      showToast(`▶ Executed ${activeFile.filename}`, data.result?.ok ? `Completed in ${data.result.executionTimeMs}ms` : data.result?.error);
    } catch (e) {
      setRunResult({ ok: false, error: e.message });
    } finally {
      setIsRunningCode(false);
    }
  };

  const saveEditedFile = async () => {
    if (!activeFile) return;
    try {
      const res = await fetch('/api/workspace/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: activeFile.filename, content: editBuffer })
      });
      const data = await res.json();
      if (data.state && window.syncFromExternalState) {
        window.syncFromExternalState(data.state);
      }
      setViewMode('preview');
      showToast(`💾 Saved ${activeFile.filename}`, 'Updated in /workspace');
    } catch (e) {
      console.error('Save workspace file error:', e);
    }
  };

  const langClass = isJs ? 'language-javascript' : isJson ? 'language-json' : isSql ? 'language-sql' : isHtml ? 'language-xml' : '';
  const renderedHtml = activeFile && window.marked && !isJs && !isJson && !isSql && !isHtml
    ? window.marked.parse(activeFile.content || '')
    : `<pre><code class="${langClass}">${escapeHtml(activeFile?.content || '')}</code></pre>`;

  return h('div', null,
    h('div', { className: 'friendly-tip-bar' },
      h('span', null, '📂 Interactive Product Studio & Code Runner: Preview `.html` landing pages live, render Mermaid diagrams, run `.js` services, or auto-heal broken code.'),
      activeFile && h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        isJs && h('button', {
          className: 'btn btn-sm btn-success',
          onClick: runJsSandbox,
          disabled: isRunningCode
        }, isRunningCode ? '⏳ Running...' : '▶ Run JS Module in Sandbox'),
        h('button', {
          className: 'btn btn-sm btn-secondary',
          style: { borderColor: '#06b6d4', color: '#38bdf8' },
          onClick: async () => {
            const res = await fetch('/api/workspace/auto-heal', { method: 'POST' });
            const data = await res.json();
            if (data.healResult) {
              setRunResult({
                ok: true,
                executionTimeMs: 28,
                syntaxCheck: 'SELF-HEALING AST DEBUGGER',
                output: data.healResult
              });
              showToast('🩹 Self-Healing AST Debugger', data.healResult.summary);
            }
            if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
          }
        }, '🩹 Auto-Heal Code'),
        h('button', {
          className: 'btn btn-sm btn-secondary',
          onClick: async () => {
            const res = await fetch('/api/workspace/test-all', { method: 'POST' });
            const data = await res.json();
            if (data.testResult) {
              setRunResult({
                ok: data.testResult.ok,
                executionTimeMs: 42,
                syntaxCheck: 'ALL TEST SUITES',
                output: data.testResult
              });
              showToast('🧪 Unit Test Suite Runner', data.testResult.summary);
            }
            if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
          }
        }, '🧪 Run All Unit Tests'),
        isHtml && h('button', {
          className: `btn btn-sm ${viewMode === 'preview' ? 'btn-primary' : 'btn-secondary'}`,
          onClick: () => setViewMode(viewMode === 'preview' ? 'source' : 'preview')
        }, viewMode === 'preview' ? '💻 View HTML Source' : '🌐 Live Iframe Preview'),
        activeFile.sourceType === 'WORKSPACE FILE' && h('button', {
          className: `btn btn-sm ${viewMode === 'edit' ? 'btn-primary' : 'btn-secondary'}`,
          onClick: () => {
            setEditBuffer(activeFile.content || '');
            setViewMode(viewMode === 'edit' ? 'preview' : 'edit');
          }
        }, viewMode === 'edit' ? '✕ Cancel Edit' : '✏️ Co-Edit File'),
        h('button', {
          className: 'btn btn-sm btn-secondary',
          onClick: () => downloadFile(activeFile)
        }, `⬇️ Download ${activeFile.filename}`),
        h('button', {
          className: 'btn btn-sm btn-primary',
          onClick: () => {
            window.open('/api/workspace/export-app', '_blank');
            setTimeout(() => fetchState(true), 600);
          }
        }, '📦 Export Standalone Runnable App')
      )
    ),
    h('div', { className: 'workspace-ide-grid' },
      h('div', { className: 'workspace-file-list' },
        allItems.map((item) => {
          const icon = item.filename.endsWith('.js') ? '⚡' : item.filename.endsWith('.html') ? '🌐' : item.filename.endsWith('.json') ? '📊' : '📄';
          return h('div', {
            key: item.id,
            className: `workspace-file-item ${activeFile && activeFile.id === item.id ? 'active' : ''}`,
            onClick: () => setSelectedId(item.id)
          },
            h('div', { style: { fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' } }, `${icon} ${item.filename}`),
            h('div', { style: { fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' } }, `${item.department} • ${item.author}`)
          );
        })
      ),
      h('div', { className: 'workspace-editor-pane' },
        activeFile ? h('div', null,
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--border)' } },
            h('div', null,
              h('span', { className: 'task-dept-tag' }, activeFile.sourceType),
              h('strong', { style: { marginLeft: '8px', fontFamily: 'JetBrains Mono, monospace' } }, activeFile.filename)
            ),
            h('span', { className: 'sub-hint' }, `Author: ${activeFile.author}`)
          ),

          // Live JS Execution Output Banner
          runResult && h('div', {
            style: {
              marginBottom: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: `1px solid ${runResult.ok ? '#10b981' : '#ef4444'}`,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.75rem'
            }
          },
            h('div', { style: { fontWeight: 800, color: runResult.ok ? '#10b981' : '#ef4444', marginBottom: '4px' } },
              runResult.ok
                ? `✅ NODE SANDBOX EXECUTION SUCCEEDED (${runResult.executionTimeMs}ms • ${runResult.syntaxCheck})`
                : `❌ SANDBOX EXECUTION ERROR: ${runResult.error}`
            ),
            runResult.output && h('pre', { style: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-main)' } },
              JSON.stringify(runResult.output, null, 2)
            )
          ),

          // Co-Editor Mode
          viewMode === 'edit'
            ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                h('textarea', {
                  value: editBuffer,
                  onChange: (e) => setEditBuffer(e.target.value),
                  style: {
                    width: '100%',
                    minHeight: '340px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.78rem',
                    padding: '12px',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--accent)',
                    borderRadius: '8px'
                  }
                }),
                h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
                  h('button', { className: 'btn btn-sm btn-success', onClick: saveEditedFile }, '💾 Save Changes to /workspace')
                )
              )
            : (isHtml && viewMode === 'preview')
              ? h('iframe', {
                  srcDoc: activeFile.content || '',
                  title: activeFile.filename,
                  style: {
                    width: '100%',
                    height: '390px',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: '#090d16'
                  }
                })
              : h('div', {
                  ref: previewContainerRef,
                  className: 'markdown-rendered-view',
                  dangerouslySetInnerHTML: { __html: renderedHtml }
                })
        ) : h('div', { className: 'sub-hint' }, 'Select a file to inspect.')
      )
    )
  );
}

function CFOAnalyticsComponent({ state }) {
  const h = React.createElement;
  const agents = state.agents || [];
  const company = state.company || {};

  return h('div', { className: 'wiki-card' },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } },
      h('h3', null, '📊 Paperclip Per-Agent Budget Caps & Live MRR Revenue Engine (React Component)'),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 } },
        h('span', { style: { color: '#10b981' } }, `💰 MRR: $${(company.mrr || 0).toLocaleString()}/mo`),
        h('span', { style: { color: '#38bdf8' } }, `👥 Paying Customers: ${company.customersCount || 0}`),
        h('span', { style: { color: '#f59e0b' } }, `♻️ Treasury Reinvested: +$${(company.revenueEarned || 0).toFixed(2)}`)
      )
    ),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' } },
      agents.map((a) => {
        const cap = a.budgetCap || 4.0;
        const spent = a.costSpent || 0;
        const pct = Math.min(100, Math.round((spent / cap) * 100));
        return h('div', {
          key: a.id,
          style: { background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', cursor: 'pointer' },
          onClick: () => openAgentInspector(a.id)
        },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 } },
            h('span', null, `${a.avatar || '🤖'} ${a.name}`),
            h('span', { style: { color: 'var(--success)' } }, `$${spent.toFixed(3)} / $${cap.toFixed(2)}`)
          ),
          h('div', { style: { fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' } },
            `${a.harnessType || 'Hermes Node'} • ${(a.tokensUsed || 0).toLocaleString()} tok`
          ),
          h('div', { className: 'progress-bar-bg', style: { marginTop: '6px' } },
            h('div', { className: 'progress-bar-fill', style: { width: `${pct}%` } })
          )
        );
      })
    )
  );
}

function GitHubEcosystemComponent({ repos, state }) {
  const h = React.createElement;

  const handleImportFile = (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const res = await fetch('/api/company/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        const data = await res.json();
        appState = data.state;
        showToast('📦 Company Pack Imported!', `Loaded ${appState.company.name}`);
        renderAll();
      } catch (err) {
        alert('Invalid Company Pack JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return h('div', null,
    h('div', { className: 'hermes-explainer-card' },
      h('div', null,
        h('h3', null, '🐙 Open-Source GitHub Architecture & Portable Company Packs (`paperclipai/companies`)'),
        h('p', { className: 'sub-hint', style: { marginTop: '4px' } },
          'Export your entire self-taught AI company (including all hired specialists, custom system prompts, learned SOPs, and synthesized SKILL.md modules) as a portable JSON file, or import a company pack!'
        )
      ),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { className: 'btn btn-primary', onClick: exportCompanyPack }, '📦 Export Company Pack (.json)'),
        h('label', { className: 'btn btn-secondary', style: { cursor: 'pointer' } },
          '📥 Import Company Pack',
          h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onChange: handleImportFile })
        )
      )
    ),
    h('h3', { style: { marginBottom: '6px' } }, 'Integrated Open-Source GitHub Repositories Powering AI Company OS'),
    h('div', { className: 'github-repo-grid' },
      (repos || []).map((r) =>
        h('div', { key: r.id, className: 'github-repo-card' },
          h('div', null,
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              h('span', { className: 'task-dept-tag' }, r.status),
              h('a', {
                href: r.url,
                target: '_blank',
                rel: 'noreferrer',
                style: { color: 'var(--info)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none' }
              }, `github.com/${r.repo} ↗`)
            ),
            h('h4', { style: { marginTop: '8px', fontSize: '0.92rem' } }, r.name),
            h('p', { style: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' } }, r.roleInOS)
          ),
          h('div', { style: { fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 } }, '✓ Active in Runtime Pipeline')
        )
      )
    )
  );
}

function exportCompanyPack() {
  window.location.href = '/api/company/export';
  showToast('📦 Exporting Company Pack', 'Downloading portable JSON with all agents, SOPs, and skills.');
}

function changeDesignTheme(themeName) {
  localStorage.setItem('ai_company_theme', themeName);
  document.body.setAttribute('data-theme', themeName);
  document.querySelectorAll('.theme-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.t === themeName);
  });
  fetch('/api/company/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uiTheme: themeName })
  }).catch(() => {});
}

async function changePipelineSpeed(speedMs) {
  const res = await fetch('/api/company/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speedMs: Number(speedMs) })
  });
  const data = await res.json();
  appState = data.state;
  renderAll();
}

async function optimizeCompanyPipeline() {
  const res = await fetch('/api/company/optimize', { method: 'POST' });
  const data = await res.json();
  appState = data.state;
  showToast('⚡ Pipeline Optimized!', 'Pruned duplicate SOPs, compressed prompts, and balanced tasks.');
  renderAll();
}

function renderOrgChart(agents, firedAgents, hireQueue) {
  const banner = document.getElementById('hireQueueBanner');
  if (hireQueue.length > 0) {
    banner.classList.remove('hidden');
    banner.innerHTML = `<strong>📋 HR Pending Hiring Requisitions (${hireQueue.length}):</strong> ` +
      hireQueue.map((r) => `<span style="margin-right:10px;">• <u>${escapeHtml(r.role)}</u> (${escapeHtml(r.department)})</span>`).join('');
  } else {
    banner.classList.add('hidden');
  }

  const ceo = agents.find((a) => a.id === 'ceo');
  const departments = [
    { key: 'HR', headId: 'hr', label: '🤝 People & Evolution (HR)' },
    { key: 'Finance', headId: 'cfo', label: '💎 Finance (CFO)' },
    { key: 'Engineering', headId: 'cto', label: '⚡ Engineering (CTO)' },
    { key: 'Marketing', headId: 'cmo', label: '🚀 Marketing (CMO)' },
    { key: 'QA', headId: 'qa', label: '🛡️ Quality Assurance (QA)' }
  ];

  const container = document.getElementById('orgChartContainer');
  container.innerHTML = `
    <div class="org-ceo-row">
      <div style="width: 350px;">
        ${ceo ? renderAgentCardHTML(ceo) : ''}
      </div>
    </div>
    <div class="org-departments-grid">
      ${departments.map((dept) => {
        const head = agents.find((a) => a.id === dept.headId);
        const workers = agents.filter(
          (a) => a.tier === 'worker' && (a.reportsTo === dept.headId || a.department.toLowerCase() === dept.key.toLowerCase())
        );
        return `
          <div class="dept-column">
            <div class="dept-col-title">${dept.label}</div>
            ${head ? renderAgentCardHTML(head) : ''}
            ${workers.map((w) => renderAgentCardHTML(w)).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;

  const firedContainer = document.getElementById('firedAgentsContainer');
  if (firedAgents.length === 0) {
    firedContainer.innerHTML = `<div class="sub-hint">No agents have been fired yet. Underperforming agents (KPI &lt; 64% or repeated QA failures) are terminated and replaced by HR.</div>`;
  } else {
    firedContainer.innerHTML = firedAgents.map((fa) => `
      <div class="fired-card">
        <div style="display:flex;justify-content:space-between;font-weight:700;">
          <span class="text-danger">✕ ${escapeHtml(fa.name)}</span>
          <span>KPI: ${fa.kpi}%</span>
        </div>
        <div style="font-size:0.74rem;color:var(--text-muted);">${escapeHtml(fa.role)} (${escapeHtml(fa.department)})</div>
        <div style="font-size:0.73rem;color:var(--text-muted);margin-top:5px;">
          <strong>Reason:</strong> ${escapeHtml(fa.firedReason || 'Low QA score')}
        </div>
      </div>
    `).join('');
  }
}

function renderAgentCardHTML(agent) {
  const kpiColor = agent.kpi >= 80 ? 'var(--success)' : agent.kpi >= 65 ? 'var(--warning)' : 'var(--danger)';
  const provBadge = agent.providerOverride && agent.providerOverride !== 'inherit'
    ? `<span class="mini-tool-tag" style="color:var(--info)">🔌 ${escapeHtml(agent.providerOverride)}</span>`
    : '';
  const toolsList = (agent.tools || []).slice(0, 2).map((t) => `<span class="mini-tool-tag">${escapeHtml(t)}</span>`).join('');
  const subs = agent.subAgents || [];

  const subAgentsHTML = subs.length > 0
    ? `<div class="subagent-nest">
        ${subs.slice(-2).map((s) => `
          <div class="subagent-pill" title="${escapeHtml(s.taskFocus)}">
            <span>🧬 ${escapeHtml(s.name)}</span>
            <span style="color:var(--success)">●</span>
          </div>
        `).join('')}
      </div>`
    : '';

  return `
    <div class="agent-card ${agent.tier} ${agent.status}" onclick="openAgentInspector('${agent.id}')">
      <div class="agent-top-row">
        <span class="agent-name">${escapeHtml(agent.avatar || '🤖')} ${escapeHtml(agent.name)}</span>
        <span class="status-pill ${agent.status}">${escapeHtml(agent.status)}</span>
      </div>
      <div class="agent-role">${escapeHtml(agent.role)}</div>
      <div class="agent-live-action">▸ ${escapeHtml(agent.currentAction || 'Standing by')}</div>
      <div class="agent-tools-row">
        ${provBadge}
        ${toolsList}
      </div>
      ${subAgentsHTML}
      <div class="agent-metrics-row">
        <span>KPI: <strong style="color:${kpiColor}">${agent.kpi}%</strong></span>
        <span title="Task Handoffs">⇄ ${(agent.handoffsSent || 0) + (agent.handoffsReceived || 0)}</span>
        <span title="Spawned Sub-Agents">🧬 ${subs.length}</span>
        <span>SOPs: <strong>${agent.sops?.length || 0}</strong></span>
      </div>
      <div class="kpi-mini-bar">
        <div class="kpi-mini-fill" style="width:${agent.kpi}%;background:${kpiColor}"></div>
      </div>
    </div>
  `;
}

function renderMiniConsole(consoleMessages) {
  const dock = document.getElementById('miniConsoleFeed');
  if (!dock) return;
  const recent = (consoleMessages || []).slice(0, 4);
  dock.innerHTML = recent.map((msg) => `
    <div class="console-msg ${escapeHtml(msg.type || 'COLLAB')}">
      <div class="console-msg-header">
        <span class="handoff-route-badge">${escapeHtml(msg.fromName)} ➔ ${escapeHtml(msg.toName)}</span>
        <span>${new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
      <div style="margin-top:3px;">${escapeHtml(msg.message.slice(0, 145))}${msg.message.length > 145 ? '...' : ''}</div>
    </div>
  `).join('');
}

function renderHermesTab(agents, skillsRegistry) {
  const subTree = document.getElementById('subAgentTreeContainer');
  if (subTree) {
    const parentsWithSubs = agents.filter((a) => (a.subAgents || []).length > 0);
    if (parentsWithSubs.length === 0) {
      subTree.innerHTML = `<div class="wiki-card"><div class="sub-hint">No child sub-agents spawned yet. Click "⏭ Next Step" or "🧬 Spawn Custom Sub-Agent" to watch specialist agents decompose work into child micro-agents!</div></div>`;
    } else {
      subTree.innerHTML = parentsWithSubs.map((parent) => `
        <div class="wiki-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(parent.avatar || '🤖')} ${escapeHtml(parent.name)} (${escapeHtml(parent.role)})</strong>
            <span class="task-dept-tag">${escapeHtml(parent.department)}</span>
          </div>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
            ${(parent.subAgents || []).map((s) => `
              <div class="sop-badge-item" style="margin-bottom:0;">
                <div style="display:flex;justify-content:space-between;">
                  <strong>🧬 ${escapeHtml(s.name)}</strong>
                  <span style="font-size:0.7rem;color:var(--success)">ACTIVE SUB-AGENT</span>
                </div>
                <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;">
                  Specialty: ${escapeHtml(s.specialty)} • Task: ${escapeHtml(s.taskFocus)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  const skillsBox = document.getElementById('skillsRegistryContainer');
  if (skillsBox) {
    skillsBox.innerHTML = (skillsRegistry || []).map((sk) => `
      <div class="wiki-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <div>
            <span class="task-dept-tag">SKILL.md</span>
            <strong style="margin-left:6px;font-family:'JetBrains Mono',monospace;">${escapeHtml(sk.name)}</strong>
          </div>
          <span class="sub-hint">${escapeHtml(sk.department)} • By ${escapeHtml(sk.createdBy)}</span>
        </div>
        <div style="font-size:0.76rem;color:var(--info);margin-top:6px;">
          <strong>Trigger:</strong> ${escapeHtml(sk.trigger)}
        </div>
        <div class="wiki-content-pre" style="margin-top:6px;">${escapeHtml(sk.procedure)}</div>
      </div>
    `).join('');
  }
}

function renderSharedConsole(consoleMessages, agents) {
  const recSelect = document.getElementById('consoleRecipientSelect');
  if (recSelect && document.activeElement !== recSelect) {
    const prevVal = recSelect.value || 'all';
    recSelect.innerHTML = `<option value="all">📡 Broadcast: All Agents (Shared Bus)</option>` +
      agents.map((a) => `<option value="${a.id}" ${a.id === prevVal ? 'selected' : ''}>💬 Direct: ${escapeHtml(a.name)} (${escapeHtml(a.department)})</option>`).join('');
  }

  const term = document.getElementById('consoleTerminal');
  if (!term) return;
  term.innerHTML = (consoleMessages || []).map((msg) => `
    <div class="console-msg ${escapeHtml(msg.type || 'COLLAB')}">
      <div class="console-msg-header">
        <div>
          <span class="handoff-route-badge">${escapeHtml(msg.fromName)} ➔ ${escapeHtml(msg.toName)}</span>
          <span style="margin-left:8px;">[${escapeHtml(msg.taskTitle || 'Shared Mission')}]</span>
        </div>
        <span>${new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
      <div>${escapeHtml(msg.message)}</div>
    </div>
  `).join('');
}

async function sendConsoleCommand() {
  const input = document.getElementById('consoleMessageInput');
  const toAgentId = document.getElementById('consoleRecipientSelect').value;
  const message = input.value.trim();
  if (!message) return;
  input.value = '';

  const res = await fetch('/api/console/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toAgentId, message })
  });
  const data = await res.json();
  appState = data.state;
  renderAll();
}

function renderKanban(tasks) {
  const cols = {
    backlog: tasks.filter((t) => t.status === 'backlog'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    qa_review: tasks.filter((t) => t.status === 'qa_review'),
    completed: tasks.filter((t) => t.status === 'completed')
  };

  document.getElementById('countBacklog').textContent = cols.backlog.length;
  document.getElementById('countInProgress').textContent = cols.in_progress.length;
  document.getElementById('countQaReview').textContent = cols.qa_review.length;
  document.getElementById('countCompleted').textContent = cols.completed.length;

  const renderCard = (t) => {
    const chainCount = (t.handoffChain || []).length;
    const subCount = (t.subAgentTraces || []).length;
    const routeLabel = `${t.department} ➔ ${t.collaboratorDept || 'Finance'} ➔ QA`;
    return `
      <div class="task-card" onclick="openDeliverableModal('${t.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap;">
          <span class="task-dept-tag">${escapeHtml(routeLabel)}</span>
          ${t.qaScore !== null ? `<span style="font-size:0.72rem;font-weight:700;color:${t.qaScore >= 75 ? 'var(--success)' : 'var(--warning)'}">QA: ${t.qaScore}/100</span>` : ''}
        </div>
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          ${t.assigneeName ? `👤 ${escapeHtml(t.assigneeName)}` : 'Unassigned'}
          ${chainCount > 0 ? ` • ⇄ ${chainCount}` : ''}
          ${subCount > 0 ? ` • 🧬 ${subCount} sub` : ''}
        </div>
      </div>
    `;
  };

  document.getElementById('colBacklog').innerHTML = cols.backlog.map(renderCard).join('') || '<div class="sub-hint">Empty</div>';
  document.getElementById('colInProgress').innerHTML = cols.in_progress.map(renderCard).join('') || '<div class="sub-hint">Empty</div>';
  document.getElementById('colQaReview').innerHTML = cols.qa_review.map(renderCard).join('') || '<div class="sub-hint">Empty</div>';
  document.getElementById('colCompleted').innerHTML = cols.completed.map(renderCard).join('') || '<div class="sub-hint">Empty</div>';
}

function renderFinance(ledger) {
  const deptSpend = {};
  ledger.forEach((tx) => {
    deptSpend[tx.department] = (deptSpend[tx.department] || 0) + tx.cost;
  });

  const deptContainer = document.getElementById('deptSpendContainer');
  const depts = ['Executive', 'Engineering', 'Marketing', 'Finance', 'HR', 'QA'];
  deptContainer.innerHTML = depts.map((d) => `
    <div class="kpi-card">
      <div class="kpi-label">${d} Spend</div>
      <div class="kpi-value" style="font-size:1.2rem;margin-top:4px;">$${(deptSpend[d] || 0).toFixed(3)}</div>
    </div>
  `).join('');

  const tbody = document.getElementById('ledgerTableBody');
  tbody.innerHTML = ledger.slice(0, 60).map((tx) => `
    <tr>
      <td>${new Date(tx.timestamp).toLocaleTimeString()}</td>
      <td><strong>${escapeHtml(tx.agentName)}</strong></td>
      <td>${escapeHtml(tx.department)}</td>
      <td>${escapeHtml(tx.action)}</td>
      <td><span class="preset-pill">${escapeHtml(tx.provider)} / ${escapeHtml(tx.model)}</span></td>
      <td>${tx.tokens.toLocaleString()}</td>
      <td class="text-success">$${tx.cost.toFixed(4)}</td>
    </tr>
  `).join('');
}

function renderEvents(events) {
  const container = document.getElementById('eventFeed');
  container.innerHTML = (events || []).slice(0, 50).map((ev) => `
    <div class="event-item ${ev.type}">
      <div class="event-top">
        <span><strong>${escapeHtml(ev.type)}</strong> • ${escapeHtml(ev.actor)}</span>
        <span>${new Date(ev.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="event-title">${escapeHtml(ev.title)}</div>
      <div class="event-detail">${escapeHtml(ev.detail)}</div>
    </div>
  `).join('');
}

// PIPELINE CONTROLS
async function togglePipeline() {
  if (!appState) return;
  const endpoint = appState.company.isRunning ? '/api/pipeline/stop' : '/api/pipeline/start';
  const res = await fetch(endpoint, { method: 'POST' });
  const data = await res.json();
  appState = data.state;
  renderAll();
}

async function stepPipeline() {
  const btn = document.getElementById('btnStep');
  btn.disabled = true;
  btn.textContent = '⏳ Running...';
  try {
    const res = await fetch('/api/pipeline/step', { method: 'POST' });
    const data = await res.json();
    appState = data.state;
    renderAll();
  } finally {
    btn.disabled = false;
    btn.textContent = '⏭ Next Step';
  }
}

// TABS
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach((c) => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });
  renderReactComponents();
}

// MODALS
function openModal(id) {
  if (id === 'companyModal') populateCompanyModal();
  if (id === 'providerModal') populateProviderModal();
  if (id === 'handoffModal') populateHandoffModal();
  if (id === 'subAgentModal') populateSubAgentModal();
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function populateSubAgentModal() {
  const sel = document.getElementById('selectParentAgent');
  sel.innerHTML = appState.agents.map((a) => `
    <option value="${a.id}">${escapeHtml(a.avatar || '🤖')} ${escapeHtml(a.name)} — ${escapeHtml(a.role)} (${escapeHtml(a.department)})</option>
  `).join('');
}

async function submitSpawnSubAgent() {
  const parentAgentId = document.getElementById('selectParentAgent').value;
  const specialty = document.getElementById('inputSubSpecialty').value.trim() || 'Task Decomposition Micro-Agent';
  const taskFocus = document.getElementById('inputSubFocus').value.trim() || 'Parallel subtask verification';
  const promoteToFullHire = document.getElementById('checkPromoteSub').checked;

  const res = await fetch('/api/agents/spawn-subagent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentAgentId, name: specialty, specialty, taskFocus, promoteToFullHire })
  });
  const data = await res.json();
  appState = data.state;
  document.getElementById('inputSubSpecialty').value = '';
  document.getElementById('inputSubFocus').value = '';
  document.getElementById('checkPromoteSub').checked = false;
  closeModal('subAgentModal');
  showToast(`🧬 Spawned Sub-Agent: ${specialty}`, taskFocus);
  renderAll();
}

function populateHandoffModal() {
  const taskSel = document.getElementById('selectHandoffTask');
  const agentSel = document.getElementById('selectHandoffAgent');
  taskSel.innerHTML = appState.tasks.map((t) => `
    <option value="${t.id}">[${escapeHtml(t.status.toUpperCase())}] ${escapeHtml(t.title)} (${escapeHtml(t.assigneeName || t.department)})</option>
  `).join('');
  agentSel.innerHTML = appState.agents.map((a) => `
    <option value="${a.id}">${escapeHtml(a.name)} — ${escapeHtml(a.role)} (${escapeHtml(a.department)})</option>
  `).join('');
}

async function submitManualHandoff() {
  const taskId = document.getElementById('selectHandoffTask').value;
  const toAgentId = document.getElementById('selectHandoffAgent').value;
  const note = document.getElementById('inputHandoffNote').value.trim();
  if (!taskId || !toAgentId) return;

  const res = await fetch('/api/tasks/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, toAgentId, note })
  });
  const data = await res.json();
  appState = data.state;
  document.getElementById('inputHandoffNote').value = '';
  closeModal('handoffModal');
  renderAll();
}

function populateCompanyModal() {
  document.getElementById('inputCompanyName').value = appState.company.name;
  document.getElementById('inputCompanyTheme').value = appState.company.theme;
  document.getElementById('inputCompanyGoal').value = appState.company.goal;
  document.getElementById('inputCompanyBudget').value = appState.company.budgetTotal;

  const tplContainer = document.getElementById('templateButtons');
  tplContainer.innerHTML = companyTemplates.map((t) => `
    <button class="template-btn" onclick="selectTemplate('${t.id}')">
      <div style="font-weight:700;color:var(--text-main);">${escapeHtml(t.name)}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);">${escapeHtml(t.theme)}</div>
    </button>
  `).join('');
}

function selectTemplate(tplId) {
  const tpl = companyTemplates.find((t) => t.id === tplId);
  if (!tpl) return;
  document.getElementById('inputCompanyName').value = tpl.name;
  document.getElementById('inputCompanyTheme').value = tpl.theme;
  document.getElementById('inputCompanyGoal').value = tpl.goal;
  document.getElementById('inputCompanyBudget').value = tpl.budget;
}

async function submitCompanyInit() {
  const payload = {
    name: document.getElementById('inputCompanyName').value.trim(),
    theme: document.getElementById('inputCompanyTheme').value.trim(),
    goal: document.getElementById('inputCompanyGoal').value.trim(),
    budget: Number(document.getElementById('inputCompanyBudget').value) || 25
  };
  const res = await fetch('/api/company/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  appState = data.state;
  closeModal('companyModal');
  showToast(`🚀 Initialized ${payload.name}`, payload.goal);
  renderAll();
}

// PROVIDER MODAL
function populateProviderModal() {
  const sel = document.getElementById('selectActiveProvider');
  const active = appState.providerConfig.activeProvider;
  sel.innerHTML = Object.entries(providersCatalog).map(([key, info]) => `
    <option value="${key}" ${key === active ? 'selected' : ''}>${info.name}</option>
  `).join('');
  onProviderSelectChange();
}

function onProviderSelectChange() {
  const key = document.getElementById('selectActiveProvider').value;
  const catalogInfo = providersCatalog[key] || {};
  const saved = appState.providerConfig.providers?.[key] || {};

  document.getElementById('inputProviderModel').value = saved.model || catalogInfo.defaultModel || '';
  document.getElementById('inputProviderKey').value = saved.apiKey || '';
  document.getElementById('inputProviderUrl').value = saved.baseUrl || catalogInfo.endpoint || '';

  const pills = document.getElementById('modelPresetPills');
  pills.innerHTML = (catalogInfo.models || []).map((m) => `
    <span class="preset-pill" onclick="document.getElementById('inputProviderModel').value='${m}'">${m}</span>
  `).join('');

  const rec = document.getElementById('providerRecommendation');
  if (rec) {
    rec.innerHTML = catalogInfo.recommendation
      ? `💡 ${escapeHtml(catalogInfo.recommendation)}${catalogInfo.signupUrl ? ` — <a href="${catalogInfo.signupUrl}" target="_blank" rel="noopener">Get key / install ↗</a>` : ''}`
      : '';
  }
  const out = document.getElementById('providerTestResult');
  if (out) out.innerHTML = '';
}

async function testProviderConnection() {
  const out = document.getElementById('providerTestResult');
  out.innerHTML = '<span style="color:#f59e0b">⏳ Testing connection...</span>';
  const res = await fetch('/api/providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerKey: document.getElementById('selectActiveProvider').value,
      model: document.getElementById('inputProviderModel').value.trim(),
      apiKey: document.getElementById('inputProviderKey').value.trim(),
      baseUrl: document.getElementById('inputProviderUrl').value.trim()
    })
  });
  const { result } = await res.json();
  out.innerHTML = result.ok
    ? `<span style="color:#10b981">✅ Connected to ${escapeHtml(result.model)} in ${result.latencyMs}ms — reply: "${escapeHtml(result.reply || '')}"</span>`
    : `<span style="color:#ef4444">❌ ${escapeHtml(result.error || 'Connection failed')}</span>`;
}

async function saveProviderConfig() {
  const key = document.getElementById('selectActiveProvider').value;
  const payload = {
    activeProvider: key,
    providers: {
      [key]: {
        model: document.getElementById('inputProviderModel').value.trim(),
        apiKey: document.getElementById('inputProviderKey').value.trim(),
        baseUrl: document.getElementById('inputProviderUrl').value.trim()
      }
    }
  };
  const res = await fetch('/api/providers/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  appState = data.state;
  closeModal('providerModal');
  renderAll();
}

// DEEP AGENT INSPECTOR & CONFIGURATION MODAL
function openAgentInspector(agentId) {
  const agent = appState.agents.find((a) => a.id === agentId);
  if (!agent) return;

  document.getElementById('inspectAgentTitle').textContent = `${agent.avatar || '🤖'} ${agent.name} — ${agent.role}`;
  const body = document.getElementById('inspectAgentBody');

  const providerOptions = [`<option value="inherit" ${(!agent.providerOverride || agent.providerOverride === 'inherit') ? 'selected' : ''}>Inherit Company Default</option>`]
    .concat(Object.entries(providersCatalog).map(([k, v]) => `
      <option value="${k}" ${agent.providerOverride === k ? 'selected' : ''}>${escapeHtml(v.name)}</option>
    `)).join('');

  const subsHTML = (agent.subAgents || []).length > 0
    ? (agent.subAgents || []).map((s) => `
        <div class="sop-badge-item">
          <strong>🧬 ${escapeHtml(s.name)}</strong> (${escapeHtml(s.specialty)}) — ${escapeHtml(s.taskFocus)}
        </div>
      `).join('')
    : '<div class="sub-hint">No active child sub-agents attached yet.</div>';

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <div>
        <span class="task-dept-tag">${escapeHtml(agent.department)}</span>
        <span style="margin-left:8px;font-size:0.82rem;">
          KPI: <strong>${agent.kpi}%</strong> •
          Completed: <strong>${agent.tasksCompleted}</strong> •
          Handoffs: <strong>${(agent.handoffsSent || 0) + (agent.handoffsReceived || 0)}</strong> •
          Sub-Agents: <strong>${(agent.subAgents || []).length}</strong> •
          Spend: <strong>$${(agent.costSpent || 0).toFixed(4)} / $${(agent.budgetCap || 4).toFixed(2)}</strong>
        </span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" onclick="quickSpawnSubForAgent('${agent.id}')">🧬 + Spawn Sub-Agent</button>
        <button class="btn btn-sm btn-secondary" onclick="adjustAgentKpi('${agent.id}', 5)">⭐ Reward (+5 KPI)</button>
        <button class="btn btn-sm btn-secondary" onclick="cloneAgentFromModal('${agent.id}')">📋 Clone Agent</button>
        ${agent.tier === 'worker' ? `
          <button class="btn btn-sm btn-danger" onclick="fireAgentFromModal('${agent.id}')">🔥 Fire & Replace</button>
        ` : ''}
      </div>
    </div>

    <!-- DIRECT EXECUTIVE HOTLINE TERMINAL -->
    <div class="agent-hotline-box" style="margin-bottom:14px;background:#060a12;border:1px solid rgba(56,189,248,0.35);border-radius:8px;padding:12px;box-shadow:inset 0 0 16px rgba(56,189,248,0.06);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:700;color:#38bdf8;font-size:0.84rem;display:flex;align-items:center;gap:6px;">
          <span>🎙️ Direct Executive Hotline: ${escapeHtml(agent.name)}</span>
          <span class="preset-pill" style="font-size:0.65rem;border-color:#10b981;color:#10b981;">CONNECTED</span>
        </div>
        <span class="sub-hint">Issue direct executive orders to ${escapeHtml(agent.role)}</span>
      </div>
      <div id="hotlineReplyArea" style="max-height:160px;overflow-y:auto;background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.18);border-radius:6px;padding:10px;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#e2e8f0;margin-bottom:8px;min-height:48px;">
        ${agent.currentAction ? `<div>[STATUS]: <strong>${escapeHtml(agent.status.toUpperCase())}</strong> • ${escapeHtml(agent.currentAction)}</div>` : '<div>Ready for direct executive orders. Type below or pick a directive chip.</div>'}
      </div>
      <div style="display:flex;gap:6px;">
        <input id="inputHotlinePrompt" type="text" class="form-input" style="font-size:0.8rem;" placeholder="e.g. Audit event bus / Refine pricing / Propose GTM growth loop..." onkeydown="if(event.key==='Enter') sendHotlineOrder('${agent.id}')" />
        <button class="btn btn-sm btn-primary" onclick="sendHotlineOrder('${agent.id}')">🚀 Send Order</button>
      </div>
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" class="theme-chip" style="font-size:0.68rem;" onclick="setHotlineQuickPrompt('Give me your top 3 priority deliverables for our product')">⚡ Top Priorities</button>
        <button type="button" class="theme-chip" style="font-size:0.68rem;" onclick="setHotlineQuickPrompt('Review workspace files and suggest a high-impact optimization')">🔍 Audit Code</button>
        <button type="button" class="theme-chip" style="font-size:0.68rem;" onclick="setHotlineQuickPrompt('Propose a cross-department handoff with your collaborator')">⇄ Plan Handoff</button>
        <button type="button" class="theme-chip" style="font-size:0.68rem;" onclick="setHotlineQuickPrompt('Draft a competitive differentiation strategy against rival startups')">🏆 Rival Strategy</button>
      </div>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="field-label">Dedicated LLM Provider Override</label>
        <select id="editAgentProvider" class="form-input">${providerOptions}</select>
      </div>
      <div class="form-group">
        <label class="field-label">Specific Model Override (Optional)</label>
        <input id="editAgentModel" type="text" class="form-input" value="${escapeHtml(agent.modelOverride || '')}" placeholder="e.g. claude-3-7-sonnet-latest / gpt-4o" />
      </div>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="field-label">Temperature / Creativity (0.0 - 1.2)</label>
        <input id="editAgentTemp" type="number" step="0.1" min="0" max="1.2" class="form-input" value="${agent.temperature ?? 0.6}" />
      </div>
      <div class="form-group">
        <label class="field-label">Paperclip Per-Agent Budget Cap ($ USD)</label>
        <input id="editAgentBudgetCap" type="number" step="0.5" min="0.5" class="form-input" value="${agent.budgetCap ?? 4.0}" />
      </div>
    </div>

    <div class="form-group">
      <label class="field-label">🛠️ Equipped Specialist Tools &amp; Scripts (Click any chip to toggle or edit below)</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
        ${(toolRegistry || []).map((t) => {
          const has = (agent.tools || []).includes(t.id);
          return `<button type="button" class="btn btn-sm ${has ? 'btn-primary' : 'btn-secondary'}" onclick="toggleAgentToolInput('${t.id}')">${escapeHtml(t.icon)} ${escapeHtml(t.id)}</button>`;
        }).join('')}
      </div>
      <input id="editAgentTools" type="text" class="form-input" value="${escapeHtml((agent.tools || []).join(', '))}" />
      ${agent.lastToolRouting ? `<div class="sub-hint" style="margin-top:4px;color:#38bdf8;">🧠 ${escapeHtml(agent.lastToolRouting)}</div>` : ''}
    </div>

    <div class="form-group">
      <label class="field-label">Editable Agent System Prompt</label>
      <textarea id="editAgentPrompt" rows="3" class="form-input">${escapeHtml(agent.systemPrompt)}</textarea>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button class="btn btn-primary btn-sm" onclick="saveAgentConfigFromModal('${agent.id}')">💾 Save Agent Brain & Budget Cap</button>
    </div>

    <div class="form-group">
      <label class="field-label">🧬 Attached Hermes Child Sub-Agents (${(agent.subAgents || []).length})</label>
      ${subsHTML}
    </div>

    <div class="form-group">
      <label class="field-label">Learned SOPs & Self-Taught Memory (${agent.sops?.length || 0})</label>
      ${(agent.sops || []).map((s) => `<div class="sop-badge-item">✓ ${escapeHtml(s)}</div>`).join('')}
    </div>

    <div class="form-group" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <label class="field-label">🧠 Teach / Inject New SOP into ${escapeHtml(agent.name)}</label>
      <div style="display:flex;gap:8px;">
        <input id="inputManualSop" type="text" class="form-input" placeholder="e.g. Always pass unit cost tables to CFO before QA review..." />
        <button class="btn btn-primary" onclick="trainAgentFromModal('${agent.id}')">Teach Agent</button>
      </div>
    </div>
  `;
  openModal('agentModal');
}

window.setHotlineQuickPrompt = function(text) {
  const input = document.getElementById('inputHotlinePrompt');
  if (input) {
    input.value = text;
    input.focus();
  }
};

window.sendHotlineOrder = async function(agentId) {
  const input = document.getElementById('inputHotlinePrompt');
  const replyArea = document.getElementById('hotlineReplyArea');
  if (!input || !replyArea) return;
  const message = input.value.trim();
  if (!message) return;
  input.value = '';

  const agent = (appState?.agents || []).find((a) => a.id === agentId);
  const agentName = agent ? agent.name : 'Agent';

  replyArea.innerHTML += `
    <div style="margin-top:6px;color:#38bdf8;border-left:2px solid #38bdf8;padding-left:6px;">
      <strong>👤 Founder Order:</strong> ${escapeHtml(message)}
    </div>
    <div id="hotlinePending" style="margin-top:4px;color:#94a3b8;font-style:italic;">
      ⚡ ${escapeHtml(agentName)} is analyzing and executing directive...
    </div>
  `;
  replyArea.scrollTop = replyArea.scrollHeight;

  try {
    const res = await fetch('/api/console/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toAgentId: agentId, message })
    });
    const data = await res.json();
    if (data.state && window.syncFromExternalState) {
      window.syncFromExternalState(data.state);
    }
    const pendingEl = document.getElementById('hotlinePending');
    if (pendingEl) pendingEl.remove();

    const latestMsg = data.state?.consoleMessages?.[0];
    const replyText = latestMsg && latestMsg.fromId === agentId ? latestMsg.message : (latestMsg?.message || 'Directive acknowledged and logged to mission ledger.');

    replyArea.innerHTML += `
      <div style="margin-top:6px;color:#34d399;border-left:2px solid #10b981;padding-left:6px;">
        <strong>🤖 ${escapeHtml(agentName)}:</strong> ${escapeHtml(replyText)}
      </div>
    `;
    replyArea.scrollTop = replyArea.scrollHeight;

    if (window.playOfficeSound) window.playOfficeSound('handoff');
    showToast(`💬 Reply from ${agentName}`, replyText.slice(0, 90));
  } catch (err) {
    const pendingEl = document.getElementById('hotlinePending');
    if (pendingEl) pendingEl.textContent = `⚠️ Error: ${err.message}`;
  }
};

async function quickSpawnSubForAgent(agentId) {
  const res = await fetch('/api/agents/spawn-subagent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentAgentId: agentId,
      specialty: 'Autonomous Helper Sub-Agent',
      taskFocus: 'Parallel task verification & context research'
    })
  });
  const data = await res.json();
  appState = data.state;
  renderAll();
  openAgentInspector(agentId);
}

function toggleAgentToolInput(toolId) {
  const input = document.getElementById('editAgentTools');
  if (!input) return;
  const current = input.value.split(',').map((s) => s.trim()).filter(Boolean);
  const idx = current.indexOf(toolId);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(toolId);
  input.value = current.join(', ');
}

async function saveAgentConfigFromModal(agentId) {
  const providerOverride = document.getElementById('editAgentProvider').value;
  const modelOverride = document.getElementById('editAgentModel').value.trim();
  const temperature = Number(document.getElementById('editAgentTemp').value);
  const budgetCap = Number(document.getElementById('editAgentBudgetCap').value);
  const tools = document.getElementById('editAgentTools').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const systemPrompt = document.getElementById('editAgentPrompt').value.trim();

  const res = await fetch('/api/agents/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      updates: { providerOverride, modelOverride, temperature, budgetCap, tools, systemPrompt }
    })
  });
  const data = await res.json();
  appState = data.state;
  renderAll();
  closeModal('agentModal');
}

async function adjustAgentKpi(agentId, kpiDelta) {
  const res = await fetch('/api/agents/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, updates: { kpiDelta } })
  });
  const data = await res.json();
  appState = data.state;
  renderAll();
  openAgentInspector(agentId);
}

async function cloneAgentFromModal(agentId) {
  const res = await fetch('/api/agents/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId })
  });
  const data = await res.json();
  appState = data.state;
  closeModal('agentModal');
  renderAll();
}

async function trainAgentFromModal(agentId) {
  const sop = document.getElementById('inputManualSop').value.trim();
  if (!sop) return;
  const res = await fetch('/api/agents/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, sop })
  });
  const data = await res.json();
  appState = data.state;
  renderAll();
  openAgentInspector(agentId);
}

async function fireAgentFromModal(agentId) {
  const res = await fetch('/api/agents/fire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, reason: 'Terminated via Executive Performance Review; replaced with Senior Specialist.' })
  });
  const data = await res.json();
  appState = data.state;
  closeModal('agentModal');
  renderAll();
}

// MANUAL HIRE & TASK
async function submitManualHire() {
  const role = document.getElementById('inputHireRole').value.trim();
  const department = document.getElementById('inputHireDept').value;
  const providerOverride = document.getElementById('inputHireProvider').value;
  const harnessType = document.getElementById('inputHireHarness')?.value || 'Hermes Specialist Node';
  const tools = document.getElementById('inputHireTools').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const reason = document.getElementById('inputHireReason').value.trim();
  if (!role) return;

  const res = await fetch('/api/agents/hire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, department, providerOverride, harnessType, tools, reason })
  });
  const data = await res.json();
  appState = data.state;
  document.getElementById('inputHireRole').value = '';
  document.getElementById('inputHireReason').value = '';
  closeModal('hireModal');
  renderAll();
}

async function submitManualTask() {
  const title = document.getElementById('inputTaskTitle').value.trim();
  const department = document.getElementById('inputTaskDept').value;
  const collaboratorDept = document.getElementById('inputTaskCollabDept').value;
  const description = document.getElementById('inputTaskDesc').value.trim();
  if (!title) return;

  const res = await fetch('/api/tasks/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, department, collaboratorDept, priority: 'High', description })
  });
  const data = await res.json();
  appState = data.state;
  document.getElementById('inputTaskTitle').value = '';
  document.getElementById('inputTaskDesc').value = '';
  closeModal('taskModal');
  renderAll();
}

function openDeliverableModal(taskId) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  document.getElementById('deliverableModalTitle').textContent = task.title;

  const subTracesHTML = (task.subAgentTraces || []).length > 0
    ? `<div style="margin-bottom:10px;">
        <label class="field-label">🧬 Hermes Sub-Agent Decomposition Traces (${task.subAgentTraces.length})</label>
        ${task.subAgentTraces.map((st) => `
          <div class="sop-badge-item">
            <strong>${escapeHtml(st.subAgentName)}</strong> (spawned by ${escapeHtml(st.parentAgentName)}): ${escapeHtml(st.focus)}
          </div>
        `).join('')}
      </div>`
    : '';

  const handoffHTML = (task.handoffChain || []).length > 0
    ? `<div style="margin-bottom:12px;">
        <label class="field-label">⇄ Multi-Agent Handoff Chain (${task.handoffChain.length})</label>
        ${task.handoffChain.map((h) => `
          <div class="sop-badge-item">
            <strong>${escapeHtml(h.fromName)} (${escapeHtml(h.fromDept)}) ➔ ${escapeHtml(h.toName)} (${escapeHtml(h.toDept)}):</strong>
            ${escapeHtml(h.note)}
          </div>
        `).join('')}
      </div>`
    : '';

  const renderedMd = task.deliverable && window.marked
    ? window.marked.parse(task.deliverable)
    : escapeHtml(task.deliverable || 'Task has not produced a deliverable yet. Click "⏭ Next Step" or start the pipeline to execute.');

  document.getElementById('deliverableModalBody').innerHTML = `
    <div style="margin-bottom:12px;font-size:0.82rem;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>
        Route: <strong>${escapeHtml(task.department)} ➔ ${escapeHtml(task.collaboratorDept || 'Finance')} ➔ QA</strong> •
        Status: <strong>${escapeHtml(task.status.toUpperCase())}</strong> •
        Current Owner: <strong>${escapeHtml(task.assigneeName || 'Unassigned')}</strong>
        ${task.qaScore !== null ? ` • QA Score: <strong>${task.qaScore}/100</strong>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" style="border-color:#10b981;color:#10b981;" onclick="closeModal('deliverableModal'); openDiffApprovalModal('${task.id}')">✋ Inspect Diff &amp; HITL Gate</button>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('deliverableModal'); openModal('handoffModal');">⇄ Pass Task to Another Agent</button>
      </div>
    </div>
    ${subTracesHTML}
    ${handoffHTML}
    ${task.qaFeedback ? `<div class="sop-badge-item">🔍 <strong>QA Audit Feedback:</strong> ${escapeHtml(task.qaFeedback)}</div>` : ''}
    <div id="deliverableRenderedPane" class="workspace-editor-pane markdown-rendered-view" style="max-height:380px;">${renderedMd}</div>
  `;
  openModal('deliverableModal');
  setTimeout(() => {
    triggerSyntaxAndMermaidRender(document.getElementById('deliverableRenderedPane'));
  }, 50);
}

async function submitCreateCustomMcpTool() {
  const id = document.getElementById('inputCustomToolId')?.value.trim();
  const name = document.getElementById('inputCustomToolName')?.value.trim();
  const department = document.getElementById('inputCustomToolDept')?.value || 'Engineering';
  const mcpServer = document.getElementById('inputCustomToolMcp')?.value || 'mcp-filesystem';
  const intentKeywords = document.getElementById('inputCustomToolKeywords')?.value || '';
  const description = document.getElementById('inputCustomToolDesc')?.value.trim();
  const jsSnippet = document.getElementById('inputCustomToolCode')?.value || '';

  const res = await fetch('/api/tools/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, icon: '🔌', department, mcpServer, intentKeywords, description, jsSnippet })
  });
  const data = await res.json();
  if (data.toolRegistry) toolRegistry = data.toolRegistry;
  if (data.mcpServers) mcpServersCatalog = data.mcpServers;
  if (data.state) appState = data.state;
  closeModal('customToolModal');
  showToast(`🔌 Registered Custom MCP Tool`, `${data.result?.tool?.name || id} mounted on ${mcpServer}`);
  renderAll();
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Expose external state sync for React Virtual Office (Drag-and-Drop & Board Inbox)
window.syncFromExternalState = (newState) => {
  if (!newState) return;
  const newestEvt = newState.events?.[0];
  if (newestEvt && lastSeenEventId && newestEvt.id !== lastSeenEventId) {
    showToast(`${newestEvt.type}: ${newestEvt.title}`, newestEvt.detail);
  }
  if (newestEvt) lastSeenEventId = newestEvt.id;
  appState = newState;
  renderAll();
};

// Connect Real-Time Server-Sent Events (SSE) stream + fallback poll
function connectRealTimeStream() {
  if (typeof EventSource === 'undefined') return;
  try {
    const es = new EventSource('/api/stream');
    es.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed && parsed.state) {
          window.syncFromExternalState(parsed.state);
        }
      } catch {}
    };
  } catch (e) {
    console.warn('SSE fallback to polling:', e);
  }
}

// ============================================================================
// v12: CTRL+K OMNI-PALETTE, VISUAL KNOWLEDGE GRAPH & HITL DIFF APPROVAL
// ============================================================================

let omniSelectedIndex = 0;
let activeOmniItems = [];
let activeDiffTaskId = null;

const STATIC_OMNI_ACTIONS = [
  // Pipeline & Execution
  { category: '⚡ Pipeline & Execution', id: 'step_pipeline', icon: '⏭', title: 'Next Pipeline Step', subtitle: 'Execute 1 single cycle of the autonomous company', shortcut: 'Space' },
  { category: '⚡ Pipeline & Execution', id: 'toggle_loop', icon: '▶', title: 'Toggle Auto-Pilot Pipeline', subtitle: 'Start or pause autonomous background cycles' },
  { category: '⚡ Pipeline & Execution', id: 'optimize_pipeline', icon: '⚡', title: 'Optimize Pipeline & Tools', subtitle: 'Auto-calibrate agent tools, deduplicate SOPs & compress prompts' },
  { category: '⚡ Pipeline & Execution', id: 'auto_heal_code', icon: '🩹', title: 'Run Self-Healing AST Debugger', subtitle: 'Scan & auto-repair any broken syntax or failing tests in /workspace' },
  { category: '⚡ Pipeline & Execution', id: 'test_all_suites', icon: '🧪', title: 'Run All Unit Tests', subtitle: 'Execute node:assert suites across all microservices' },

  // Executive & Governance
  { category: '🎙️ Executive & Governance', id: 'war_room', icon: '🎙️', title: 'C-Suite War Room Standup', subtitle: 'Debate high-priority strategy & queue board proposal', shortcut: 'W' },
  { category: '🎙️ Executive & Governance', id: 'red_team', icon: '🧨', title: 'Red Team Security & Chaos Audit', subtitle: 'Probe /workspace files, inject rate limits & sanitizers', shortcut: 'R' },
  { category: '🎙️ Executive & Governance', id: 'poach_talent', icon: '🎯', title: 'Poach Rival Top Star', subtitle: 'Poach elite 95% KPI talent from competitors for +4.5% market share', shortcut: 'P' },
  { category: '🎙️ Executive & Governance', id: 'run_evals', icon: '🏆', title: 'Run SWE-Bench & GAIA Evals', subtitle: '5-trial benchmark grading code, self-healing, SQL & FinOps' },

  // Product & Revenue
  { category: '🌐 Product & Revenue', id: 'toggle_product_split', icon: '🌐', title: 'Toggle Live Product Runtime Split', subtitle: 'Inspect /live-product landing page & real-time API endpoints' },
  { category: '🌐 Product & Revenue', id: 'simulate_traffic', icon: '📈', title: 'Simulate Customer Traffic Swarm', subtitle: 'Fire +250 live HTTP requests & convert paying MRR customers' },
  { category: '🌐 Product & Revenue', id: 'dspy_tournament', icon: '🧬', title: 'Run DSPy Prompt Tournament', subtitle: 'Compile A/B BootstrapFewShot prompt signatures for agents' },
  { category: '🌐 Product & Revenue', id: 'export_app', icon: '📦', title: 'Export Standalone Product App', subtitle: 'Bundle /workspace into runnable launch-company-product.js' },

  // Memory & Protocols
  { category: '🧠 Memory & Protocols', id: 'open_kg_modal', icon: '🧠', title: 'Open Visual Knowledge Graph', subtitle: 'Interactive SVG canvas mapping bi-temporal entities & schemas' },
  { category: '🧠 Memory & Protocols', id: 'consolidate_memory', icon: '🔄', title: 'Consolidate Cognitive Memory ("Reflect")', subtitle: 'Distill episodic event logs into semantic triples' },
  { category: '🧠 Memory & Protocols', id: 'test_provider_conn', icon: '🔌', title: 'Test LLM Provider Connection', subtitle: 'Send a live verification ping to Ollama, Gemini, or Groq' },
  { category: '🧠 Memory & Protocols', id: 'new_custom_mcp', icon: '🛠️', title: 'Register Custom MCP Tool', subtitle: 'Create and mount a new Node VM tool script' },

  // Checkpoints & Shift Modes
  { category: '💾 Checkpoints & Shifts', id: 'create_checkpoint', icon: '💾', title: 'Save Snapshot Checkpoint', subtitle: 'Capture full state snapshot of company' },
  { category: '💾 Checkpoints & Shifts', id: 'restore_checkpoint', icon: '⏪', title: 'Restore Latest Checkpoint', subtitle: 'Roll back company to previous snapshot' },
  { category: '💾 Checkpoints & Shifts', id: 'shift_crunch', icon: '🚨', title: 'Shift Mode: Crunch Mode', subtitle: '2.3x turbo velocity pipeline (950ms)' },
  { category: '💾 Checkpoints & Shifts', id: 'shift_day', icon: '☀️', title: 'Shift Mode: Day Shift', subtitle: 'Standard balanced speed (2.2s)' },

  // Navigation
  { category: '🏢 Navigation Tabs', id: 'tab_org', icon: '🏢', title: 'Go to Virtual Office & Org Chart', subtitle: '2.5D animated office floorplan' },
  { category: '🏢 Navigation Tabs', id: 'tab_workspace', icon: '📂', title: 'Go to Workspace Code Explorer', subtitle: 'Artifacts, live preview & code sandbox' },
  { category: '🏢 Navigation Tabs', id: 'tab_hermes', icon: '🛠️', title: 'Go to Tools, Sub-Agents & Skills', subtitle: 'MCP Hub & Smart Tool Router' },
  { category: '🏢 Navigation Tabs', id: 'tab_console', icon: '💬', title: 'Go to Shared Mission Console', subtitle: 'Inter-agent handoff bus' },
  { category: '🏢 Navigation Tabs', id: 'tab_kanban', icon: '📋', title: 'Go to Kanban Board', subtitle: 'Backlog, In Progress, QA Gate, Completed' },
  { category: '🏢 Navigation Tabs', id: 'tab_finance', icon: '📊', title: 'Go to CFO Analytics', subtitle: 'Budget caps, MRR ledger & transactions' },
  { category: '🏢 Navigation Tabs', id: 'tab_github', icon: '🐙', title: 'Go to GitHub Stack', subtitle: 'Open-source repo ecosystem' }
];

function openOmniPalette() {
  const modal = document.getElementById('omniPaletteModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = document.getElementById('omniSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  omniSelectedIndex = 0;
  filterOmniActions('');
}

function closeOmniPalette() {
  const modal = document.getElementById('omniPaletteModal');
  if (modal) modal.classList.add('hidden');
}

function filterOmniActions(query = '') {
  const q = String(query || '').toLowerCase().trim();
  const agentItems = (appState?.agents || []).map((a) => ({
    category: '🤖 Company Agents & Specialists',
    id: `agent_${a.id}`,
    icon: a.avatar || '🤖',
    title: `${a.name} (${a.role})`,
    subtitle: `${a.department} • KPI: ${a.kpi}% • Tools: ${(a.tools || []).slice(0, 3).join(', ')}`,
    agentId: a.id
  }));

  const combined = [...STATIC_OMNI_ACTIONS, ...agentItems];
  activeOmniItems = q
    ? combined.filter((x) =>
        x.title.toLowerCase().includes(q) ||
        x.subtitle.toLowerCase().includes(q) ||
        x.category.toLowerCase().includes(q)
      )
    : combined;

  if (omniSelectedIndex >= activeOmniItems.length) {
    omniSelectedIndex = Math.max(0, activeOmniItems.length - 1);
  }

  renderOmniList();
}

function renderOmniList() {
  const listEl = document.getElementById('omniResultsList');
  if (!listEl) return;

  if (activeOmniItems.length === 0) {
    listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No commands or agents found matching your query.</div>`;
    return;
  }

  let html = '';
  let lastCategory = '';
  activeOmniItems.forEach((item, index) => {
    if (item.category !== lastCategory) {
      lastCategory = item.category;
      html += `<div class="omni-category-header">${escapeHtml(lastCategory)}</div>`;
    }
    const isSelected = index === omniSelectedIndex;
    html += `
      <div class="omni-item ${isSelected ? 'selected' : ''}" data-idx="${index}" onclick="executeOmniItem(${index})">
        <div class="omni-item-left">
          <span class="omni-item-icon">${item.icon}</span>
          <div>
            <div class="omni-item-title">${escapeHtml(item.title)}</div>
            <div class="omni-item-subtitle">${escapeHtml(item.subtitle)}</div>
          </div>
        </div>
        <div class="omni-item-right">
          ${item.shortcut ? `<span class="omni-shortcut">${escapeHtml(item.shortcut)}</span>` : ''}
          <span style="font-size:0.75rem;color:var(--text-muted);">↵</span>
        </div>
      </div>
    `;
  });
  listEl.innerHTML = html;

  const selectedEl = listEl.querySelector('.omni-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function handleOmniKeyNav(evt) {
  if (evt.key === 'ArrowDown') {
    evt.preventDefault();
    omniSelectedIndex = (omniSelectedIndex + 1) % Math.max(1, activeOmniItems.length);
    renderOmniList();
  } else if (evt.key === 'ArrowUp') {
    evt.preventDefault();
    omniSelectedIndex = (omniSelectedIndex - 1 + activeOmniItems.length) % Math.max(1, activeOmniItems.length);
    renderOmniList();
  } else if (evt.key === 'Enter') {
    evt.preventDefault();
    executeOmniItem(omniSelectedIndex);
  } else if (evt.key === 'Escape') {
    evt.preventDefault();
    closeOmniPalette();
  }
}

function executeOmniItem(index) {
  const item = activeOmniItems[index];
  if (!item) return;
  closeOmniPalette();

  if (item.agentId) {
    openAgentInspector(item.agentId);
    return;
  }

  switch (item.id) {
    case 'step_pipeline':
      stepPipeline();
      break;
    case 'toggle_loop':
      togglePipeline();
      break;
    case 'optimize_pipeline':
      optimizeCompanyPipeline();
      break;
    case 'auto_heal_code':
      fetch('/api/workspace/auto-heal', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          showToast('🩹 Self-Healing AST Debugger', d.healResult?.summary || 'Workspace verified');
        });
      break;
    case 'test_all_suites':
      fetch('/api/workspace/test-all', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          showToast('🧪 Unit Test Suite Runner', d.testResult?.summary || 'Completed');
        });
      break;
    case 'war_room':
      fetch('/api/company/war-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((d) => d.state && window.syncFromExternalState(d.state));
      break;
    case 'red_team':
      fetch('/api/company/red-team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((d) => d.state && window.syncFromExternalState(d.state));
      break;
    case 'poach_talent':
      fetch('/api/company/poach-talent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((d) => d.state && window.syncFromExternalState(d.state));
      break;
    case 'run_evals':
      fetch('/api/evals/run', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          if (window.triggerCelebrationBurst && d.evalResult?.compositeScore >= 80) {
            window.triggerCelebrationBurst(window.innerWidth / 2, window.innerHeight * 0.35, 50);
          }
          showToast(`🏆 SWE-Bench & GAIA Score: ${d.evalResult?.compositeScore}/100`, d.evalResult?.summary);
        });
      break;
    case 'toggle_product_split':
      if (window.toggleGlobalProductSplit) window.toggleGlobalProductSplit();
      break;
    case 'simulate_traffic':
      fetch('/api/product/simulate-traffic', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          if (window.triggerCelebrationBurst && (d.traffic?.newCustomers > 0 || d.traffic?.ok)) {
            window.triggerCelebrationBurst(window.innerWidth / 2, window.innerHeight * 0.4, 45);
          }
          showToast('📈 Customer Traffic Swarm', d.traffic?.summary);
        });
      break;
    case 'dspy_tournament':
      fetch('/api/agents/tournament', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          showToast('🧬 DSPy Tournament Complete', d.tournament?.summary);
        });
      break;
    case 'export_app':
      window.open('/api/workspace/export-app', '_blank');
      break;
    case 'open_kg_modal':
      openKnowledgeGraphModal();
      break;
    case 'consolidate_memory':
      fetch('/api/memory/consolidate', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          showToast('🧠 Memory Consolidated', `${d.memory?.knowledgeGraph?.length || 0} semantic triples active`);
        });
      break;
    case 'test_provider_conn':
      openModal('providerModal');
      setTimeout(() => testProviderConnection(), 200);
      break;
    case 'new_custom_mcp':
      openModal('customToolModal');
      break;
    case 'create_checkpoint':
      fetch('/api/company/checkpoints/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((d) => d.state && window.syncFromExternalState(d.state));
      break;
    case 'restore_checkpoint':
      if (appState?.checkpoints?.[0]) {
        fetch('/api/company/checkpoints/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkpointId: appState.checkpoints[0].id }) })
          .then((r) => r.json())
          .then((d) => d.state && window.syncFromExternalState(d.state));
      }
      break;
    case 'shift_crunch':
      fetch('/api/company/shift-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"shiftMode":"crunch"}' })
        .then((r) => r.json())
        .then((d) => d.state && window.syncFromExternalState(d.state));
      break;
    case 'shift_day':
      fetch('/api/company/shift-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"shiftMode":"day"}' })
        .then((r) => r.json())
        .then((d) => d.state && window.syncFromExternalState(d.state));
      break;
    case 'tab_org':
      switchTab('org');
      break;
    case 'tab_workspace':
      switchTab('workspace');
      break;
    case 'tab_hermes':
      switchTab('hermes');
      break;
    case 'tab_console':
      switchTab('console');
      break;
    case 'tab_kanban':
      switchTab('kanban');
      break;
    case 'tab_finance':
      switchTab('finance');
      break;
    case 'tab_github':
      switchTab('github');
      break;
  }
}

// 2. Interactive SVG Visual Knowledge Graph
function openKnowledgeGraphModal() {
  openModal('knowledgeGraphModal');
  setTimeout(() => renderVisualKnowledgeGraph(), 60);
}

function consolidateMemoryFromModal() {
  fetch('/api/memory/consolidate', { method: 'POST' })
    .then((r) => r.json())
    .then((d) => {
      if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
      renderVisualKnowledgeGraph();
      showToast('🧠 Memory Consolidated', `${d.memory?.knowledgeGraph?.length || 0} bi-temporal triples active`);
    });
}

function renderVisualKnowledgeGraph() {
  const svg = document.getElementById('kgVisualSvg');
  const details = document.getElementById('kgNodeDetailsPane');
  if (!svg) return;

  const triples = appState?.cognitiveMemory?.knowledgeGraph || [];
  if (triples.length === 0) {
    svg.innerHTML = `<text x="450" y="230" text-anchor="middle" fill="#94a3b8" font-size="13">No knowledge graph triples yet. Run a pipeline cycle to extract semantic memory.</text>`;
    return;
  }

  // Extract unique entities
  const nodeMap = new Map();
  triples.forEach((t) => {
    if (!nodeMap.has(t.subject)) {
      nodeMap.set(t.subject, { id: t.subject, label: t.subject, department: t.department || 'Executive', connections: 0 });
    }
    if (!nodeMap.has(t.object)) {
      nodeMap.set(t.object, { id: t.object, label: t.object, department: t.department || 'Engineering', connections: 0 });
    }
    nodeMap.get(t.subject).connections += 1;
    nodeMap.get(t.object).connections += 1;
  });

  const nodes = Array.from(nodeMap.values()).slice(0, 18);
  const cx = 450;
  const cy = 230;
  const rInner = 110;
  const rOuter = 190;

  nodes.forEach((n, idx) => {
    const isInner = idx % 2 === 0;
    const radius = isInner ? rInner : rOuter;
    const angle = (idx / nodes.length) * (Math.PI * 2) - Math.PI / 2;
    n.x = Math.round(cx + Math.cos(angle) * radius);
    n.y = Math.round(cy + Math.sin(angle) * radius);
  });

  const deptColors = {
    Executive: '#a855f7',
    Engineering: '#00f0ff',
    Marketing: '#ec4899',
    Finance: '#10b981',
    QA: '#eab308'
  };

  let svgContent = `
    <defs>
      <marker id="kgArrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(148, 163, 184, 0.65)" />
      </marker>
      <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  `;

  // Draw Edges
  triples.slice(0, 24).forEach((t) => {
    const sNode = nodes.find((n) => n.id === t.subject);
    const oNode = nodes.find((n) => n.id === t.object);
    if (!sNode || !oNode) return;

    const midX = (sNode.x + oNode.x) / 2;
    const midY = (sNode.y + oNode.y) / 2;

    svgContent += `
      <g style="cursor:pointer;" onclick="selectKgTriple('${escapeHtml(t.id)}')">
        <line class="kg-edge-anim" x1="${sNode.x}" y1="${sNode.y}" x2="${oNode.x}" y2="${oNode.y}" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.6" marker-end="url(#kgArrow)" />
        <rect x="${midX - 32}" y="${midY - 8}" width="64" height="15" rx="3" fill="#090d16" stroke="rgba(148, 163, 184, 0.3)" stroke-width="0.8" />
        <text class="kg-edge-text" x="${midX}" y="${midY + 2.5}" text-anchor="middle">${escapeHtml(t.predicate.slice(0, 12))}</text>
      </g>
    `;
  });

  // Draw Nodes
  nodes.forEach((n) => {
    const col = deptColors[n.department] || '#38bdf8';
    const displayLabel = n.label.length > 15 ? n.label.slice(0, 13) + '..' : n.label;
    svgContent += `
      <g class="kg-node" transform="translate(${n.x}, ${n.y})" onclick="selectKgNode('${escapeHtml(n.id)}')">
        <circle r="22" fill="none" stroke="${col}" stroke-width="1" opacity="0.35">
          <animate attributeName="r" values="19;24;19" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.45;0.1;0.45" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle r="17" fill="#0f172a" stroke="${col}" stroke-width="2.2" filter="url(#nodeGlow)" />
        <circle r="6" fill="${col}" opacity="0.75" />
        <rect x="-44" y="21" width="88" height="15" rx="3" fill="rgba(6, 9, 18, 0.88)" stroke="${col}" stroke-width="0.8" />
        <text class="kg-node-text" x="0" y="32" text-anchor="middle">${escapeHtml(displayLabel)}</text>
      </g>
    `;
  });

  svg.innerHTML = svgContent;

  window.selectKgNode = (nodeId) => {
    const foundTriples = triples.filter((t) => t.subject === nodeId || t.object === nodeId);
    if (!details) return;
    details.innerHTML = `
      <div style="color:#f8fafc;font-weight:700;margin-bottom:4px;">
        📌 Entity: <span style="color:#38bdf8">${escapeHtml(nodeId)}</span> (${foundTriples.length} relationships)
      </div>
      ${foundTriples.map((t) => `
        <div style="padding:2px 0;">• ${escapeHtml(t.subject)} ➔ <strong style="color:#a855f7">${escapeHtml(t.predicate)}</strong> ➔ ${escapeHtml(t.object)} <span style="color:#10b981;font-size:0.65rem;">(valid since ${(t.validFrom || '').slice(11, 19)})</span></div>
      `).join('')}
    `;
  };

  window.selectKgTriple = (tripleId) => {
    const t = triples.find((x) => x.id === tripleId);
    if (!t || !details) return;
    details.innerHTML = `
      <div style="color:#f8fafc;font-weight:700;">
        🔗 Triple: <span style="color:#38bdf8">${escapeHtml(t.subject)}</span> ➔ <span style="color:#a855f7">${escapeHtml(t.predicate)}</span> ➔ <span style="color:#10b981">${escapeHtml(t.object)}</span>
      </div>
      <div style="color:var(--text-muted);font-size:0.68rem;margin-top:2px;">
        Department: ${t.department} • Confidence: ${t.confidence || 0.96} • Valid From: ${t.validFrom}
      </div>
    `;
  };
}

// 3. Human-in-the-Loop Diff Approval Gate
function openDiffApprovalModal(taskId) {
  const task = (appState?.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  activeDiffTaskId = taskId;

  const modal = document.getElementById('diffApprovalModal');
  const titleEl = document.getElementById('diffModalTitle');
  const stageEl = document.getElementById('diffStageBadge');
  const container = document.getElementById('diffViewContainer');
  const inputEdit = document.getElementById('inputDiffEditContent');

  if (titleEl) titleEl.textContent = `✋ HITL Review: ${task.title}`;
  if (stageEl) stageEl.textContent = `${(task.stage || 'primary').toUpperCase()} • ${task.department} ➔ ${task.collaboratorDept || 'QA'}`;
  if (inputEdit) inputEdit.value = task.deliverable || task.description || '';

  // Generate readable diff comparing task description to deliverable
  const baseLines = (task.description || '').split('\n');
  const deliverableLines = (task.deliverable || '').split('\n').slice(0, 45);

  let diffHtml = '';
  baseLines.slice(0, 3).forEach((line) => {
    if (line.trim()) diffHtml += `<div class="diff-line diff-del">- [BASELINE SPEC] ${escapeHtml(line)}</div>`;
  });
  deliverableLines.forEach((line) => {
    if (line.trim().startsWith('```') || line.trim().startsWith('#') || line.trim().startsWith('-')) {
      diffHtml += `<div class="diff-line diff-add">+ ${escapeHtml(line)}</div>`;
    } else {
      diffHtml += `<div class="diff-line diff-context">  ${escapeHtml(line)}</div>`;
    }
  });

  if (container) container.innerHTML = diffHtml || '<div style="padding:10px;color:var(--text-muted);">No deliverable diff available yet.</div>';
  openModal('diffApprovalModal');
}

async function approveAndCommitFromDiff() {
  if (!activeDiffTaskId) return;
  const inputEdit = document.getElementById('inputDiffEditContent');
  const updatedContent = inputEdit ? inputEdit.value : '';

  const res = await fetch('/api/tasks/edit-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: activeDiffTaskId,
      deliverable: updatedContent,
      status: 'completed'
    })
  });
  const data = await res.json();
  if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
  closeModal('diffApprovalModal');
  if (window.triggerCelebrationBurst) window.triggerCelebrationBurst(window.innerWidth / 2, window.innerHeight * 0.45, 38);
  showToast('✅ Changes Approved & Committed', `Deliverable saved for task ${activeDiffTaskId}`);
  renderAll();
}

async function rejectAndRetrainFromDiff() {
  if (!activeDiffTaskId) return;
  const inputEdit = document.getElementById('inputDiffEditContent');
  const feedback = inputEdit ? inputEdit.value : 'Requires refinement';

  const res = await fetch('/api/tasks/edit-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: activeDiffTaskId,
      deliverable: feedback,
      status: 'qa_review'
    })
  });
  const data = await res.json();
  if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
  closeModal('diffApprovalModal');
  showToast('⚡ Task Sent to QA Gate', 'Agent retraining triggered for deliverable');
  renderAll();
}

// Global Keyboard Shortcuts (Ctrl+K, Space, W, R, P)
window.addEventListener('keydown', (evt) => {
  // Ctrl+K / Cmd+K opens Omni-Palette anywhere
  if ((evt.ctrlKey || evt.metaKey) && (evt.key === 'k' || evt.key === 'K')) {
    evt.preventDefault();
    const modal = document.getElementById('omniPaletteModal');
    if (modal && !modal.classList.contains('hidden')) {
      closeOmniPalette();
    } else {
      openOmniPalette();
    }
    return;
  }

  const tag = (evt.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || evt.target?.isContentEditable) return;
  if (evt.code === 'Space') {
    evt.preventDefault();
    stepPipeline();
  } else if (evt.key === 'w' || evt.key === 'W') {
    fetch('/api/company/war-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((d) => d.state && window.syncFromExternalState(d.state));
  } else if (evt.key === 'r' || evt.key === 'R') {
    fetch('/api/company/red-team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((d) => d.state && window.syncFromExternalState(d.state));
  } else if (evt.key === 'p' || evt.key === 'P') {
    fetch('/api/company/poach-talent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((d) => d.state && window.syncFromExternalState(d.state));
  }
});

// Initialize & Stream
fetchState(true);
connectRealTimeStream();
pollInterval = setInterval(() => fetchState(false), 2400);
