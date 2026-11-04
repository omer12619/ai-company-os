/**
 * AI Company OS — v12 & v13 Frontier Modules (Omni-Palette, Knowledge Graph, HITL Diff, Voice Walkie-Talkie, 2D Market Radar, GitHub ACI)
 * Extracted from public/app.js (Option A Modular Component Architecture)
 */
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
  { category: '🎙️ Executive & Governance', id: 'voice_walkie', icon: '🎙️', title: 'Open Real-Time Voice Walkie-Talkie', subtitle: 'Push-to-talk speech recognition & spoken C-Suite TTS standups' },
  { category: '🎙️ Executive & Governance', id: 'market_radar', icon: '📊', title: 'Open 2D Competitor Market Radar & FinOps Chart', subtitle: 'Interactive bubble radar, runway chart & viral market blitzes' },
  { category: '🎙️ Executive & Governance', id: 'github_sync', icon: '🐙', title: 'OpenHands ACI Studio: Commit & Push to GitHub', subtitle: 'Live git status, commit log & auto-push to omer12619/ai-company-os' },
  { category: '🎙️ Executive & Governance', id: 'browser_dom_audit', icon: '🖥️', title: 'Run Browser-Use Visual DOM Agent Audit', subtitle: 'Inspect /live-product DOM bounding boxes & auto-patch CRO (+MRR)' },
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
    case 'voice_walkie':
      openVoiceWalkieModal();
      break;
    case 'market_radar':
      openMarketRadarModal();
      break;
    case 'github_sync':
      openGitHubSyncModal();
      break;
    case 'browser_dom_audit':
      fetch('/api/product/browser-agent-audit', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
          if (window.triggerCelebrationBurst) window.triggerCelebrationBurst(window.innerWidth / 2, window.innerHeight * 0.4, 48);
          showToast('🖥️ Browser-Use Visual DOM Audit', d.result?.summary || 'DOM patched');
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

// ============================================================================
// v13: VOICE WALKIE-TALKIE, 2D MARKET RADAR & OPENHANDS GITHUB ACI STUDIO
// ============================================================================

let voiceRecognitionInstance = null;
let isVoiceListening = false;
let autoSpeakExecutiveTts = true;

function toggleAutoVoiceTts(val) {
  autoSpeakExecutiveTts = Boolean(val);
}

function speakAgentText(agentNameOrRole = 'CEO', text = '') {
  if (!autoSpeakExecutiveTts || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = String(text || '')
      .replace(/[#*`~>_]/g, '')
      .replace(/\[.*?\]/g, '')
      .slice(0, 260);
    const utter = new SpeechSynthesisUtterance(`${agentNameOrRole} reporting: ${cleanText}`);
    const roleLower = String(agentNameOrRole).toLowerCase();
    if (roleLower.includes('ceo') || roleLower.includes('aria')) {
      utter.pitch = 1.08;
      utter.rate = 1.04;
    } else if (roleLower.includes('cto') || roleLower.includes('marcus')) {
      utter.pitch = 0.88;
      utter.rate = 1.06;
    } else if (roleLower.includes('cmo') || roleLower.includes('elena')) {
      utter.pitch = 1.15;
      utter.rate = 1.08;
    } else if (roleLower.includes('cfo') || roleLower.includes('david')) {
      utter.pitch = 0.92;
      utter.rate = 1.02;
    }
    const waveEl = document.getElementById('voiceWaveVisualizer');
    if (waveEl) waveEl.classList.add('speaking');
    utter.onend = () => {
      if (waveEl && !isVoiceListening) waveEl.classList.remove('speaking');
    };
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn('TTS error:', e);
  }
}

function openVoiceWalkieModal() {
  const selectEl = document.getElementById('voiceTargetAgentSelect');
  if (selectEl && appState?.agents) {
    selectEl.innerHTML = appState.agents
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.avatar || '🤖')} ${escapeHtml(a.name)} — ${escapeHtml(a.role)}</option>`)
      .join('');
  }
  renderVoiceConversationLog();
  openModal('voiceWalkieModal');
}

function renderVoiceConversationLog() {
  const logEl = document.getElementById('voiceConversationLog');
  if (!logEl || !appState) return;
  const recent = (appState.consoleMessages || []).slice(0, 8);
  logEl.innerHTML = recent
    .map(
      (m) => `
      <div class="console-msg" style="margin-bottom:8px;padding:6px 10px;border-left:3px solid #f472b6;background:rgba(15,23,42,0.75);border-radius:6px;">
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#f472b6;font-weight:700;">
          <span>${escapeHtml(m.fromName)} (${escapeHtml(m.fromRole)}) ➔ ${escapeHtml(m.toName)}</span>
          <button class="btn btn-sm btn-outline" style="padding:1px 6px;font-size:0.62rem;" onclick="speakAgentText('${escapeHtml(m.fromName)}', '${escapeHtml((m.message || '').replace(/'/g, ''))}')">🔊 Speak</button>
        </div>
        <div style="font-size:0.75rem;color:#e2e8f0;margin-top:3px;">${escapeHtml(m.message)}</div>
      </div>`
    )
    .join('');
}

function toggleVoiceRecognition() {
  const statusEl = document.getElementById('voiceStatusReadout');
  const btn = document.getElementById('btnPushToTalk');
  const waveEl = document.getElementById('voiceWaveVisualizer');
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRec) {
    if (statusEl) statusEl.textContent = '⚠️ Browser SpeechRecognition API unavailable — type or click a quick voice directive below for full spoken TTS output!';
    return;
  }

  if (isVoiceListening && voiceRecognitionInstance) {
    voiceRecognitionInstance.stop();
    isVoiceListening = false;
    if (btn) btn.textContent = '🎙️ Push-to-Talk (Start Mic)';
    if (waveEl) waveEl.classList.remove('speaking');
    return;
  }

  voiceRecognitionInstance = new SpeechRec();
  voiceRecognitionInstance.lang = 'en-US';
  voiceRecognitionInstance.interimResults = false;
  voiceRecognitionInstance.maxAlternatives = 1;

  voiceRecognitionInstance.onstart = () => {
    isVoiceListening = true;
    if (btn) btn.textContent = '🛑 Listening... (Click to Stop)';
    if (statusEl) statusEl.textContent = '🎙️ Microphone live — speak your order to the C-Suite...';
    if (waveEl) waveEl.classList.add('speaking');
  };

  voiceRecognitionInstance.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    const input = document.getElementById('voiceTranscriptInput');
    if (input) input.value = transcript;
    if (statusEl) statusEl.textContent = `✅ Captured voice command: "${transcript}" — dispatching...`;
    submitVoiceWalkieOrder();
  };

  voiceRecognitionInstance.onerror = (err) => {
    isVoiceListening = false;
    if (btn) btn.textContent = '🎙️ Push-to-Talk (Start Mic)';
    if (waveEl) waveEl.classList.remove('speaking');
    if (statusEl) statusEl.textContent = `ℹ️ Mic status: ${err.error || 'ready'} — use quick voice pills or text box below.`;
  };

  voiceRecognitionInstance.onend = () => {
    isVoiceListening = false;
    if (btn) btn.textContent = '🎙️ Push-to-Talk (Start Mic)';
    if (waveEl) waveEl.classList.remove('speaking');
  };

  voiceRecognitionInstance.start();
}

async function submitVoiceWalkieOrder() {
  const selectEl = document.getElementById('voiceTargetAgentSelect');
  const inputEl = document.getElementById('voiceTranscriptInput');
  const statusEl = document.getElementById('voiceStatusReadout');
  const toId = selectEl?.value || 'ceo';
  const message = inputEl?.value.trim();
  if (!message) return;

  if (statusEl) statusEl.textContent = `📡 Transmitting voice directive to ${toId.toUpperCase()}...`;
  const res = await fetch('/api/console/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toId, message })
  });
  const data = await res.json();
  if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
  if (inputEl) inputEl.value = '';
  renderVoiceConversationLog();

  const targetAgent = (appState?.agents || []).find((a) => a.id === toId) || { name: 'Aria Chen (CEO)' };
  const replyMsg = data.state?.consoleMessages?.[0]?.message || `Directive received and queued for immediate execution.`;
  if (statusEl) statusEl.textContent = `🔊 ${targetAgent.name} responding via Voice Synthesis...`;
  speakAgentText(targetAgent.name, replyMsg);
}

function runQuickVoiceDirective(text) {
  const inputEl = document.getElementById('voiceTranscriptInput');
  if (inputEl) inputEl.value = text;
  submitVoiceWalkieOrder();
}

async function triggerSpokenExecutiveStandup() {
  const statusEl = document.getElementById('voiceStatusReadout');
  if (statusEl) statusEl.textContent = '🎙️ Convening C-Suite War Room Standup & synthesizing spoken executive briefing...';
  const res = await fetch('/api/company/war-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Spoken Executive Standup: MRR Velocity, Code Quality & Competitor Moat' })
  });
  const data = await res.json();
  if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
  renderVoiceConversationLog();

  const mrr = data.state?.company?.mrr || 0;
  const cust = data.state?.company?.customersCount || 0;
  const share = data.state?.company?.marketSharePct || 15;
  const standupScript = `War Room standup complete. Current monthly recurring revenue is ${mrr} dollars across ${cust} customers, with ${share} percent market share. Engineering microservices and FinOps guardrails are all green.`;
  if (statusEl) statusEl.textContent = `🔊 Speaking C-Suite Standup Summary...`;
  speakAgentText('CEO Aria Chen', standupScript);
}

// 2. 2D Competitor Market Radar & FinOps Burn-vs-MRR Runway Chart
function openMarketRadarModal() {
  openModal('marketRadarModal');
  setTimeout(() => renderMarketRadarAndFinOpsSvg(), 50);
}

async function executeMarketBlitz(strategy = 'viral_blitz') {
  const res = await fetch('/api/company/market-blitz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy })
  });
  const data = await res.json();
  if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
  renderMarketRadarAndFinOpsSvg();
  if (window.triggerCelebrationBurst) window.triggerCelebrationBurst(window.innerWidth / 2, window.innerHeight * 0.45, 55);
  showToast('🚀 Competitive Market Blitz Executed', data.result?.summary || 'Market share expanded!');
}

function renderMarketRadarAndFinOpsSvg() {
  const container = document.getElementById('marketRadarBodyGrid');
  if (!container || !appState) return;

  const ourShare = Number(appState.company?.marketSharePct || 16.5);
  const ourMrr = Number(appState.company?.mrr || 2400);
  const ourValuation = Number(appState.company?.valuationUsd || 450000);
  const competitors = appState.competitors || [
    { name: 'DevinCorp AI', marketShare: 24, valuation: '$12M', threatLevel: 'HIGH' },
    { name: 'AutoGPT Enterprise', marketShare: 19, valuation: '$8.5M', threatLevel: 'MEDIUM' },
    { name: 'CrewFlow Cloud', marketShare: 15, valuation: '$6.2M', threatLevel: 'LOW' }
  ];

  // Build 2D Competitor Bubble Radar SVG
  const radarBubbles = [
    { name: `${appState.company?.name || 'Our AI Co'} (US)`, share: ourShare, velocity: 92, color: '#10b981', r: Math.max(16, Math.min(34, ourShare * 0.9)) },
    ...competitors.map((c, i) => ({
      name: c.name,
      share: Number(c.marketShare || 18),
      velocity: 62 + i * 9,
      color: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#38bdf8',
      r: Math.max(13, Math.min(28, Number(c.marketShare || 18) * 0.8))
    }))
  ];

  const radarSvg = `
    <svg width="100%" height="260" viewBox="0 0 440 260" style="background:#060a14;border:1px solid rgba(56,189,248,0.28);border-radius:10px;">
      <line x1="45" y1="225" x2="415" y2="225" stroke="#334155" stroke-width="1.5" />
      <line x1="45" y1="25" x2="45" y2="225" stroke="#334155" stroke-width="1.5" />
      <line x1="230" y1="25" x2="230" y2="225" stroke="rgba(148,163,184,0.18)" stroke-dasharray="4 4" />
      <line x1="45" y1="125" x2="415" y2="125" stroke="rgba(148,163,184,0.18)" stroke-dasharray="4 4" />
      <text x="230" y="248" text-anchor="middle" fill="#94a3b8" font-size="10">Market Share % (X-Axis) ➔</text>
      <text x="16" y="130" text-anchor="middle" fill="#94a3b8" font-size="10" transform="rotate(-90 16 130)">Feature Velocity ➔</text>
      <text x="345" y="42" text-anchor="middle" fill="#10b981" font-size="9" font-weight="700">★ LEADER QUADRANT</text>
      ${radarBubbles
        .map((b) => {
          const cx = Math.min(390, Math.max(70, 55 + (b.share / 55) * 330));
          const cy = Math.min(205, Math.max(48, 225 - (b.velocity / 100) * 180));
          return `
            <g>
              <circle cx="${cx}" cy="${cy}" r="${b.r}" fill="${b.color}" fill-opacity="0.28" stroke="${b.color}" stroke-width="2" />
              <circle cx="${cx}" cy="${cy}" r="4" fill="${b.color}" />
              <text x="${cx}" y="${cy - b.r - 5}" text-anchor="middle" fill="#f8fafc" font-size="9.5" font-weight="700">${escapeHtml(b.name)} (${b.share}%)</text>
            </g>
          `;
        })
        .join('')}
    </svg>
  `;

  // Build FinOps MRR vs Token Burn Trajectory SVG
  const baseMrr = Math.max(400, ourMrr);
  const pointsMrr = [0.35, 0.52, 0.68, 0.84, 1.0, 1.22].map((mult, idx) => {
    const x = 55 + idx * 66;
    const y = Math.max(38, 210 - mult * 135);
    return `${x},${Math.round(y)}`;
  });
  const pointsBurn = [0.22, 0.25, 0.27, 0.29, 0.31, 0.33].map((mult, idx) => {
    const x = 55 + idx * 66;
    const y = Math.max(150, 220 - mult * 120);
    return `${x},${Math.round(y)}`;
  });

  const finopsSvg = `
    <svg width="100%" height="260" viewBox="0 0 440 260" style="background:#060a14;border:1px solid rgba(16,185,129,0.28);border-radius:10px;">
      <line x1="45" y1="225" x2="415" y2="225" stroke="#334155" stroke-width="1.5" />
      <line x1="45" y1="25" x2="45" y2="225" stroke="#334155" stroke-width="1.5" />
      <polyline fill="none" stroke="#10b981" stroke-width="3" points="${pointsMrr.join(' ')}" />
      <polyline fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="5 4" points="${pointsBurn.join(' ')}" />
      <text x="320" y="52" fill="#10b981" font-size="10" font-weight="700">📈 SaaS MRR ($${baseMrr.toLocaleString()}/mo)</text>
      <text x="320" y="196" fill="#f43f5e" font-size="9.5" font-weight="600">🔥 LLM Token Spend ($${Number(appState.company?.budgetSpent || 0.12).toFixed(3)})</text>
      <text x="230" y="248" text-anchor="middle" fill="#94a3b8" font-size="10">Autonomous Cycles &amp; Runway Projection (88.4% Gross Margin)</text>
    </svg>
  `;

  container.innerHTML = `
    <div style="background:rgba(15,23,42,0.75);padding:12px;border-radius:10px;border:1px solid var(--border-color);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="color:#38bdf8;font-size:0.84rem;">🎯 2D Competitive Positioning Matrix</strong>
        <span class="tag" style="color:#10b981;">Our Share: ${ourShare}%</span>
      </div>
      ${radarSvg}
    </div>
    <div style="background:rgba(15,23,42,0.75);padding:12px;border-radius:10px;border:1px solid var(--border-color);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="color:#10b981;font-size:0.84rem;">💎 FinOps MRR vs. Token Burn Trajectory</strong>
        <span class="tag" style="color:#fbbf24;">Valuation: $${ourValuation.toLocaleString()}</span>
      </div>
      ${finopsSvg}
    </div>
  `;
}

// 3. OpenHands / SWE-Agent ACI Studio & Live GitHub Auto-Push
function openGitHubSyncModal() {
  openModal('githubSyncModal');
  refreshGitHubSyncStatus();
}

async function refreshGitHubSyncStatus() {
  const container = document.getElementById('githubSyncStatusContainer');
  if (!container) return;
  container.innerHTML = `<div style="color:#94a3b8;font-size:0.78rem;">⏳ Querying local Git repository &amp; origin/main...</div>`;
  try {
    const res = await fetch('/api/github/status');
    const data = await res.json();
    const changed = data.changedFiles || [];
    const commits = data.commits || [];
    container.innerHTML = `
      <div class="form-grid-2" style="gap:12px;">
        <div style="background:rgba(15,23,42,0.85);padding:10px 12px;border-radius:8px;border:1px solid rgba(56,189,248,0.28);">
          <div style="font-weight:700;color:#38bdf8;font-size:0.78rem;margin-bottom:6px;">📂 Working Tree Status (${changed.length} modified/untracked)</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;max-height:150px;overflow-y:auto;color:#cbd5e1;">
            ${changed.length > 0 ? changed.map((f) => `<div style="padding:2px 0;">${escapeHtml(f)}</div>`).join('') : '<div style="color:#10b981;">✔ Working tree clean — ready to commit new workspace artifacts.</div>'}
          </div>
        </div>
        <div style="background:rgba(15,23,42,0.85);padding:10px 12px;border-radius:8px;border:1px solid rgba(168,85,247,0.28);">
          <div style="font-weight:700;color:#c4b5fd;font-size:0.78rem;margin-bottom:6px;">📜 Recent Git Commits (${escapeHtml(data.branch || 'main')})</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;max-height:150px;overflow-y:auto;">
            ${commits
              .map(
                (c) => `
              <div style="padding:3px 0;border-bottom:1px dashed rgba(148,163,184,0.15);">
                <span style="color:#38bdf8;font-weight:700;">${escapeHtml(c.hash)}</span>
                <span style="color:#e2e8f0;"> ${escapeHtml(c.subject)}</span>
                <span style="color:#64748b;font-size:0.66rem;"> (${escapeHtml(c.relativeTime)})</span>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div style="color:#f43f5e;font-size:0.78rem;">Failed to read Git status: ${escapeHtml(e.message)}</div>`;
  }
}

async function triggerGitHubAutoPush() {
  const btn = document.getElementById('btnGitPushNow');
  const msgInput = document.getElementById('inputGitCommitMessage');
  const message = msgInput?.value.trim() || 'feat(aci-studio): autonomous workspace & telemetry sync';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Pushing to GitHub...';
  }
  try {
    const res = await fetch('/api/github/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (data.state && window.syncFromExternalState) window.syncFromExternalState(data.state);
    if (window.triggerCelebrationBurst) window.triggerCelebrationBurst(window.innerWidth / 2, window.innerHeight * 0.4, 50);
    showToast('🐙 GitHub Auto-Push Complete', data.summary || 'Pushed to origin/main!');
    await refreshGitHubSyncStatus();
  } catch (e) {
    showToast('❌ GitHub Push Error', e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🐙 Commit & Push to GitHub';
    }
  }
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
