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
let activeTabId = 'org'; // 'org' | 'workspace' | 'hermes' | 'console' | 'kanban' | 'finance' | 'github'
let sseConnected = false;
window.getActiveTabId = () => activeTabId;

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
    if (window.CompanyStore) {
      window.CompanyStore.setState({
        companyState: appState,
        providersCatalog,
        companyTemplates,
        githubIntegrations,
        mcpServersCatalog,
        toolRegistry,
        a2aCardsCatalog
      });
    }
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

  // Lazy Tab-Aware DOM Rendering: Only mutate DOM for the active visible tab + global event sidebar!
  if (activeTabId === 'org') {
    renderOrgChart(agents, firedAgents, hireQueue);
    renderMiniConsole(consoleMessages);
  } else if (activeTabId === 'hermes') {
    renderHermesTab(agents, skillsRegistry);
  } else if (activeTabId === 'console') {
    renderSharedConsole(consoleMessages, agents);
  } else if (activeTabId === 'kanban') {
    renderKanban(tasks);
  } else if (activeTabId === 'finance') {
    renderFinance(ledger);
  }
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

  // 0. React 60fps Animated Virtual Office Simulation Component (only when on Org tab & office mode)
  if (activeTabId === 'org' && orgViewMode === 'office') {
    const officeEl = document.getElementById('reactVirtualOfficeRoot');
    if (officeEl && window.VirtualOfficeComponent) {
      if (!reactOfficeRoot) reactOfficeRoot = ReactDOM.createRoot(officeEl);
      reactOfficeRoot.render(h(window.VirtualOfficeComponent, { state: appState }));
    }
  }

  // 1. React Interactive SVG Node-Graph Component (only when on Org tab & graph mode)
  if (activeTabId === 'org' && orgViewMode === 'graph') {
    const graphEl = document.getElementById('reactNodeGraphRoot');
    if (graphEl) {
      if (!reactGraphRoot) reactGraphRoot = ReactDOM.createRoot(graphEl);
      reactGraphRoot.render(h(InteractiveOrgGraphComponent, { state: appState }));
    }
  }

  // 2. React IDE Workspace & Markdown Artifact Explorer Component
  if (activeTabId === 'workspace') {
    const wsEl = document.getElementById('reactWorkspaceRoot');
    if (wsEl) {
      if (!reactWorkspaceRoot) reactWorkspaceRoot = ReactDOM.createRoot(wsEl);
      reactWorkspaceRoot.render(h(WorkspaceExplorerComponent, {
        files: appState.workspaceFiles || [],
        wiki: appState.memoryWiki || []
      }));
    }
  }

  // 3. React CFO Telemetry & Paperclip Agent Budget Cap Component
  if (activeTabId === 'finance') {
    const finEl = document.getElementById('reactAnalyticsRoot');
    if (finEl) {
      if (!reactAnalyticsRoot) reactAnalyticsRoot = ReactDOM.createRoot(finEl);
      reactAnalyticsRoot.render(h(CFOAnalyticsComponent, { state: appState }));
    }
  }

  // 4. React GitHub Open-Source Stack & Portable Company Pack Manager
  if (activeTabId === 'github') {
    const ghEl = document.getElementById('reactGitHubRoot');
    if (ghEl) {
      if (!reactGitHubRoot) reactGitHubRoot = ReactDOM.createRoot(ghEl);
      reactGitHubRoot.render(h(GitHubEcosystemComponent, {
        repos: githubIntegrations,
        state: appState
      }));
    }
  }

  // 5. React Smart Tool & Script Router Studio
  if (activeTabId === 'hermes') {
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
}

// [Option A Modular Architecture]: React 18 Studio Components loaded from /js/components/ReactStudios.js

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
  activeTabId = tabId;
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach((c) => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });
  renderAll();
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
  if (window.CompanyStore) {
    window.CompanyStore.setState({ companyState: newState, sseConnected });
  }
  renderAll();
};

// Connect Real-Time Server-Sent Events (SSE) stream + fallback poll
function connectRealTimeStream() {
  if (typeof EventSource === 'undefined') return;
  try {
    const es = new EventSource('/api/stream');
    es.onopen = () => {
      sseConnected = true;
    };
    es.onmessage = (evt) => {
      sseConnected = true;
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed && parsed.state) {
          window.syncFromExternalState(parsed.state);
        }
      } catch {}
    };
    es.onerror = () => {
      sseConnected = false;
    };
  } catch (e) {
    sseConnected = false;
    console.warn('SSE fallback to polling:', e);
  }
}

// [Option A Modular Architecture]: v12/v13 Frontier Modals loaded from /js/components/FrontierModals.js

// Initialize & Stream
fetchState(true);
connectRealTimeStream();
pollInterval = setInterval(() => {
  if (!sseConnected && !document.hidden) {
    fetchState(false);
  }
}, 2800);
