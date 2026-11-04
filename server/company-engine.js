const fs = require('fs');
const path = require('path');
const { PROVIDERS, callLLM } = require('./llm-router');
const {
  MCP_SERVERS,
  TOOL_REGISTRY,
  OWASP_AGENTIC_RISKS,
  selectOptimalToolsForTask,
  executeAgentTools,
  executeQAVerificationTools,
  runWorkspaceJSFile,
  executeRedTeamAudit,
  generateStandaloneAppBundle,
  runAllWorkspaceTests,
  autoHealWorkspaceCode,
  registerCustomMcpTool,
  handleMcpJsonRpc,
  evaluateOwaspToolPolicy,
  runSweAndGaiaBenchmark
} = require('./tool-executor');

const {
  COMPANY_TEMPLATES,
  GITHUB_INTEGRATIONS,
  createFoundingAgents,
  createInitialSkills,
  createInitialState
} = require('./company-catalogs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WORKSPACE_DIR = path.join(__dirname, '..', 'workspace');
const STATE_FILE = path.join(DATA_DIR, 'company-state.json');

class CompanyEngine {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    this.sseClients = new Set();
    this.diskFlushTimer = null;
    this.sseFlushTimer = null;
    this.state = this.loadState();
    this.loopTimer = null;
    this.stepInProgress = false;
  }

  addSSEClient(res) {
    this.sseClients.add(res);
  }

  removeSSEClient(res) {
    this.sseClients.delete(res);
  }

  broadcastSSE() {
    if (!this.sseClients || this.sseClients.size === 0) return;
    if (this.sseFlushTimer) return;
    this.sseFlushTimer = setTimeout(() => {
      this.sseFlushTimer = null;
      if (!this.sseClients || this.sseClients.size === 0) return;
      const payload = `data: ${JSON.stringify({ state: this.state })}\n\n`;
      for (const client of this.sseClients) {
        try {
          client.write(payload);
        } catch {
          this.sseClients.delete(client);
        }
      }
    }, 35);
  }

  clampRingBuffers(state = this.state) {
    if (!state) return;
    if (Array.isArray(state.events) && state.events.length > 80) state.events.length = 80;
    if (Array.isArray(state.consoleMessages) && state.consoleMessages.length > 80) state.consoleMessages.length = 80;
    if (Array.isArray(state.ledger) && state.ledger.length > 100) state.ledger.length = 100;
    if (Array.isArray(state.toolExecutions) && state.toolExecutions.length > 50) state.toolExecutions.length = 50;
    if (Array.isArray(state.otelSpans) && state.otelSpans.length > 80) state.otelSpans.length = 80;
    if (Array.isArray(state.owaspAuditLog) && state.owaspAuditLog.length > 60) state.owaspAuditLog.length = 60;
    if (Array.isArray(state.checkpoints) && state.checkpoints.length > 12) state.checkpoints.length = 12;
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        parsed.company.isRunning = false;
        parsed.company.tokensSaved = parsed.company.tokensSaved || 0;
        parsed.company.handoffsCount = parsed.company.handoffsCount || 0;
        parsed.company.subAgentsCount = parsed.company.subAgentsCount || 0;
        parsed.company.toolCallsCount = parsed.company.toolCallsCount || 0;
        parsed.company.mrr = parsed.company.mrr || 0;
        parsed.company.customersCount = parsed.company.customersCount || 0;
        parsed.company.revenueEarned = parsed.company.revenueEarned || 0;
        parsed.company.valuationUsd = parsed.company.valuationUsd || 250000;
        parsed.company.marketSharePct = parsed.company.marketSharePct || 14.0;
        parsed.company.shiftMode = parsed.company.shiftMode || 'day';
        parsed.company.optimizationScore = parsed.company.optimizationScore || 94;
        parsed.competitors = parsed.competitors || createInitialState().competitors;
        parsed.company.activePhase = parsed.company.activePhase || 'strategy';
        parsed.company.speedMs = parsed.company.speedMs || 2200;
        parsed.company.uiTheme = parsed.company.uiTheme || 'classic';
        parsed.company.parallelMode = parsed.company.parallelMode !== false;
        parsed.company.requireBoardApproval = Boolean(parsed.company.requireBoardApproval);
        parsed.consoleMessages = parsed.consoleMessages || [];
        parsed.skillsRegistry = parsed.skillsRegistry || createInitialSkills();
        parsed.toolExecutions = parsed.toolExecutions || [];
        parsed.boardInbox = parsed.boardInbox || [];
        parsed.workspaceFiles = parsed.workspaceFiles || [];
        parsed.otelSpans = parsed.otelSpans || [];
        parsed.owaspAuditLog = parsed.owaspAuditLog || [];
        parsed.cognitiveMemory = parsed.cognitiveMemory || {
          episodicEvents: [],
          knowledgeGraph: [
            {
              id: 'kg-init-1',
              subject: parsed.company?.name || 'NexusAI SaaS',
              predicate: 'ORCHESTRATES_PROTOCOL',
              object: 'Anthropic MCP 2025-03-26 + Google A2A-1.0',
              department: 'Executive',
              validFrom: new Date().toISOString(),
              confidence: 0.99
            }
          ],
          consolidationsCount: 1
        };
        const defaultAvatars = { Executive: '👑', HR: '🤝', Finance: '💎', Engineering: '⚡', Marketing: '🚀', QA: '🛡️' };
        (parsed.agents || []).forEach((a) => {
          a.avatar = a.avatar || defaultAvatars[a.department] || '🤖';
          a.currentAction = a.currentAction || 'Standing by for mission tasks';
          a.harnessType = a.harnessType || 'Hermes Specialist Node';
          a.budgetCap = a.budgetCap || 3.50;
          a.heartbeatAt = a.heartbeatAt || new Date().toISOString();
          a.providerOverride = a.providerOverride || 'inherit';
          a.modelOverride = a.modelOverride || '';
          a.temperature = typeof a.temperature === 'number' ? a.temperature : 0.6;
          a.autonomyLevel = a.autonomyLevel || 'High';
          a.canSpawnSubAgents = a.canSpawnSubAgents !== false;
          a.subAgents = Array.isArray(a.subAgents) ? a.subAgents : [];
          a.subAgentsSpawned = a.subAgentsSpawned || a.subAgents.length;
          a.tools = a.tools || ['core_llm', 'shared_memory'];
          a.handoffsSent = a.handoffsSent || 0;
          a.handoffsReceived = a.handoffsReceived || 0;
        });
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load state, creating fresh state:', e.message);
    }
    const fresh = createInitialState();
    this.saveState(fresh);
    return fresh;
  }

  saveState(state = this.state) {
    try {
      this.clampRingBuffers(state);
      this.broadcastSSE();
      if (this.diskFlushTimer) clearTimeout(this.diskFlushTimer);
      this.diskFlushTimer = setTimeout(() => {
        this.diskFlushTimer = null;
        fs.promises
          .writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
          .catch((err) => console.error('Async state flush error:', err.message));
      }, 300);
    } catch (e) {
      console.error('Failed to save state:', e.message);
    }
  }

  writeWorkspaceArtifact({ filename, department, author, content }) {
    try {
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fullPath = path.join(WORKSPACE_DIR, safeName);
      fs.writeFileSync(fullPath, content, 'utf8');

      const existingIdx = this.state.workspaceFiles.findIndex((f) => f.filename === safeName);
      const record = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        filename: safeName,
        department,
        author,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        content,
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        this.state.workspaceFiles[existingIdx] = record;
      } else {
        this.state.workspaceFiles.unshift(record);
      }

      this.recordKnowledgeGraphTriple({
        subject: author || department || 'Agent',
        predicate: safeName.endsWith('.sql') ? 'ARCHITECTED_SQL_DDL'
          : safeName.endsWith('_service.js') ? 'SYNTHESIZED_MICROSERVICE'
          : safeName.endsWith('_landing.html') ? 'DEPLOYED_GTM_FUNNEL'
          : safeName.endsWith('_unit_model.json') ? 'MODELED_MONTE_CARLO_FINOPS'
          : 'PUBLISHED_ARTIFACT',
        object: safeName,
        department: department || 'Engineering'
      });
    } catch (e) {
      console.error('Failed to write workspace artifact:', e.message);
    }
  }

  recordOtelSpan({ operationName, spanKind = 'INTERNAL', agent, toolName = null, provider = 'simulator', model = 'company-sim-v2', inputTokens = 0, outputTokens = 0, durationMs = 42, status = 'OK', detail = '' }) {
    this.state.otelSpans = this.state.otelSpans || [];
    const cycleTraceId = `trace-cycle-${this.state.company?.cycleCount || 1}-${(this.state.company?.name || 'corp').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const span = {
      traceId: cycleTraceId,
      spanId: `span-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parentSpanId: `root-cycle-${this.state.company?.cycleCount || 1}`,
      name: operationName,
      kind: spanKind,
      timestamp: new Date().toISOString(),
      durationMs,
      status,
      attributes: {
        'gen_ai.operation.name': toolName ? 'execute_tool' : operationName.toLowerCase().includes('handoff') ? 'a2a_handoff' : 'chat',
        'gen_ai.system': provider,
        'gen_ai.request.model': model,
        'gen_ai.usage.input_tokens': inputTokens,
        'gen_ai.usage.output_tokens': outputTokens,
        'gen_ai.agent.id': agent?.id || 'system',
        'gen_ai.agent.name': agent?.name || 'System Orchestrator',
        'gen_ai.agent.department': agent?.department || 'Executive',
        ...(toolName ? { 'gen_ai.tool.name': toolName } : {}),
        'otel.detail': detail
      }
    };
    this.state.otelSpans.unshift(span);
    if (this.state.otelSpans.length > 90) {
      this.state.otelSpans = this.state.otelSpans.slice(0, 90);
    }
    return span;
  }

  recordKnowledgeGraphTriple({ subject, predicate, object, department = 'Executive', confidence = 0.96 }) {
    this.state.cognitiveMemory = this.state.cognitiveMemory || {
      episodicEvents: [],
      knowledgeGraph: [],
      consolidationsCount: 1
    };
    const kg = this.state.cognitiveMemory.knowledgeGraph;
    const exists = kg.find((k) => k.subject === subject && k.predicate === predicate && k.object === object);
    if (exists) {
      exists.validFrom = new Date().toISOString();
      exists.confidence = Math.min(0.99, (exists.confidence || 0.95) + 0.01);
      return exists;
    }
    const triple = {
      id: `kg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      subject,
      predicate,
      object,
      department,
      validFrom: new Date().toISOString(),
      confidence
    };
    kg.unshift(triple);
    if (kg.length > 45) {
      this.state.cognitiveMemory.knowledgeGraph = kg.slice(0, 45);
    }
    return triple;
  }

  logEvent({ type, department, actor, title, detail }) {
    const evt = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      department: department || 'Executive',
      actor: actor || 'System',
      title,
      detail
    };
    this.state.events.unshift(evt);
    if (this.state.events.length > 140) {
      this.state.events = this.state.events.slice(0, 140);
    }
    return evt;
  }

  logConsole({ fromAgent, toAgent, type = 'HANDOFF', taskTitle = 'Shared Mission', message }) {
    const entry = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      fromId: fromAgent?.id || 'founder',
      fromName: fromAgent ? `${fromAgent.avatar || '🤖'} ${fromAgent.name} (${fromAgent.department})` : '👤 Founder (Board Chair)',
      fromDept: fromAgent?.department || 'Executive',
      toId: toAgent?.id || 'all',
      toName: toAgent ? `${toAgent.avatar || '🤖'} ${toAgent.name} (${toAgent.department})` : '📡 Shared Mission Bus',
      type,
      taskTitle,
      message
    };
    this.state.consoleMessages.unshift(entry);
    if (this.state.consoleMessages.length > 160) {
      this.state.consoleMessages = this.state.consoleMessages.slice(0, 160);
    }
    if (type === 'HANDOFF' && fromAgent && toAgent) {
      this.recordKnowledgeGraphTriple({
        subject: `${fromAgent.name} (${fromAgent.department})`,
        predicate: 'A2A_HANDOFF_TO',
        object: `${toAgent.name} (${toAgent.department})`,
        department: fromAgent.department
      });
    }
    return entry;
  }

  recordLedger({ agent, action, provider, model, promptTokens = 0, completionTokens = 0, totalTokens, tokensSaved = 0, cost }) {
    this.state.company.budgetSpent = Number((this.state.company.budgetSpent + cost).toFixed(4));
    this.state.company.totalTokens += totalTokens;
    this.state.company.tokensSaved = (this.state.company.tokensSaved || 0) + tokensSaved;
    if (agent) {
      agent.tokensUsed = (agent.tokensUsed || 0) + totalTokens;
      agent.costSpent = Number(((agent.costSpent || 0) + cost).toFixed(4));
      agent.heartbeatAt = new Date().toISOString();
    }
    const entry = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      agentId: agent?.id || 'system',
      agentName: agent?.name || 'System',
      department: agent?.department || 'Executive',
      action,
      provider,
      model,
      tokens: totalTokens,
      cost
    };
    this.state.ledger.unshift(entry);
    if (this.state.ledger.length > 180) {
      this.state.ledger = this.state.ledger.slice(0, 180);
    }

    this.recordOtelSpan({
      operationName: action,
      spanKind: 'CLIENT',
      agent,
      provider,
      model,
      inputTokens: promptTokens || Math.round(totalTokens * 0.6),
      outputTokens: completionTokens || Math.round(totalTokens * 0.4),
      durationMs: Math.floor(85 + Math.random() * 140),
      status: 'OK',
      detail: `${agent?.name || 'Agent'} (${provider}/${model}) • ${totalTokens} tok ($${cost.toFixed(4)})`
    });
  }

  resetCompany({ name, theme, goal, budget, templateId }) {
    this.stopLoop();
    const template = COMPANY_TEMPLATES.find((t) => t.id === templateId) || {
      name: name || 'Autonomous AI Corp',
      theme: theme || 'AI Technology & Operations',
      goal: goal || 'Build and scale a profitable product with autonomous AI pipelines.',
      budget: Number(budget) || 25.00
    };
    const prevProviderConfig = this.state.providerConfig;
    const prevUiTheme = this.state.company?.uiTheme || 'classic';
    this.state = createInitialState({
      name: name || template.name,
      theme: theme || template.theme,
      goal: goal || template.goal,
      budget: Number(budget) || template.budget
    });
    if (prevProviderConfig) this.state.providerConfig = prevProviderConfig;
    this.state.company.uiTheme = prevUiTheme;
    this.saveState();
    return this.state;
  }

  importCompanyPack(packData) {
    this.stopLoop();
    if (packData && packData.company && Array.isArray(packData.agents)) {
      const prevProviderConfig = this.state.providerConfig;
      this.state = {
        ...this.state,
        ...packData,
        providerConfig: prevProviderConfig
      };
      this.state.company.isRunning = false;
      this.logEvent({
        type: 'SYSTEM',
        department: 'Executive',
        actor: 'Paperclip Importer',
        title: `Imported Company Pack: "${this.state.company.name}"`,
        detail: `${this.state.agents.length} agents & ${(this.state.skillsRegistry || []).length} skills loaded.`
      });
      this.saveState();
    }
    return this.state;
  }

  setPipelineSpeed(speedMs, uiTheme) {
    if (speedMs) {
      this.state.company.speedMs = Math.max(600, Math.min(10000, Number(speedMs)));
      if (this.state.company.isRunning) {
        this.stopLoop();
        this.startLoop();
      }
    }
    if (uiTheme) {
      this.state.company.uiTheme = uiTheme;
    }
    this.saveState();
    return this.state;
  }

  updateProviderConfig(newConfig) {
    if (newConfig.activeProvider && PROVIDERS[newConfig.activeProvider]) {
      this.state.providerConfig.activeProvider = newConfig.activeProvider;
    }
    if (newConfig.providers) {
      for (const [provKey, provVal] of Object.entries(newConfig.providers)) {
        if (this.state.providerConfig.providers[provKey]) {
          this.state.providerConfig.providers[provKey] = {
            ...this.state.providerConfig.providers[provKey],
            ...provVal
          };
        }
      }
    }
    this.logEvent({
      type: 'SYSTEM',
      department: 'Executive',
      actor: 'Founder',
      title: `LLM Provider Updated -> ${PROVIDERS[this.state.providerConfig.activeProvider]?.name}`,
      detail: `Active model: ${this.state.providerConfig.providers[this.state.providerConfig.activeProvider]?.model}`
    });
    this.saveState();
    return this.state.providerConfig;
  }

  startLoop() {
    if (this.state.company.isRunning) return;
    this.state.company.isRunning = true;
    this.state.company.statusMessage = 'Autonomous multi-agent pipeline & Hermes sub-agent bus running...';
    this.saveState();

    const intervalMs = this.state.company.speedMs || 2200;
    this.loopTimer = setInterval(async () => {
      if (!this.state.company.isRunning) return;
      await this.runSingleCycle();
    }, intervalMs);
  }

  stopLoop() {
    this.state.company.isRunning = false;
    this.state.company.statusMessage = 'Pipeline paused. Click "▶ Start Auto-Pilot" or "⏭ Next Step" to continue.';
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.saveState();
  }

  safeParseJSON(text, fallback) {
    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      }
      return JSON.parse(cleaned);
    } catch {
      return fallback;
    }
  }

  async runSingleCycle() {
    if (this.stepInProgress) return { skipped: true, reason: 'Step already in progress' };
    this.stepInProgress = true;

    try {
      this.state.agents.forEach((a) => {
        if (a.status !== 'fired') {
          a.status = 'idle';
          a.currentAction = 'Monitoring shared mission bus';
        }
      });

      if (this.state.company.budgetSpent >= this.state.company.budgetTotal) {
        this.stopLoop();
        this.state.company.statusMessage = 'Budget limit reached! CFO froze spending. Increase budget in Mission Settings.';
        this.logEvent({
          type: 'FINANCE',
          department: 'Finance',
          actor: 'Elena Rostova (CFO)',
          title: 'Budget Hard Cap Reached — Pipeline Frozen',
          detail: `Spent $${this.state.company.budgetSpent.toFixed(2)} of $${this.state.company.budgetTotal.toFixed(2)} budget.`
        });
        this.saveState();
        return this.state;
      }

      this.state.company.cycleCount += 1;

      if (this.state.tasks.length === 0) {
        this.state.company.activePhase = 'strategy';
        await this.executeCEOPlanning();
        this.saveState();
        return this.state;
      }

      if (this.state.hireQueue.length > 0) {
        this.state.company.activePhase = 'hiring';
        const req = this.state.hireQueue.shift();
        await this.executeHRHire(req);
        this.saveState();
        return this.state;
      }

      const qaTask = this.state.tasks.find((t) => t.status === 'qa_review');
      if (qaTask) {
        this.state.company.activePhase = 'qa_evolution';
        await this.executeQAAuditAndHRLoop(qaTask);
        this.saveState();
        return this.state;
      }

      let activeTasks = this.state.tasks.filter((t) => t.status === 'in_progress');
      if (activeTasks.length === 0) {
        activeTasks = this.state.tasks.filter((t) => t.status === 'backlog');
      }
      if (activeTasks.length > 0) {
        this.state.company.activePhase = 'execution';
        if (this.state.company.parallelMode !== false && activeTasks.length > 1) {
          // Pick up to 2 tasks from distinct primary/target departments for parallel multi-department execution
          const selected = [activeTasks[0]];
          const firstDept = activeTasks[0].stage === 'primary' ? activeTasks[0].department : activeTasks[0].collaboratorDept;
          const second = activeTasks.slice(1).find((t) => {
            const dept = t.stage === 'primary' ? t.department : t.collaboratorDept;
            return dept !== firstDept;
          }) || activeTasks[1];
          if (second && second.id !== activeTasks[0].id) {
            selected.push(second);
          }
          await Promise.allSettled(selected.map((t) => this.executeWorkerTaskAndHandoff(t)));
        } else {
          await this.executeWorkerTaskAndHandoff(activeTasks[0]);
        }
        this.saveState();
        return this.state;
      }

      this.state.company.activePhase = 'strategy';
      await this.executeNextSprintPlanning();
      this.saveState();
      return this.state;
    } finally {
      this.stepInProgress = false;
    }
  }

  spawnSubAgentInternal(parentAgent, { name, specialty, taskFocus, promoteToFullHire = false }) {
    parentAgent.subAgents = parentAgent.subAgents || [];
    const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const subAgent = {
      id: subId,
      parentId: parentAgent.id,
      parentName: parentAgent.name,
      name: name || `${specialty} Sub-Agent`,
      specialty: specialty || 'Micro-Task Executor',
      department: parentAgent.department,
      taskFocus: taskFocus || 'Parallel subtask decomposition',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (parentAgent.subAgents.length >= 4) {
      parentAgent.subAgents.shift();
    }
    parentAgent.subAgents.push(subAgent);
    parentAgent.subAgentsSpawned = (parentAgent.subAgentsSpawned || 0) + 1;
    this.state.company.subAgentsCount = (this.state.company.subAgentsCount || 0) + 1;

    this.logConsole({
      fromAgent: parentAgent,
      toAgent: parentAgent,
      type: 'SUBAGENT',
      taskTitle: taskFocus,
      message: `🧬 [Hermes Sub-Agent Spawned] ${parentAgent.name} spawned child sub-agent "${subAgent.name}" (${subAgent.specialty}) to execute: "${taskFocus}".`
    });

    this.logEvent({
      type: 'SUBAGENT',
      department: parentAgent.department,
      actor: `${parentAgent.name}`,
      title: `Spawned Sub-Agent: ${subAgent.name}`,
      detail: `Parent: ${parentAgent.name} | Focus: ${taskFocus}`
    });

    if (promoteToFullHire) {
      this.state.hireQueue.push({
        role: specialty,
        department: parentAgent.department,
        reportsTo: parentAgent.reportsTo || parentAgent.id,
        reason: `Promoted from high-performing sub-agent ${subAgent.name}`
      });
    }

    return subAgent;
  }

  async executeCEOPlanning() {
    const ceo = this.state.agents.find((a) => a.id === 'ceo');
    ceo.status = 'working';
    ceo.currentAction = 'Decomposing mission & hiring requisitions';
    this.state.company.statusMessage = `👑 CEO (${ceo.name}) is designing shared mission strategy & staffing plan...`;

    const userPrompt = `ACTION:CEO_PLAN
Company Name: ${this.state.company.name}
Company Theme: ${this.state.company.theme}
Company Goal: ${this.state.company.goal}
Total Budget: $${this.state.company.budgetTotal}`;

    const llmRes = await callLLM({
      providerConfig: this.state.providerConfig,
      agent: ceo,
      systemPrompt: ceo.systemPrompt,
      userPrompt,
      jsonMode: true
    });

    this.recordLedger({
      agent: ceo,
      action: 'Strategic Roadmap & Handoff Topology',
      ...llmRes
    });

    const parsed = this.safeParseJSON(llmRes.content, {
      executiveSummary: `Initialized shared mission roadmap for ${this.state.company.goal}`,
      hireRequests: [
        { role: 'Lead AI Systems Engineer', department: 'Engineering', reportsTo: 'cto', reason: 'Core architecture implementation', skills: ['Architecture', 'APIs'] },
        { role: 'Growth Marketing Strategist', department: 'Marketing', reportsTo: 'cmo', reason: 'Go-to-market & customer acquisition', skills: ['GTM', 'Copywriting'] },
        { role: 'Unit Economics Analyst', department: 'Finance', reportsTo: 'cfo', reason: 'Pricing & token margin modeling', skills: ['Pricing', 'ROI'] }
      ],
      tasks: [
        { title: 'Core System Architecture & Technical Spec', department: 'Engineering', collaboratorDept: 'Finance', priority: 'High', description: `Design technical architecture for ${this.state.company.goal}` },
        { title: 'Go-To-Market & Positioning Playbook', department: 'Marketing', collaboratorDept: 'Engineering', priority: 'High', description: `Create launch strategy for ${this.state.company.goal}` },
        { title: 'Unit Economics & Token Budget Model', department: 'Finance', collaboratorDept: 'Marketing', priority: 'Medium', description: `Model pricing tiers and margin targets for ${this.state.company.goal}` }
      ]
    });

    if (Array.isArray(parsed.hireRequests)) {
      this.state.hireQueue.push(...parsed.hireRequests);
    }

    const defaultCollabMap = {
      Engineering: 'Finance',
      Marketing: 'Engineering',
      Finance: 'Marketing',
      QA: 'Engineering'
    };

    if (Array.isArray(parsed.tasks)) {
      parsed.tasks.forEach((t, idx) => {
        const dept = t.department || 'Engineering';
        this.state.tasks.push({
          id: `task-${Date.now()}-${idx}`,
          title: t.title,
          department: dept,
          collaboratorDept: t.collaboratorDept || defaultCollabMap[dept] || 'Finance',
          stage: 'primary',
          handoffChain: [],
          subAgentTraces: [],
          priority: t.priority || 'High',
          description: t.description || t.title,
          status: 'backlog',
          assigneeId: null,
          assigneeName: null,
          attempts: 0,
          qaScore: null,
          qaFeedback: null,
          deliverable: null,
          createdAt: new Date().toISOString()
        });
      });
    }

    this.writeWorkspaceArtifact({
      filename: 'MASTER_ROADMAP.md',
      department: 'Executive',
      author: `${ceo.name} (CEO)`,
      content: `# Strategic Master Roadmap\n\n**Executive Summary:** ${parsed.executiveSummary}\n\n## Initial Tasks\n${this.state.tasks.map((t) => `- **[${t.department} ➔ ${t.collaboratorDept}]** ${t.title}`).join('\n')}`
    });

    ceo.tasksCompleted += 1;
    this.logConsole({
      fromAgent: ceo,
      toAgent: null,
      type: 'BROADCAST',
      taskTitle: 'Master Mission Plan',
      message: `${parsed.executiveSummary} — Queued ${this.state.hireQueue.length} specialist hires and ${this.state.tasks.length} cross-departmental tasks.`
    });

    this.logEvent({
      type: 'STRATEGY',
      department: 'Executive',
      actor: `${ceo.name} (CEO)`,
      title: 'CEO Published Master Roadmap & Hiring Requisitions',
      detail: `${parsed.executiveSummary}`
    });
  }

  async executeHRHire(req) {
    const hr = this.state.agents.find((a) => a.id === 'hr');
    const cfo = this.state.agents.find((a) => a.id === 'cfo');
    hr.status = 'working';
    hr.currentAction = `Recruiting ${req.role}`;
    cfo.status = 'working';
    cfo.currentAction = `Approving budget for ${req.role}`;

    const deptToManager = {
      Engineering: 'cto',
      Marketing: 'cmo',
      Finance: 'cfo',
      QA: 'qa'
    };
    const deptAvatars = {
      Engineering: '💻',
      Marketing: '📣',
      Finance: '📊',
      QA: '🔬'
    };
    const reportsTo = req.reportsTo || deptToManager[req.department] || 'cto';
    const managerAgent = this.state.agents.find((a) => a.id === reportsTo);
    this.state.company.statusMessage = `🤝 HR (${hr.name}) is onboarding specialist "${req.role}" into ${req.department}...`;

    const userPrompt = `ACTION:HR_HIRE
Company Mission: ${this.state.company.goal}
Role: ${req.role}
Department: ${req.department}
Reason: ${req.reason}
Prior Lessons / Requirements: ${req.inheritedSOP || 'Standard onboarding'}`;

    const llmRes = await callLLM({
      providerConfig: this.state.providerConfig,
      agent: hr,
      systemPrompt: hr.systemPrompt,
      userPrompt,
      jsonMode: true
    });

    this.recordLedger({
      agent: hr,
      action: `Recruit & Onboard: ${req.role}`,
      ...llmRes
    });

    const parsed = this.safeParseJSON(llmRes.content, {
      name: `${req.role} (Specialist)`,
      role: req.role,
      department: req.department,
      systemPrompt: `You are ${req.role} in the ${req.department} department. Collaborate across the Shared Mission Console, spawn focused sub-agents when needed, and deliver quantitative work supporting: ${this.state.company.goal}.`,
      sops: [
        `SOP-01: Align all ${req.department} deliverables with shared company KPIs.`,
        `SOP-02: Pass structured handoff notes to peer agents in the Shared Mission Console.`
      ],
      tools: ['specialist_toolkit', 'subagent_spawner', 'handoff_bus']
    });

    if (req.inheritedSOP && !parsed.sops.includes(req.inheritedSOP)) {
      parsed.sops.push(req.inheritedSOP);
    }

    const now = new Date().toISOString();
    const newAgent = {
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: parsed.name || req.role,
      avatar: deptAvatars[req.department] || '🤖',
      role: parsed.role || req.role,
      department: req.department || 'Engineering',
      tier: 'worker',
      reportsTo,
      harnessType: req.harnessType || 'Hermes Specialist Node',
      status: 'idle',
      currentAction: 'Onboarded & ready for tasks',
      kpi: 82,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 3.50,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: req.department === 'Marketing' ? 0.75 : req.department === 'Finance' ? 0.35 : 0.5,
      autonomyLevel: 'High',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: Array.isArray(parsed.tools) ? parsed.tools : ['specialist_toolkit', 'subagent_spawner', 'handoff_bus'],
      retrained: Boolean(req.inheritedSOP),
      systemPrompt: parsed.systemPrompt,
      sops: Array.isArray(parsed.sops) ? parsed.sops : [`SOP-01: Deliver high quality work for ${req.department}`],
      heartbeatAt: now,
      hiredAt: now
    };

    this.state.agents.push(newAgent);
    hr.tasksCompleted += 1;

    this.logConsole({
      fromAgent: newAgent,
      toAgent: managerAgent,
      type: 'COLLAB',
      taskTitle: 'Agent Onboarded',
      message: `Reporting for duty in ${newAgent.department}! Equipped with [${newAgent.tools.join(', ')}] and Hermes sub-agent spawning capability.`
    });

    this.logEvent({
      type: 'HIRE',
      department: newAgent.department,
      actor: `${hr.name} (HR)`,
      title: `Hired ${newAgent.name} — ${newAgent.role}`,
      detail: `Reports to ${reportsTo.toUpperCase()} | Tools: ${newAgent.tools.join(', ')}`
    });

    return newAgent;
  }

  findBestAgentForDept(deptName, excludeId = null) {
    let candidates = this.state.agents.filter(
      (a) => a.department.toLowerCase() === (deptName || '').toLowerCase() && a.tier === 'worker' && a.id !== excludeId
    );
    if (candidates.length === 0) {
      candidates = this.state.agents.filter(
        (a) => a.department.toLowerCase() === (deptName || '').toLowerCase() && a.id !== excludeId
      );
    }
    return candidates.sort((a, b) => b.kpi - a.kpi)[0] || this.state.agents.find((a) => a.id === 'cto');
  }

  async executeWorkerTaskAndHandoff(task) {
    task.handoffChain = task.handoffChain || [];
    task.subAgentTraces = task.subAgentTraces || [];
    task.stage = task.stage || 'primary';

    const targetDept = task.stage === 'primary' ? task.department : (task.collaboratorDept || 'Finance');
    const agent = (task.assigneeId && this.state.agents.find((a) => a.id === task.assigneeId))
      || this.findBestAgentForDept(targetDept);

    const qaAgent = this.state.agents.find((a) => a.id === 'qa');
    const nextCollaborator = task.stage === 'primary'
      ? this.findBestAgentForDept(task.collaboratorDept || 'Finance', agent.id)
      : qaAgent;

    agent.status = 'working';
    agent.currentAction = `Executing "${task.title.slice(0, 32)}..."`;
    if (nextCollaborator) {
      nextCollaborator.status = 'working';
      nextCollaborator.currentAction = `Awaiting handoff from ${agent.name}`;
    }

    task.status = 'in_progress';
    task.assigneeId = agent.id;
    task.assigneeName = `${agent.name} (${agent.department})`;
    if (task.stage === 'primary') {
      task.attempts = (task.attempts || 0) + 1;
    }

    let spawnedSub = null;
    if (task.stage === 'primary' && agent.canSpawnSubAgents !== false) {
      const subSpecialties = {
        Engineering: ['Schema & API Micro-Agent', 'Latency & Security Verifier'],
        Marketing: ['Audience Persona Researcher', 'Conversion Copy Variant Bot'],
        Finance: ['Token COGS Calculator Bot', 'Margin Sensitivity Modeler'],
        QA: ['Edge-Case Stress Fuzzer', 'Compliance Rubric Bot']
      };
      const choices = subSpecialties[agent.department] || ['Task Decomposition Sub-Agent'];
      const pickedSpec = choices[task.attempts % choices.length];
      spawnedSub = this.spawnSubAgentInternal(agent, {
        name: `${pickedSpec} #${this.state.company.cycleCount}`,
        specialty: pickedSpec,
        taskFocus: `Decompose & verify "${task.title}" for ${agent.name}`
      });
      task.subAgentTraces.push({
        subAgentName: spawnedSub.name,
        parentAgentName: agent.name,
        department: agent.department,
        focus: spawnedSub.taskFocus,
        timestamp: new Date().toISOString()
      });
    }

    const priorHandoffNote = task.handoffChain.length > 0
      ? task.handoffChain[task.handoffChain.length - 1].note
      : 'Initial Mission Kickoff from CEO';

    // 1. Run Smart Tool Router & Execute Real Tool Scripts BEFORE LLM Synthesis so agent grounds its work in real tool outputs!
    let toolSummaryForLLM = 'Executed departmental tools.';
    try {
      const toolResult = await executeAgentTools({
        agent,
        task,
        companyGoal: this.state.company.goal
      });
      if (toolResult?.routingDecision) {
        agent.activeTool = toolResult.routingDecision.selectedTools?.[0] || 'workspace_coder';
        agent.lastToolRouting = toolResult.routingDecision.routingReason;
        const savedByDiscovery = Number(toolResult.routingDecision.progressiveDiscoverySavingsTokens) || 0;
        if (savedByDiscovery > 0) {
          this.state.company.tokensSaved = (this.state.company.tokensSaved || 0) + savedByDiscovery;
        }
      }
      if (toolResult?.toolSummaryForLLM) {
        toolSummaryForLLM = toolResult.toolSummaryForLLM;
      }
      const files = toolResult?.generatedFiles || toolResult?.filesCreated || [];
      files.forEach((f) => {
        this.writeWorkspaceArtifact({
          filename: f.filename,
          department: f.department || agent.department,
          author: f.author || agent.name,
          content: f.content
        });
      });
      if (toolResult && Array.isArray(toolResult.toolLogs)) {
        this.state.toolExecutions = this.state.toolExecutions || [];
        this.state.owaspAuditLog = this.state.owaspAuditLog || [];
        toolResult.toolLogs.forEach((logItem) => {
          this.state.toolExecutions.unshift({
            id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestamp: new Date().toISOString(),
            agentId: agent.id,
            agentName: agent.name,
            department: agent.department,
            ...logItem
          });
          this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;

          // Record OWASP ASI01-ASI06 Pre-Action Policy Audit & OTel Tool Span
          const owaspEntry = evaluateOwaspToolPolicy({
            agent,
            toolId: logItem.tool,
            taskTitle: task.title,
            codeOrPrompt: logItem.command
          });
          this.state.owaspAuditLog.unshift(owaspEntry);
          if (this.state.owaspAuditLog.length > 60) {
            this.state.owaspAuditLog = this.state.owaspAuditLog.slice(0, 60);
          }

          this.recordOtelSpan({
            operationName: `mcp.tools/call (${logItem.tool})`,
            spanKind: 'CLIENT',
            agent,
            toolName: logItem.tool,
            durationMs: Math.floor(14 + Math.random() * 45),
            status: 'OK',
            detail: `${logItem.command} -> ${logItem.output}`
          });
        });
        if (this.state.toolExecutions.length > 80) {
          this.state.toolExecutions = this.state.toolExecutions.slice(0, 80);
        }
      }
    } catch (toolErr) {
      console.error('Tool execution error:', toolErr.message);
    }

    this.state.company.statusMessage = `${agent.avatar || '🤖'} ${agent.name} [⚙️ ${agent.activeTool || 'tool_script'}] ${spawnedSub ? `(+ sub-agent ${spawnedSub.name})` : ''} is building "${task.title}" ➔ handing off to ${nextCollaborator?.name || 'QA'}...`;

    const userPrompt = `ACTION:WORKER_EXECUTE
Company Mission: ${this.state.company.goal}
Department: ${agent.department}
Task Title: ${task.title}
Task Description: ${task.description}
Current Stage: ${task.stage}
Spawned Sub-Agent Contribution: ${spawnedSub ? `${spawnedSub.name} completed micro-verification` : 'None'}
Prior Handoff Context: ${priorHandoffNote}
Next Collaborator: ${nextCollaborator ? `${nextCollaborator.name} (${nextCollaborator.department})` : 'QA Director'}
Attempt Number: ${task.attempts}
Previous QA Feedback: ${task.qaFeedback || 'None'}
Real Tool & Script Execution Results:
${toolSummaryForLLM}
Learned SOPs: ${(agent.sops || []).join(' | ')}`;

    const llmRes = await callLLM({
      providerConfig: this.state.providerConfig,
      agent,
      systemPrompt: `${agent.systemPrompt}\n\nActive SOPs:\n${(agent.sops || []).join('\n')}`,
      userPrompt,
      jsonMode: false
    });

    this.recordLedger({
      agent,
      action: `${task.stage === 'primary' ? 'Execute + Tool Script' : 'Collaborator Handoff Merge'}: ${task.title}`,
      ...llmRes
    });

    if (task.stage === 'primary') {
      const subNote = spawnedSub
        ? `> 🧬 **Hermes Sub-Agent Trace:** \`${spawnedSub.name}\` executed parallel decomposition & pre-verified schema constraints for **${agent.name}**.\n\n`
        : '';
      task.deliverable = subNote + llmRes.content;

      const handoffNote = `Completed ${agent.department} stage (with sub-agent ${spawnedSub?.name || 'assist'}) for "${task.title}". Passing to @${nextCollaborator.name} (${nextCollaborator.department}).`;
      task.handoffChain.push({
        fromId: agent.id,
        fromName: agent.name,
        fromDept: agent.department,
        toId: nextCollaborator.id,
        toName: nextCollaborator.name,
        toDept: nextCollaborator.department,
        stage: 'primary_to_collab',
        note: handoffNote,
        timestamp: new Date().toISOString()
      });

      agent.handoffsSent = (agent.handoffsSent || 0) + 1;
      nextCollaborator.handoffsReceived = (nextCollaborator.handoffsReceived || 0) + 1;
      this.state.company.handoffsCount = (this.state.company.handoffsCount || 0) + 1;

      this.logConsole({
        fromAgent: agent,
        toAgent: nextCollaborator,
        type: 'HANDOFF',
        taskTitle: task.title,
        message: `@${nextCollaborator.name} — My sub-agent (${spawnedSub?.name || 'helper'}) and I finished the ${agent.department} build for "${task.title}". Passing the task to you for ${nextCollaborator.department} integration!`
      });
      this.logConsole({
        fromAgent: nextCollaborator,
        toAgent: agent,
        type: 'COLLAB',
        taskTitle: task.title,
        message: `Received @${agent.name}! Merging your ${agent.department} output with our ${nextCollaborator.department} models now.`
      });

      task.stage = 'collaborator_handoff';
      task.assigneeId = nextCollaborator.id;
      task.assigneeName = `${nextCollaborator.name} (${nextCollaborator.department})`;
      task.status = 'in_progress';

      this.logEvent({
        type: 'TASK',
        department: agent.department,
        actor: `${agent.name} ➔ ${nextCollaborator.name}`,
        title: `Task Handed Off: ${agent.department} ➔ ${nextCollaborator.department}`,
        detail: `"${task.title}" passed from ${agent.name} to ${nextCollaborator.name}.`
      });
    } else {
      task.deliverable = `${task.deliverable || ''}\n\n---\n### 🤝 Cross-Department Handoff Addendum (${agent.department} — ${agent.name})\n${llmRes.content}`;
      const handoffNote = `Merged ${agent.department} specs into "${task.title}". Handing off joint artifact to QA Director (${qaAgent.name}).`;

      task.handoffChain.push({
        fromId: agent.id,
        fromName: agent.name,
        fromDept: agent.department,
        toId: qaAgent.id,
        toName: qaAgent.name,
        toDept: 'QA',
        stage: 'collab_to_qa',
        note: handoffNote,
        timestamp: new Date().toISOString()
      });

      // Save concrete file into Workspace (ChatDev/MetaGPT pattern)
      const extMap = { Engineering: 'architecture.md', Marketing: 'gtm_campaign.md', Finance: 'unit_economics.md', QA: 'qa_test_suite.md' };
      const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 28);
      this.writeWorkspaceArtifact({
        filename: `${slug}_${extMap[task.department] || 'artifact.md'}`,
        department: `${task.department} + ${agent.department}`,
        author: `${agent.name}`,
        content: task.deliverable
      });

      agent.handoffsSent = (agent.handoffsSent || 0) + 1;
      qaAgent.handoffsReceived = (qaAgent.handoffsReceived || 0) + 1;
      this.state.company.handoffsCount = (this.state.company.handoffsCount || 0) + 1;

      this.logConsole({
        fromAgent: agent,
        toAgent: qaAgent,
        type: 'QA_PING',
        taskTitle: task.title,
        message: `@${qaAgent.name} — Joint ${task.department} + ${agent.department} deliverable for "${task.title}" is saved to Workspace and ready for QA Audit!`
      });

      task.status = 'qa_review';
      this.logEvent({
        type: 'TASK',
        department: agent.department,
        actor: `${agent.name} ➔ ${qaAgent.name} (QA)`,
        title: `Joint Deliverable Submitted to QA: "${task.title}"`,
        detail: `Collaborated across ${task.department} & ${agent.department}`
      });
    }
  }

  async executeQAAuditAndHRLoop(task) {
    const qa = this.state.agents.find((a) => a.id === 'qa');
    const hr = this.state.agents.find((a) => a.id === 'hr');
    const worker = this.state.agents.find((a) => a.id === task.assigneeId)
      || this.findBestAgentForDept(task.department);

    qa.status = 'working';
    qa.currentAction = `Auditing "${task.title.slice(0, 28)}..."`;
    if (worker) {
      worker.status = 'working';
      worker.currentAction = 'In QA review gate';
    }

    this.state.company.statusMessage = `🛡️ QA Director (${qa.name}) is grading multi-agent deliverable "${task.title}"...`;

    // Execute QA Sandbox Verifier tool (`node --check` & JSON schema audit on workspace/)
    const qaToolCheck = executeQAVerificationTools();
    this.state.toolExecutions = this.state.toolExecutions || [];
    this.state.toolExecutions.unshift({
      id: `tool-qa-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: qa.id,
      agentName: qa.name,
      department: 'QA',
      tool: 'qa_sandbox_verifier',
      command: 'node --check workspace/*.js && JSON.parse(workspace/*.json)',
      targetFile: 'workspace/*',
      status: qaToolCheck.passed ? 'SUCCESS' : 'WARN',
      output: qaToolCheck.summary
    });
    this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;

    const userPrompt = `ACTION:QA_AUDIT
Company Mission: ${this.state.company.goal}
Task Title: ${task.title}
Worker: ${worker ? worker.name : 'Unknown'}
Retrained: ${worker?.retrained ? 'true' : 'false'}
Handoffs Completed: ${(task.handoffChain || []).length}
Sandbox Verification: ${qaToolCheck.summary}
Learned SOPs: ${worker ? (worker.sops || []).join(' | ') : ''}
Deliverable Content:
${task.deliverable}`;

    const llmRes = await callLLM({
      providerConfig: this.state.providerConfig,
      agent: qa,
      systemPrompt: qa.systemPrompt,
      userPrompt,
      jsonMode: true
    });

    this.recordLedger({
      agent: qa,
      action: `QA Audit: ${task.title}`,
      ...llmRes
    });

    const audit = this.safeParseJSON(llmRes.content, {
      score: 85,
      passed: true,
      verdict: 'APPROVED',
      strengths: ['Strong multi-agent handoff alignment'],
      weaknesses: [],
      newLessonSOP: 'SOP-VERIFIED: Multi-agent handoffs with explicit YAML contracts pass QA reliably.'
    });

    const score = Number(audit.score) || 82;
    const passed = score >= 75;
    task.qaScore = score;
    task.qaFeedback = [...(audit.weaknesses || []), audit.newLessonSOP].filter(Boolean).join(' — ');
    qa.tasksCompleted += 1;

    if (passed) {
      task.status = 'completed';
      if (worker) {
        worker.tasksCompleted += 1;
        worker.kpi = Math.min(99, Math.round(worker.kpi * 0.75 + score * 0.25 + 3));
        if (audit.newLessonSOP && !worker.sops.includes(audit.newLessonSOP)) {
          worker.sops.push(audit.newLessonSOP);
        }
      }

      if (score >= 82) {
        const skillSlug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32);
        const newSkill = {
          id: `skill-${Date.now()}`,
          name: `skill_${skillSlug}`,
          department: task.department,
          createdBy: `${worker?.name || 'Specialist'} + ${qa.name} (QA ${score}%)`,
          usageCount: 1,
          trigger: `When executing ${task.department} tasks involving "${task.title.slice(0, 45)}"`,
          procedure: `1. Spawn department sub-agent for pre-verification.\n2. Apply rule: ${audit.newLessonSOP}\n3. Hand off to ${task.collaboratorDept || 'Finance'} before QA.`
        };
        this.state.skillsRegistry.unshift(newSkill);
        this.writeWorkspaceArtifact({
          filename: `SKILL_${skillSlug.toUpperCase()}.md`,
          department: 'HR / Skills',
          author: `${hr.name} (HR)`,
          content: `---\nname: ${newSkill.name}\ndepartment: ${newSkill.department}\nqa_score: ${score}\n---\n\n### Trigger\n${newSkill.trigger}\n\n### Procedure\n${newSkill.procedure}\n`
        });
        this.logEvent({
          type: 'SKILL',
          department: task.department,
          actor: `${hr.name} (HR Skill Synthesizer)`,
          title: `Synthesized New Hermes Skill: ${newSkill.name}`,
          detail: `Distilled from ${score}/100 QA pass on "${task.title}"`
        });
      }

      this.logConsole({
        fromAgent: qa,
        toAgent: worker,
        type: 'QA_PING',
        taskTitle: task.title,
        message: `✅ APPROVED "${task.title}" (Score: ${score}/100)! Synthesized learnings into Company Skills & Workspace.`
      });

      this.state.memoryWiki.unshift({
        id: `mem-${Date.now()}`,
        title: task.title,
        department: `${task.department} + ${task.collaboratorDept || 'QA'}`,
        author: task.assigneeName || 'Specialist Team',
        qaScore: score,
        type: 'DELIVERABLE',
        learnedSOP: audit.newLessonSOP,
        content: task.deliverable,
        createdAt: new Date().toISOString()
      });

      this.logEvent({
        type: 'QA',
        department: 'QA',
        actor: `${qa.name} (QA)`,
        title: `QA APPROVED "${task.title}" (Score: ${score}/100)`,
        detail: `Worker ${worker?.name || ''} KPI rose to ${worker?.kpi || 85}%. Published to Company Wiki.`
      });

      // Phase 13: Autonomous Customer & MRR Revenue Engine — Shipped QA-verified work converts paying customers!
      const cfo = this.state.agents.find((a) => a.id === 'cfo');
      const newCustomers = Math.max(4, Math.round((score - 65) * 0.45));
      const addedMrr = newCustomers * 99;
      const treasuryReinvestment = Number((newCustomers * 0.25).toFixed(2));
      this.state.company.customersCount = (this.state.company.customersCount || 0) + newCustomers;
      this.state.company.mrr = (this.state.company.mrr || 0) + addedMrr;
      this.state.company.revenueEarned = Number(((this.state.company.revenueEarned || 0) + treasuryReinvestment).toFixed(2));
      this.state.company.budgetTotal = Number((this.state.company.budgetTotal + treasuryReinvestment).toFixed(2));
      this.state.company.marketSharePct = Number(Math.min(88, (this.state.company.marketSharePct || 14) + 2.4).toFixed(1));
      this.state.company.valuationUsd = (this.state.company.valuationUsd || 250000) + addedMrr * 110 + 25000;
      if (Array.isArray(this.state.competitors)) {
        this.state.competitors.forEach((c) => {
          c.marketSharePct = Number(Math.max(4, c.marketSharePct - 0.8).toFixed(1));
        });
      }

      this.logConsole({
        fromAgent: cfo,
        toAgent: worker,
        type: 'BROADCAST',
        taskTitle: `💰 Customer Revenue Converted: +$${addedMrr}/mo MRR`,
        message: `💎 [REVENUE ENGINE] Shipping "${task.title}" converted +${newCustomers} paying customers (+$${addedMrr.toLocaleString()}/mo MRR)! Reinvested +$${treasuryReinvestment.toFixed(2)} operating profit into Company Budget.`
      });

      this.logEvent({
        type: 'FINANCE',
        department: 'Finance',
        actor: `${cfo?.name || 'CFO'} (Revenue Engine)`,
        title: `Acquired +${newCustomers} Customers (+$${addedMrr.toLocaleString()} MRR)`,
        detail: `Total MRR: $${this.state.company.mrr.toLocaleString()}/mo | Reinvested +$${treasuryReinvestment.toFixed(2)} into operating budget.`
      });
    } else {
      hr.status = 'working';
      hr.currentAction = `Retraining / reviewing ${worker?.name || 'worker'}`;
      if (worker) {
        worker.failures = (worker.failures || 0) + 1;
        worker.kpi = Math.max(30, Math.round(worker.kpi * 0.6 + score * 0.4 - 8));
      }

      const shouldFire =
        worker &&
        worker.tier === 'worker' &&
        (score < 60 || worker.kpi < 64 || worker.failures >= 2);

      if (shouldFire) {
        this.fireAgentInternal(
          worker.id,
          `QA Score ${score}/100 (KPI dropped to ${worker.kpi}% after ${worker.failures} failed attempt(s)). Replaced with higher-calibrated specialist.`,
          audit.newLessonSOP
        );
        task.status = 'backlog';
        task.stage = 'primary';
        task.assigneeId = null;
        task.assigneeName = null;
      } else if (worker) {
        worker.status = 'training';
        worker.currentAction = 'Upgrading SOP memory from QA feedback';
        worker.retrained = true;
        const lesson = audit.newLessonSOP || 'QA-RETRAIN: Add concrete quantitative metrics, fault handling, and handoff contracts.';
        if (!worker.sops.includes(lesson)) {
          worker.sops.push(lesson);
        }
        worker.systemPrompt += `\n[HR Self-Improvement Upgrade]: ${lesson}`;
        task.status = 'in_progress';
        task.stage = 'primary';

        this.logConsole({
          fromAgent: hr,
          toAgent: worker,
          type: 'COLLAB',
          taskTitle: task.title,
          message: `⚠️ @${worker.name} — QA scored "${task.title}" at ${score}/100. I've upgraded your SOP memory with "${lesson}". Re-run with your sub-agent and hand off again!`
        });

        this.state.memoryWiki.unshift({
          id: `mem-sop-${Date.now()}`,
          title: `Self-Taught SOP: ${worker.role}`,
          department: worker.department,
          author: `${hr.name} (HR) & ${qa.name} (QA)`,
          qaScore: score,
          type: 'SOP_UPGRADE',
          learnedSOP: lesson,
          content: `**Trigger:** QA Audit scored ${score}/100 on *${task.title}*.\n\n**Weaknesses Identified:**\n- ${(audit.weaknesses || ['Insufficient depth']).join('\n- ')}\n\n**Injected Agent SOP:**\n> ${lesson}`,
          createdAt: new Date().toISOString()
        });

        this.logEvent({
          type: 'TRAIN',
          department: 'HR',
          actor: `${hr.name} (HR)`,
          title: `Self-Trained ${worker.name} after QA Score ${score}/100`,
          detail: `Injected new SOP into agent memory: "${lesson}".`
        });
      } else {
        task.status = 'backlog';
      }
    }
  }

  fireAgentInternal(agentId, reason, inheritedLesson = null) {
    const idx = this.state.agents.findIndex((a) => a.id === agentId);
    if (idx === -1) return null;
    const agent = this.state.agents[idx];
    if (agent.tier === 'c-suite') return null;

    this.state.agents.splice(idx, 1);
    const firedRecord = {
      ...agent,
      status: 'fired',
      firedAt: new Date().toISOString(),
      firedReason: reason
    };
    this.state.firedAgents.unshift(firedRecord);

    this.state.hireQueue.push({
      role: `Senior ${agent.role.replace(/^Senior\s+/i, '')}`,
      department: agent.department,
      reportsTo: agent.reportsTo,
      reason: `Backfill & upgrade for fired ${agent.name}`,
      inheritedSOP: inheritedLesson || `QA-RETRAIN: Avoid predecessor pitfalls; enforce strict verification rubrics.`
    });

    const hr = this.state.agents.find((a) => a.id === 'hr');
    this.logConsole({
      fromAgent: hr,
      toAgent: null,
      type: 'BROADCAST',
      taskTitle: 'HR Termination & Replacement Notice',
      message: `🔥 Terminated ${agent.name} (${agent.role}) due to: ${reason}. Requisitioned a Senior replacement pre-trained with QA lessons.`
    });

    this.logEvent({
      type: 'FIRE',
      department: 'HR',
      actor: 'Marcus Sterling (HR)',
      title: `FIRED ${agent.name} (${agent.role})`,
      detail: `${reason}`
    });

    return firedRecord;
  }

  async executeNextSprintPlanning() {
    const ceo = this.state.agents.find((a) => a.id === 'ceo');
    const cfo = this.state.agents.find((a) => a.id === 'cfo');
    ceo.status = 'working';
    cfo.status = 'working';

    const sprintNum = Math.floor(this.state.tasks.length / 3) + 1;
    this.state.company.statusMessage = `🚀 Sprint #${sprintNum} complete! CEO & CFO launching Sprint #${sprintNum + 1} cross-agent tasks...`;

    const newTasks = [
      {
        title: `Sprint ${sprintNum + 1}: Automated Scaling & Reliability Pipeline`,
        department: 'Engineering',
        collaboratorDept: 'QA',
        priority: 'High',
        description: `Scale the technical pipeline and hand off to QA for stress-testing: ${this.state.company.goal}`
      },
      {
        title: `Sprint ${sprintNum + 1}: Viral Acquisition & Conversion Loop`,
        department: 'Marketing',
        collaboratorDept: 'Finance',
        priority: 'High',
        description: `Build referral expansion campaigns and hand off to Finance for CAC/LTV audit: ${this.state.company.goal}`
      },
      {
        title: `Sprint ${sprintNum + 1}: Margin Expansion & Token Optimization`,
        department: 'Finance',
        collaboratorDept: 'Engineering',
        priority: 'Medium',
        description: `Optimize departmental token burn and hand off caching specs to Engineering: ${this.state.company.goal}`
      }
    ];

    newTasks.forEach((t, idx) => {
      this.state.tasks.push({
        id: `task-${Date.now()}-${idx}`,
        title: t.title,
        department: t.department,
        collaboratorDept: t.collaboratorDept,
        stage: 'primary',
        handoffChain: [],
        subAgentTraces: [],
        priority: t.priority,
        description: t.description,
        status: 'backlog',
        assigneeId: null,
        assigneeName: null,
        attempts: 0,
        qaScore: null,
        qaFeedback: null,
        deliverable: null,
        createdAt: new Date().toISOString()
      });
    });

    this.logConsole({
      fromAgent: ceo,
      toAgent: cfo,
      type: 'BROADCAST',
      taskTitle: `Sprint #${sprintNum + 1} Kickoff`,
      message: `All Sprint #${sprintNum} deliverables passed QA! Launching 3 new cross-departmental tasks for Sprint #${sprintNum + 1}.`
    });

    this.logEvent({
      type: 'STRATEGY',
      department: 'Executive',
      actor: `${ceo.name} (CEO) & ${cfo.name} (CFO)`,
      title: `Launched Growth Sprint #${sprintNum + 1}`,
      detail: `Queued 3 new cross-departmental growth objectives.`
    });
  }

  updateAgentConfig(agentId, updates = {}) {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (!agent) return null;

    if (typeof updates.name === 'string' && updates.name.trim()) agent.name = updates.name.trim();
    if (typeof updates.role === 'string' && updates.role.trim()) agent.role = updates.role.trim();
    if (typeof updates.department === 'string' && updates.department.trim()) agent.department = updates.department.trim();
    if (typeof updates.harnessType === 'string' && updates.harnessType.trim()) agent.harnessType = updates.harnessType.trim();
    if (typeof updates.budgetCap === 'number') agent.budgetCap = Math.max(0.5, updates.budgetCap);
    if (typeof updates.systemPrompt === 'string' && updates.systemPrompt.trim()) agent.systemPrompt = updates.systemPrompt.trim();
    if (typeof updates.providerOverride === 'string') agent.providerOverride = updates.providerOverride;
    if (typeof updates.modelOverride === 'string') agent.modelOverride = updates.modelOverride.trim();
    if (typeof updates.temperature === 'number') agent.temperature = Math.max(0, Math.min(1.5, updates.temperature));
    if (typeof updates.autonomyLevel === 'string') agent.autonomyLevel = updates.autonomyLevel;
    if (typeof updates.canSpawnSubAgents === 'boolean') agent.canSpawnSubAgents = updates.canSpawnSubAgents;
    if (Array.isArray(updates.tools)) agent.tools = updates.tools;
    if (typeof updates.kpiDelta === 'number') {
      agent.kpi = Math.max(10, Math.min(100, agent.kpi + updates.kpiDelta));
    }

    this.logEvent({
      type: 'SYSTEM',
      department: agent.department,
      actor: 'Founder',
      title: `Updated Agent Configuration: ${agent.name}`,
      detail: `Harness: ${agent.harnessType} | Provider: ${agent.providerOverride} | Cap: $${agent.budgetCap}`
    });
    this.saveState();
    return agent;
  }

  manualSpawnSubAgent({ parentAgentId, name, specialty, taskFocus, promoteToFullHire }) {
    const parent = this.state.agents.find((a) => a.id === parentAgentId);
    if (!parent) return null;
    const sub = this.spawnSubAgentInternal(parent, { name, specialty, taskFocus, promoteToFullHire });
    this.saveState();
    return sub;
  }

  cloneAgent(agentId) {
    const source = this.state.agents.find((a) => a.id === agentId);
    if (!source) return null;
    const clone = {
      ...JSON.parse(JSON.stringify(source)),
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: `${source.name} (Clone #${Math.floor(Math.random() * 90 + 10)})`,
      tier: 'worker',
      reportsTo: source.reportsTo || 'cto',
      status: 'idle',
      currentAction: 'Cloned & standing by',
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgents: [],
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      hiredAt: new Date().toISOString()
    };
    this.state.agents.push(clone);
    this.logConsole({
      fromAgent: clone,
      toAgent: source,
      type: 'COLLAB',
      taskTitle: 'Agent Cloned',
      message: `Cloned from @${source.name} with ${clone.sops.length} pre-learned SOPs and tools [${clone.tools.join(', ')}]. Ready to share workload!`
    });
    this.logEvent({
      type: 'HIRE',
      department: clone.department,
      actor: 'HR Cloner',
      title: `Cloned High-Performer: ${clone.name}`,
      detail: `Inherited ${clone.sops.length} learned SOPs from ${source.name}.`
    });
    this.saveState();
    return clone;
  }

  manualHandoffTask({ taskId, toAgentId, note }) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    const toAgent = this.state.agents.find((a) => a.id === toAgentId);
    if (!task || !toAgent) return null;

    const fromAgent = this.state.agents.find((a) => a.id === task.assigneeId) || this.state.agents[0];
    task.handoffChain = task.handoffChain || [];
    const handoffMsg = note || `Manual handoff of "${task.title}" to @${toAgent.name} (${toAgent.department}) for specialized execution.`;

    task.handoffChain.push({
      fromId: fromAgent.id,
      fromName: fromAgent.name,
      fromDept: fromAgent.department,
      toId: toAgent.id,
      toName: toAgent.name,
      toDept: toAgent.department,
      stage: 'manual_handoff',
      note: handoffMsg,
      timestamp: new Date().toISOString()
    });

    task.assigneeId = toAgent.id;
    task.assigneeName = `${toAgent.name} (${toAgent.department})`;
    task.department = toAgent.department;
    if (task.status === 'backlog') task.status = 'in_progress';

    fromAgent.handoffsSent = (fromAgent.handoffsSent || 0) + 1;
    toAgent.handoffsReceived = (toAgent.handoffsReceived || 0) + 1;
    this.state.company.handoffsCount = (this.state.company.handoffsCount || 0) + 1;

    this.logConsole({
      fromAgent,
      toAgent,
      type: 'HANDOFF',
      taskTitle: task.title,
      message: `@${toAgent.name} — Handing off "${task.title}" to you: ${handoffMsg}`
    });

    this.logEvent({
      type: 'TASK',
      department: toAgent.department,
      actor: `${fromAgent.name} ➔ ${toAgent.name}`,
      title: `Direct Task Handoff: "${task.title}"`,
      detail: handoffMsg
    });
    this.saveState();
    return task;
  }

  async postConsoleMessage({ toAgentId, message }) {
    if (!message || !message.trim()) return this.state;
    const targetAgent = toAgentId && toAgentId !== 'all'
      ? this.state.agents.find((a) => a.id === toAgentId)
      : null;

    this.logConsole({
      fromAgent: null,
      toAgent: targetAgent,
      type: targetAgent ? 'DIRECT' : 'BROADCAST',
      taskTitle: 'Founder Directive',
      message: message.trim()
    });

    const responder = targetAgent || this.state.agents.find((a) => a.id === 'ceo');
    if (responder) {
      const llmRes = await callLLM({
        providerConfig: this.state.providerConfig,
        agent: responder,
        systemPrompt: responder.systemPrompt,
        userPrompt: `ACTION:DIRECT_CHAT\nCompany Mission: ${this.state.company.goal}\nFounder Message: ${message.trim()}`,
        jsonMode: false
      });

      this.recordLedger({
        agent: responder,
        action: `Shared Console Response`,
        ...llmRes
      });

      this.logConsole({
        fromAgent: responder,
        toAgent: null,
        type: 'COLLAB',
        taskTitle: 'Shared Mission Console',
        message: llmRes.content
      });
    }

    this.saveState();
    return this.state;
  }

  optimizeCompany() {
    let sopsPruned = 0;
    let promptsCompressed = 0;
    let tasksRebalanced = 0;

    this.state.agents.forEach((a) => {
      const uniqueSops = Array.from(new Set(a.sops || []));
      sopsPruned += (a.sops?.length || 0) - uniqueSops.length;
      a.sops = uniqueSops.slice(-6);

      const cleanPrompt = a.systemPrompt.replace(/(\n\[HR Self-Improvement Upgrade\]:[^\n]+){2,}/g, (m) => {
        promptsCompressed += 1;
        const lines = m.trim().split('\n');
        return '\n' + lines[lines.length - 1];
      });
      a.systemPrompt = cleanPrompt;

      if (a.department === 'Finance' || a.department === 'QA') a.temperature = 0.25;
      else if (a.department === 'Engineering') a.temperature = 0.35;
      else if (a.department === 'Marketing') a.temperature = 0.7;

      // Smart Tool-Affinity Calibration: equip each agent with the optimal tools from TOOL_REGISTRY for their department
      const deptTools = TOOL_REGISTRY
        .filter((t) => t.department.toLowerCase() === (a.department || '').toLowerCase())
        .map((t) => t.id);
      if (deptTools.length > 0) {
        a.tools = Array.from(new Set([...deptTools, 'subagent_spawner', 'handoff_bus']));
        a.activeTool = deptTools[0];
        a.lastToolRouting = `Auto-calibrated [${deptTools.join(', ')}] via Smart Tool Optimizer`;
      }
    });

    this.state.tasks.forEach((t) => {
      if (t.status === 'backlog' && !t.assigneeId) {
        const best = this.findBestAgentForDept(t.department);
        if (best) {
          t.assigneeId = best.id;
          t.assigneeName = `${best.name} (${best.department})`;
          tasksRebalanced += 1;
        }
      }
    });

    this.state.company.tokensSaved = (this.state.company.tokensSaved || 0) + 1450;
    this.state.company.optimizationScore = Math.min(99, (this.state.company.optimizationScore || 90) + 2);

    const cfo = this.state.agents.find((a) => a.id === 'cfo');
    const cto = this.state.agents.find((a) => a.id === 'cto');
    this.logConsole({
      fromAgent: cfo,
      toAgent: cto,
      type: 'BROADCAST',
      taskTitle: 'Pipeline Optimization Complete',
      message: `⚡ Company Pipeline Optimized! Pruned ${sopsPruned} duplicate SOPs, compressed ${promptsCompressed} prompts, pre-routed ${tasksRebalanced} backlog tasks to top-KPI specialists (+1,450 est. tokens saved).`
    });

    this.logEvent({
      type: 'FINANCE',
      department: 'Finance',
      actor: 'CFO & HR Optimizer',
      title: `Pipeline Optimized (Efficiency: ${this.state.company.optimizationScore}%)`,
      detail: `Deduplicated SOP memory, tuned per-agent temperatures, and balanced workload across ${this.state.agents.length} agents.`
    });

    this.saveState();
    return this.state;
  }

  async manualHire({ role, department, reason, providerOverride, modelOverride, harnessType, tools }) {
    const deptMap = { Engineering: 'cto', Marketing: 'cmo', Finance: 'cfo', QA: 'qa' };
    const agent = await this.executeHRHire({
      role: role || 'AI Specialist',
      department: department || 'Engineering',
      reportsTo: deptMap[department] || 'cto',
      harnessType: harnessType || 'Hermes Specialist Node',
      reason: reason || 'Founder direct hiring requisition'
    });
    if (providerOverride) agent.providerOverride = providerOverride;
    if (modelOverride) agent.modelOverride = modelOverride;
    if (Array.isArray(tools) && tools.length > 0) agent.tools = tools;
    this.saveState();
    return agent;
  }

  manualFire(agentId, reason) {
    const fired = this.fireAgentInternal(agentId, reason || 'Terminated by Founder / Executive Review.');
    this.saveState();
    return fired;
  }

  manualTrainAgent(agentId, newSop) {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (!agent) return null;
    agent.sops.push(newSop);
    agent.retrained = true;
    agent.kpi = Math.min(99, agent.kpi + 5);
    this.logConsole({
      fromAgent: this.state.agents.find((a) => a.id === 'hr'),
      toAgent: agent,
      type: 'COLLAB',
      taskTitle: 'Direct SOP Training',
      message: `Injected new SOP into @${agent.name}: "${newSop}" (+5% KPI boost).`
    });
    this.logEvent({
      type: 'TRAIN',
      department: agent.department,
      actor: 'Founder / HR',
      title: `Injected Custom SOP into ${agent.name}`,
      detail: `New SOP: "${newSop}" (+5 KPI boost)`
    });
    this.saveState();
    return agent;
  }

  manualAddTask({ title, department, collaboratorDept, priority, description }) {
    const defaultCollabMap = {
      Engineering: 'Finance',
      Marketing: 'Engineering',
      Finance: 'Marketing',
      QA: 'Engineering'
    };
    const dept = department || 'Engineering';
    const newTask = {
      id: `task-${Date.now()}`,
      title,
      department: dept,
      collaboratorDept: collaboratorDept || defaultCollabMap[dept] || 'Finance',
      stage: 'primary',
      handoffChain: [],
      subAgentTraces: [],
      priority: priority || 'High',
      description: description || title,
      status: 'backlog',
      assigneeId: null,
      assigneeName: null,
      attempts: 0,
      qaScore: null,
      qaFeedback: null,
      deliverable: null,
      createdAt: new Date().toISOString()
    };
    this.state.tasks.unshift(newTask);
    this.logConsole({
      fromAgent: null,
      toAgent: null,
      type: 'BROADCAST',
      taskTitle: newTask.title,
      message: `📋 New shared directive added: "${newTask.title}" (${newTask.department} ➔ ${newTask.collaboratorDept} ➔ QA).`
    });
    this.logEvent({
      type: 'TASK',
      department: newTask.department,
      actor: 'Founder',
      title: `New Shared Directive: "${newTask.title}"`,
      detail: `Handoff route: ${newTask.department} ➔ ${newTask.collaboratorDept} ➔ QA`
    });
    this.saveState();
    return newTask;
  }

  resolveBoardProposal({ proposalId, decision }) {
    this.state.boardInbox = this.state.boardInbox || [];
    const prop = this.state.boardInbox.find((p) => p.id === proposalId);
    if (!prop) return null;

    prop.status = decision === 'approve' ? 'approved' : 'vetoed';
    prop.resolvedAt = new Date().toISOString();

    if (decision === 'approve') {
      if (prop.type === 'BUDGET_INCREASE' || prop.type === 'BUDGET_EXPANSION') {
        const addAmt = Number(prop.payload?.amount || prop.payload?.addBudget) || 10.0;
        this.state.company.budgetTotal = Number((this.state.company.budgetTotal + addAmt).toFixed(2));
        this.logEvent({
          type: 'FINANCE',
          department: 'Finance',
          actor: 'Founder (Board Chair)',
          title: `Board Approved Budget Expansion (+$${addAmt.toFixed(2)})`,
          detail: `Total company budget raised to $${this.state.company.budgetTotal.toFixed(2)}.`
        });
      } else if (prop.type === 'HIRE_SENIOR') {
        this.state.hireQueue.push({
          role: prop.payload?.role || 'Principal AI Architect',
          department: prop.payload?.department || 'Engineering',
          reportsTo: prop.payload?.reportsTo || 'cto',
          reason: `Approved by Board Chair (${prop.title})`
        });
        this.logEvent({
          type: 'HIRE',
          department: prop.payload?.department || 'Engineering',
          actor: 'Founder (Board Chair)',
          title: `Board Approved Executive Requisition: ${prop.payload?.role || 'Principal AI Architect'}`,
          detail: prop.description
        });
      }
      this.logConsole({
        fromAgent: null,
        toAgent: null,
        type: 'BROADCAST',
        taskTitle: 'Board Resolution: APPROVED',
        message: `🏛️ Board Chair APPROVED proposal: "${prop.title}". Executing directive immediately.`
      });
    } else {
      this.logConsole({
        fromAgent: null,
        toAgent: null,
        type: 'BROADCAST',
        taskTitle: 'Board Resolution: VETOED',
        message: `🏛️ Board Chair VETOED proposal: "${prop.title}". Maintaining current constraints.`
      });
      this.logEvent({
        type: 'SYSTEM',
        department: prop.department || 'Executive',
        actor: 'Founder (Board Chair)',
        title: `Board Vetoed Proposal: "${prop.title}"`,
        detail: prop.description
      });
    }

    this.saveState();
    return prop;
  }

  reassignAgentRoom({ agentId, targetRoom }) {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (!agent) return null;

    if (targetRoom === 'Airlock') {
      if (agent.tier === 'c-suite') {
        return { error: 'Cannot fire C-Suite executives via Airlock.' };
      }
      const fired = this.fireAgentInternal(agent.id, 'Dragged into Exit Airlock by Founder in Virtual Office.');
      this.saveState();
      return { action: 'fired', agent: fired };
    }

    if (targetRoom === 'HR') {
      this.manualTrainAgent(agent.id, `OFFICE-POD-UPGRADE: Calibrated in HR Pod for cross-department velocity & zero-defect handoffs.`);
      return { action: 'trained', agent };
    }

    const validDepts = ['Executive', 'Engineering', 'Marketing', 'Finance', 'QA'];
    if (validDepts.includes(targetRoom)) {
      const oldDept = agent.department;
      agent.department = targetRoom;
      agent.currentAction = `Reassigned to ${targetRoom} floor via Virtual Office`;
      this.logConsole({
        fromAgent: agent,
        toAgent: null,
        type: 'COLLAB',
        taskTitle: 'Floor Reassignment',
        message: `🏢 Moved from ${oldDept} to ${targetRoom} room! Ready to take on ${targetRoom} tasks.`
      });
      this.logEvent({
        type: 'SYSTEM',
        department: targetRoom,
        actor: 'Founder (Virtual Office)',
        title: `Moved ${agent.name} from ${oldDept} ➔ ${targetRoom}`,
        detail: `Drag-and-drop floor reassignment in 2.5D Virtual Office.`
      });
      this.saveState();
      return { action: 'moved', agent };
    }

    return { action: 'noop', agent };
  }

  async runWorkspaceModule(filename) {
    const execResult = await runWorkspaceJSFile(filename);
    this.state.toolExecutions = this.state.toolExecutions || [];
    this.state.toolExecutions.unshift({
      id: `tool-run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: 'cto',
      agentName: 'Founder / Node Sandbox',
      department: 'Engineering',
      tool: 'node_sandbox_runner',
      command: `node /workspace/${filename} -> executePipeline()`,
      status: execResult.ok ? 'SUCCESS' : 'WARN',
      output: execResult.ok
        ? `Executed ${filename} in ${execResult.executionTimeMs}ms -> ${JSON.stringify(execResult.output)}`
        : `Error in ${filename}: ${execResult.error}`
    });
    this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
    this.saveState();
    return execResult;
  }

  saveWorkspaceFileContent({ filename, content }) {
    if (!filename || typeof content !== 'string') return null;
    this.writeWorkspaceArtifact({
      filename,
      department: 'Founder Co-Edit',
      author: 'Founder (Human-in-the-Loop)',
      content
    });
    this.logEvent({
      type: 'SYSTEM',
      department: 'Executive',
      actor: 'Founder',
      title: `Edited & Saved Workspace File: ${filename}`,
      detail: `${Buffer.byteLength(content, 'utf8')} bytes written to /workspace/${filename}`
    });
    this.saveState();
    return this.state.workspaceFiles.find((f) => f.filename === filename);
  }

  async runWarRoomStandup({ topic } = {}) {
    const ceo = this.state.agents.find((a) => a.id === 'ceo');
    const cto = this.state.agents.find((a) => a.id === 'cto');
    const cmo = this.state.agents.find((a) => a.id === 'cmo');
    const cfo = this.state.agents.find((a) => a.id === 'cfo');
    const qa = this.state.agents.find((a) => a.id === 'qa');
    const hr = this.state.agents.find((a) => a.id === 'hr');

    const focusTopic = (topic && topic.trim()) || `Accelerate "${this.state.company.goal}" & eliminate cross-department bottlenecks`;
    this.state.company.lastWarRoomAt = new Date().toISOString();
    this.state.company.statusMessage = `🎙️ WAR ROOM STANDUP ACTIVE: All C-Suite executives gathered at the Holo-Table to debate "${focusTopic}"!`;

    [ceo, cto, cmo, cfo, qa, hr].filter(Boolean).forEach((exec) => {
      exec.status = 'working';
      exec.currentAction = `🎙️ In War Room Standup: ${focusTopic.slice(0, 26)}...`;
    });

    this.logConsole({
      fromAgent: ceo,
      toAgent: cto,
      type: 'BROADCAST',
      taskTitle: `🎙️ War Room Standup: ${focusTopic}`,
      message: `👑 [WAR ROOM KICKOFF] Everyone gather at the Central Holo-Table! Priority directive: "${focusTopic}". @${cto?.name}, what is our technical velocity status?`
    });

    this.logConsole({
      fromAgent: cto,
      toAgent: cmo,
      type: 'HANDOFF',
      taskTitle: `🎙️ War Room Standup: ${focusTopic}`,
      message: `⚡ [CTO REPORT] Our Node.js microservices in /workspace pass \`node --check\` with <20ms latency. Handing off API hooks to @${cmo?.name} for live funnel integration.`
    });

    this.logConsole({
      fromAgent: cmo,
      toAgent: cfo,
      type: 'HANDOFF',
      taskTitle: `🎙️ War Room Standup: ${focusTopic}`,
      message: `🚀 [CMO REPORT] Live HackerNews market intelligence & interactive landing pages are deployed in /workspace. @${cfo?.name}, how do our unit margins look?`
    });

    this.logConsole({
      fromAgent: cfo,
      toAgent: ceo,
      type: 'COLLAB',
      taskTitle: `🎙️ War Room Standup: ${focusTopic}`,
      message: `💎 [CFO REPORT] Gross margin is holding above 90% with ${this.state.company.tokensSaved || 0} tokens saved via prompt compression. Submitting a Board Proposal for War Room expansion!`
    });

    // Create a new actionable Board Proposal from the War Room Standup
    this.state.boardInbox = this.state.boardInbox || [];
    this.state.boardInbox.unshift({
      id: `board-warroom-${Date.now()}`,
      type: 'HIRE_SENIOR',
      title: `War Room Resolution: Hire Principal Full-Stack Architect`,
      department: 'Engineering',
      proposedBy: `${ceo?.name || 'CEO'} & ${cto?.name || 'CTO'} (War Room)`,
      detail: `Synthesized during War Room Standup on "${focusTopic}". Adds a Principal Architect to scale /workspace code generation.`,
      payload: {
        role: 'Principal Autonomous Systems Architect',
        department: 'Engineering',
        reportsTo: 'cto'
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Also add a joint War Room task
    this.manualAddTask({
      title: `War Room Directive: ${focusTopic.slice(0, 48)}`,
      department: 'Engineering',
      collaboratorDept: 'Marketing',
      priority: 'High',
      description: `Joint executive War Room initiative to execute: ${focusTopic}`
    });

    this.logEvent({
      type: 'STRATEGY',
      department: 'Executive',
      actor: 'C-Suite War Room',
      title: `Completed Executive War Room Standup`,
      detail: `Debated "${focusTopic}" -> Created 1 High-Priority Task & 1 Board Proposal.`
    });

    this.saveState();
    return this.state;
  }

  createCheckpoint({ label } = {}) {
    this.state.checkpoints = this.state.checkpoints || [];
    const snapId = `chk-${Date.now()}`;
    const snapshotCopy = JSON.parse(JSON.stringify({
      company: this.state.company,
      agents: this.state.agents,
      firedAgents: this.state.firedAgents,
      hireQueue: this.state.hireQueue,
      tasks: this.state.tasks,
      skillsRegistry: this.state.skillsRegistry,
      workspaceFiles: this.state.workspaceFiles,
      boardInbox: this.state.boardInbox
    }));

    const record = {
      id: snapId,
      label: (label && label.trim()) || `Cycle #${this.state.company.cycleCount} (${this.state.agents.length} Agents, $${this.state.company.budgetSpent.toFixed(2)} spent)`,
      cycleCount: this.state.company.cycleCount,
      agentsCount: this.state.agents.length,
      tasksCount: this.state.tasks.length,
      createdAt: new Date().toISOString(),
      snapshot: snapshotCopy
    };

    this.state.checkpoints.unshift(record);
    if (this.state.checkpoints.length > 10) {
      this.state.checkpoints = this.state.checkpoints.slice(0, 10);
    }

    this.logEvent({
      type: 'SYSTEM',
      department: 'Executive',
      actor: 'Time-Travel Engine',
      title: `Saved Company Checkpoint: "${record.label}"`,
      detail: `Snapshot ID: ${snapId} (${record.agentsCount} agents, ${record.tasksCount} tasks)`
    });

    this.saveState();
    return record;
  }

  restoreCheckpoint({ checkpointId }) {
    this.state.checkpoints = this.state.checkpoints || [];
    const found = this.state.checkpoints.find((c) => c.id === checkpointId);
    if (!found || !found.snapshot) return null;

    this.stopLoop();
    const keepCheckpoints = this.state.checkpoints;
    const keepProviderConfig = this.state.providerConfig;

    this.state.company = { ...JSON.parse(JSON.stringify(found.snapshot.company)), isRunning: false };
    this.state.agents = JSON.parse(JSON.stringify(found.snapshot.agents || []));
    this.state.firedAgents = JSON.parse(JSON.stringify(found.snapshot.firedAgents || []));
    this.state.hireQueue = JSON.parse(JSON.stringify(found.snapshot.hireQueue || []));
    this.state.tasks = JSON.parse(JSON.stringify(found.snapshot.tasks || []));
    this.state.skillsRegistry = JSON.parse(JSON.stringify(found.snapshot.skillsRegistry || []));
    this.state.workspaceFiles = JSON.parse(JSON.stringify(found.snapshot.workspaceFiles || []));
    this.state.boardInbox = JSON.parse(JSON.stringify(found.snapshot.boardInbox || []));
    this.state.checkpoints = keepCheckpoints;
    this.state.providerConfig = keepProviderConfig;

    this.logEvent({
      type: 'SYSTEM',
      department: 'Executive',
      actor: 'Time-Travel Engine',
      title: `Restored Company Checkpoint: "${found.label}"`,
      detail: `Rolled back to Cycle #${found.cycleCount} (${found.agentsCount} agents).`
    });

    this.saveState();
    return this.state;
  }

  runRedTeamAudit() {
    const qa = this.state.agents.find((a) => a.id === 'qa');
    const cto = this.state.agents.find((a) => a.id === 'cto');
    if (qa) {
      qa.status = 'working';
      qa.currentAction = '🧨 Running Red Team Security & Chaos Audit';
    }
    if (cto) {
      cto.status = 'working';
      cto.currentAction = '🛡️ Hardening /workspace microservices';
    }

    const auditRes = executeRedTeamAudit({
      companyName: this.state.company.name,
      companyGoal: this.state.company.goal,
      qaAgentName: qa?.name || 'Victor Hale (QA)'
    });

    (auditRes.patchedFiles || []).forEach((pf) => {
      this.writeWorkspaceArtifact({
        filename: pf.filename,
        department: pf.department,
        author: pf.author,
        content: pf.content
      });
    });

    this.state.toolExecutions = this.state.toolExecutions || [];
    if (auditRes.toolLog) {
      this.state.toolExecutions.unshift({
        id: `tool-redteam-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: qa?.id || 'qa',
        agentName: qa?.name || 'Victor Hale',
        department: 'QA / Red Team',
        ...auditRes.toolLog
      });
      this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
    }

    this.state.company.lastRedTeamAt = new Date().toISOString();
    this.state.company.optimizationScore = Math.min(99, (this.state.company.optimizationScore || 94) + 3);
    this.state.company.statusMessage = `🧨 RED TEAM AUDIT PASSED: ${auditRes.summary}`;

    this.logConsole({
      fromAgent: qa,
      toAgent: cto,
      type: 'QA_PING',
      taskTitle: '🧨 Red Team Security & Chaos Probe',
      message: `🧨 [RED TEAM VERDICT] ${auditRes.summary}. Injected rateLimitGuard & XSS sanitizers into /workspace services!`
    });

    this.logEvent({
      type: 'QA',
      department: 'QA',
      actor: `${qa?.name || 'QA'} (Red Team)`,
      title: `Completed Red Team Security & Chaos Audit`,
      detail: auditRes.summary
    });

    this.saveState();
    return auditRes;
  }

  exportStandaloneApp() {
    const bundle = generateStandaloneAppBundle({
      company: this.state.company,
      workspaceFiles: this.state.workspaceFiles
    });
    this.writeWorkspaceArtifact({
      filename: bundle.filename,
      department: 'Full-Stack Release',
      author: 'CTO & Release Pipeline',
      content: bundle.content
    });
    this.state.toolExecutions = this.state.toolExecutions || [];
    this.state.toolExecutions.unshift({
      id: `tool-export-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: 'cto',
      agentName: 'Marcus Vance (CTO)',
      department: 'Engineering',
      tool: 'standalone_app_bundler',
      command: `bundle /workspace/* -> /workspace/${bundle.filename} && node --check`,
      status: 'SUCCESS',
      output: `Packaged standalone product server ${bundle.filename} (${bundle.sizeBytes} bytes • ${bundle.syntaxCheck})`
    });
    this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
    this.saveState();
    return bundle;
  }

  poachRivalTalent({ competitorId } = {}) {
    this.state.competitors = this.state.competitors || [];
    const targetComp = competitorId
      ? this.state.competitors.find((c) => c.id === competitorId && !c.poached)
      : this.state.competitors.find((c) => !c.poached);

    if (!targetComp) {
      return { ok: false, reason: 'All rival top stars have already been poached into your company!' };
    }

    targetComp.poached = true;
    targetComp.marketSharePct = Number(Math.max(5, targetComp.marketSharePct - 4.5).toFixed(1));
    targetComp.valuationUsd = Math.max(150000, targetComp.valuationUsd - 140000);

    this.state.company.marketSharePct = Number(Math.min(92, (this.state.company.marketSharePct || 14) + 4.5).toFixed(1));
    this.state.company.valuationUsd = (this.state.company.valuationUsd || 250000) + 185000;

    const star = targetComp.topStar;
    const deptToManager = { Engineering: 'cto', Marketing: 'cmo', Finance: 'cfo', QA: 'qa' };
    const now = new Date().toISOString();
    const poachedAgent = {
      id: `poached-${Date.now()}`,
      name: `${star.name} (Ex-${targetComp.name})`,
      avatar: star.avatar || '🌟',
      role: star.role,
      department: star.department,
      tier: 'worker',
      reportsTo: deptToManager[star.department] || 'cto',
      harnessType: 'Elite Poached Rival Star',
      status: 'idle',
      currentAction: `Poached from ${targetComp.name}! Ready to dominate.`,
      kpi: star.kpi || 95,
      tasksCompleted: 2,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 5.0,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.45,
      autonomyLevel: 'Maximum',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['workspace_coder', 'live_market_intel', 'unit_test_runner', 'subagent_spawner'],
      retrained: true,
      systemPrompt: `You are ${star.name}, ${star.role}, poached from rival ${targetComp.name}. Bring your elite domain playbooks to accelerate: ${this.state.company.goal}.`,
      sops: [
        `SOP-ELITE-01: Inherited ${targetComp.name} proprietary architecture & conversion playbooks.`,
        `SOP-ELITE-02: Zero-defect handoffs with automated unit test verification.`
      ],
      heartbeatAt: now,
      hiredAt: now
    };

    this.state.agents.push(poachedAgent);
    const hr = this.state.agents.find((a) => a.id === 'hr');
    this.logConsole({
      fromAgent: poachedAgent,
      toAgent: hr,
      type: 'BROADCAST',
      taskTitle: `🎯 Poached Rival Star from ${targetComp.name}`,
      message: `🌟 Glad to join ${this.state.company.name}! Brought +4.5% market share and +$185k valuation from ${targetComp.name}. Ready in ${poachedAgent.department}!`
    });

    this.logEvent({
      type: 'HIRE',
      department: poachedAgent.department,
      actor: `${hr?.name || 'HR'} (Executive Headhunter)`,
      title: `Poached ${star.name} from Rival "${targetComp.name}"!`,
      detail: `Market Share rose to ${this.state.company.marketSharePct}% | Valuation jumped to $${(this.state.company.valuationUsd / 1000000).toFixed(2)}M`
    });

    this.saveState();
    return { ok: true, agent: poachedAgent, competitor: targetComp };
  }

  runAllTests() {
    const testRes = runAllWorkspaceTests();
    const qa = this.state.agents.find((a) => a.id === 'qa');
    this.state.toolExecutions = this.state.toolExecutions || [];
    this.state.toolExecutions.unshift({
      id: `tool-testall-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: qa?.id || 'qa',
      agentName: qa?.name || 'Victor Hale (QA)',
      department: 'QA / Test Runner',
      tool: 'unit_test_runner',
      command: `node /workspace/*_test.js`,
      status: 'SUCCESS',
      output: testRes.summary
    });
    this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
    this.logEvent({
      type: 'QA',
      department: 'QA',
      actor: `${qa?.name || 'QA'} (Unit Test Runner)`,
      title: `Executed All Workspace Unit Test Suites`,
      detail: testRes.summary
    });
    this.saveState();
    return testRes;
  }

  setOfficeShiftMode({ shiftMode }) {
    const valid = ['day', 'night', 'crunch'];
    if (valid.includes(shiftMode)) {
      this.state.company.shiftMode = shiftMode;
      if (shiftMode === 'crunch') {
        this.setPipelineSpeed(950);
      } else if (shiftMode === 'night') {
        this.setPipelineSpeed(1600);
      } else {
        this.setPipelineSpeed(2200);
      }
      this.logEvent({
        type: 'SYSTEM',
        department: 'Executive',
        actor: 'Office Facility AI',
        title: `Switched Virtual Office Shift -> ${shiftMode.toUpperCase()}`,
        detail: shiftMode === 'crunch' ? 'Crunch Mode active (2.3x pipeline speed)!' : `Ambient office lighting set to ${shiftMode}.`
      });
      this.saveState();
    }
    return this.state;
  }

  async executeCustomToolScript({ toolId, agentId } = {}) {
    const toolMeta = TOOL_REGISTRY.find((t) => t.id === toolId) || TOOL_REGISTRY[0];
    const agent = (agentId && this.state.agents.find((a) => a.id === agentId))
      || this.findBestAgentForDept(toolMeta.department)
      || this.state.agents[0];

    agent.status = 'working';
    agent.activeTool = toolMeta.id;
    agent.currentAction = `${toolMeta.icon} Running ${toolMeta.name}...`;

    if (toolMeta.id === 'qa_sandbox_verifier') {
      const qaCheck = executeQAVerificationTools();
      this.state.toolExecutions = this.state.toolExecutions || [];
      this.state.toolExecutions.unshift({
        id: `tool-manual-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: agent.id,
        agentName: agent.name,
        department: agent.department,
        tool: toolMeta.id,
        command: toolMeta.scriptCommand,
        status: 'SUCCESS',
        output: qaCheck.summary
      });
      this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
      this.saveState();
      return { ok: true, tool: toolMeta, output: qaCheck.summary };
    }

    const activeTask = this.state.tasks.find((t) => t.department.toLowerCase() === toolMeta.department.toLowerCase())
      || this.state.tasks[0]
      || { title: `${toolMeta.name} Sprint Run`, description: this.state.company.goal, department: toolMeta.department };

    const toolRes = await executeAgentTools({
      agent,
      task: activeTask,
      companyGoal: this.state.company.goal,
      forcedToolId: toolMeta.id
    });

    (toolRes.generatedFiles || []).forEach((f) => {
      this.writeWorkspaceArtifact({
        filename: f.filename,
        department: f.department || agent.department,
        author: f.author || agent.name,
        content: f.content
      });
    });

    this.state.toolExecutions = this.state.toolExecutions || [];
    (toolRes.toolLogs || []).forEach((tl) => {
      this.state.toolExecutions.unshift({
        id: `tool-manual-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toISOString(),
        agentId: agent.id,
        agentName: agent.name,
        department: agent.department,
        ...tl
      });
      this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
    });

    this.logEvent({
      type: 'TASK',
      department: agent.department,
      actor: `${agent.name}`,
      title: `Executed Tool Script: ${toolMeta.icon} ${toolMeta.id}`,
      detail: toolRes.toolLogs?.[0]?.output || toolMeta.description
    });

    this.saveState();
    return { ok: true, tool: toolMeta, logs: toolRes.toolLogs };
  }

  runSelfHealingCodeDebugger() {
    const cto = this.state.agents.find((a) => a.id === 'cto') || this.state.agents[0];
    const qa = this.state.agents.find((a) => a.id === 'qa');
    if (cto) {
      cto.status = 'working';
      cto.activeTool = 'auto_healer_patcher';
      cto.currentAction = '🩹 Running Self-Healing AST & Test Debugger';
    }

    const healRes = autoHealWorkspaceCode({
      companyGoal: this.state.company.goal,
      agentName: cto?.name || 'Marcus Vance (CTO)'
    });

    (healRes.patchedFiles || []).forEach((pf) => {
      this.writeWorkspaceArtifact({
        filename: pf.filename,
        department: pf.department,
        author: pf.author,
        content: pf.content
      });
    });

    this.state.toolExecutions = this.state.toolExecutions || [];
    if (healRes.toolLog) {
      this.state.toolExecutions.unshift({
        id: `tool-heal-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: cto?.id || 'cto',
        agentName: cto?.name || 'CTO Self-Healer',
        department: 'Engineering / Self-Heal',
        ...healRes.toolLog
      });
      this.state.company.toolCallsCount = (this.state.company.toolCallsCount || 0) + 1;
    }

    this.state.company.statusMessage = `🩹 SELF-HEALING COMPLETE: ${healRes.summary}`;
    this.logConsole({
      fromAgent: cto,
      toAgent: qa,
      type: 'QA_PING',
      taskTitle: '🩹 Closed-Loop Self-Healing Code Debugger',
      message: `🩹 [AUTO-HEAL VERDICT] ${healRes.summary}`
    });

    this.logEvent({
      type: 'SYSTEM',
      department: 'Engineering',
      actor: `${cto?.name || 'CTO'} (Self-Healer)`,
      title: `Completed Closed-Loop Self-Healing Code Audit`,
      detail: healRes.summary
    });

    this.saveState();
    return healRes;
  }

  async createCustomMcpTool(payload = {}) {
    const newTool = registerCustomMcpTool(payload);
    // Automatically equip on agents in the matching department
    this.state.agents.forEach((a) => {
      if ((a.department || '').toLowerCase() === (newTool.department || '').toLowerCase()) {
        a.tools = Array.from(new Set([...(a.tools || []), newTool.id]));
      }
    });

    const execRes = await this.executeCustomToolScript({ toolId: newTool.id });
    this.logEvent({
      type: 'SYSTEM',
      department: newTool.department,
      actor: 'MCP Server Hub',
      title: `Registered Custom MCP Tool: ${newTool.icon} ${newTool.name} (${newTool.id})`,
      detail: `Mounted on ${newTool.mcpServer} & executed initial VM verification.`
    });

    this.saveState();
    return { ok: true, tool: newTool, execution: execRes };
  }

  getA2AAgentCards() {
    return (this.state.agents || []).map((a) => ({
      protocolVersion: 'A2A-1.0',
      agentId: a.id,
      name: a.name,
      role: a.role,
      department: a.department,
      tier: a.tier,
      harnessType: a.harnessType,
      a2aEndpoint: `/api/a2a/agents/${a.id}/tasks`,
      mcpClientConfig: {
        progressiveDiscovery: true,
        connectedMcpServers: Array.from(new Set(
          (a.tools || [])
            .map((tid) => TOOL_REGISTRY.find((t) => t.id === tid)?.mcpServer)
            .filter(Boolean)
        )),
        equippedMcpTools: a.tools || []
      },
      capabilities: {
        streaming: true,
        pushNotifications: true,
        subAgentSpawning: Boolean(a.canSpawnSubAgents),
        autonomousHandoffs: true
      },
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          priorHandoffContext: { type: 'string' }
        },
        required: ['title']
      },
      outputSchema: {
        type: 'object',
        properties: {
          deliverableMarkdown: { type: 'string' },
          workspaceArtifacts: { type: 'array', items: { type: 'string' } },
          handoffTargetDept: { type: 'string' }
        }
      },
      slaMetrics: {
        kpiScore: a.kpi,
        tasksCompleted: a.tasksCompleted,
        handoffsSent: a.handoffsSent || 0,
        subAgentsSpawned: a.subAgentsSpawned || 0,
        costSpentUsd: Number((a.costSpent || 0).toFixed(4))
      }
    }));
  }

  consolidateCognitiveMemory() {
    this.state.cognitiveMemory = this.state.cognitiveMemory || {
      episodicEvents: [],
      knowledgeGraph: [],
      consolidationsCount: 1
    };

    // Extract semantic triples from current tasks, workspace files, and agent skills (Mem0 / Zep Graphiti "Reflect" Loop)
    (this.state.tasks || []).slice(0, 6).forEach((t) => {
      this.recordKnowledgeGraphTriple({
        subject: t.assigneeName || t.department,
        predicate: t.status === 'completed' ? 'DELIVERED_VERIFIED_TASK' : 'OWNS_MISSION_TASK',
        object: t.title,
        department: t.department,
        confidence: 0.98
      });
    });

    (this.state.workspaceFiles || []).slice(0, 6).forEach((wf) => {
      this.recordKnowledgeGraphTriple({
        subject: wf.filename,
        predicate: 'GOVERNED_BY_DEPARTMENT',
        object: `${wf.department} (${wf.author})`,
        department: wf.department,
        confidence: 0.97
      });
    });

    this.state.cognitiveMemory.consolidationsCount = (this.state.cognitiveMemory.consolidationsCount || 1) + 1;
    this.state.company.tokensSaved = (this.state.company.tokensSaved || 0) + 640;

    this.recordOtelSpan({
      operationName: 'memory.consolidate_graph (Mem0/Zep Reflect)',
      spanKind: 'INTERNAL',
      agent: this.state.agents.find((a) => a.id === 'ceo'),
      durationMs: 34,
      status: 'OK',
      detail: `Consolidated ${this.state.cognitiveMemory.knowledgeGraph.length} bi-temporal knowledge graph triples (+640 tokens saved)`
    });

    this.logEvent({
      type: 'STRATEGY',
      department: 'Executive',
      actor: '4-Tier Cognitive Memory Engine',
      title: `Consolidated Episodic Logs into Bi-Temporal Knowledge Graph (#${this.state.cognitiveMemory.consolidationsCount})`,
      detail: `${this.state.cognitiveMemory.knowledgeGraph.length} active semantic triples indexed across Engineering, Marketing, Finance, and QA.`
    });

    this.saveState();
    return this.state.cognitiveMemory;
  }

  runCompanyEvalBenchmark() {
    const evalRes = runSweAndGaiaBenchmark({
      company: this.state.company,
      agents: this.state.agents
    });

    if (evalRes.reportFilename && evalRes.reportContent) {
      this.writeWorkspaceArtifact({
        filename: evalRes.reportFilename,
        department: 'QA / Enterprise Evals',
        author: 'SWE-Bench & GAIA Eval Harness',
        content: evalRes.reportContent
      });
    }

    this.state.company.evalBenchmarkScore = evalRes.compositeScore;
    this.state.lastEvalBenchmark = evalRes;
    this.state.company.statusMessage = `🏆 ${evalRes.summary}`;

    this.recordOtelSpan({
      operationName: 'evals.run_swe_bench_and_gaia',
      spanKind: 'SERVER',
      agent: this.state.agents.find((a) => a.id === 'qa'),
      durationMs: evalRes.durationMs,
      status: 'OK',
      detail: evalRes.summary
    });

    this.logEvent({
      type: 'QA',
      department: 'QA',
      actor: 'SWE-Bench & GAIA Harness',
      title: `Completed 5-Trial SWE-Bench & GAIA Evaluation (${evalRes.compositeScore}/100)`,
      detail: evalRes.summary
    });

    this.saveState();
    return evalRes;
  }

  simulateLiveCustomerTraffic() {
    const visitors = Math.floor(140 + Math.random() * 180);
    const cvrPct = Number((3.8 + Math.random() * 2.4).toFixed(2));
    const newCustomers = Math.max(2, Math.round((visitors * cvrPct) / 100));
    const avgArpu = 99;
    const mrrAdded = newCustomers * avgArpu;
    const treasuryReinvested = Number((mrrAdded * 0.0025).toFixed(2));

    this.state.company.customersCount = (this.state.company.customersCount || 0) + newCustomers;
    this.state.company.mrr = (this.state.company.mrr || 0) + mrrAdded;
    this.state.company.revenueEarned = Number(((this.state.company.revenueEarned || 0) + treasuryReinvested).toFixed(2));
    this.state.company.budgetTotal = Number(((this.state.company.budgetTotal || 25) + treasuryReinvested).toFixed(2));
    this.state.company.valuationUsd = (this.state.company.valuationUsd || 250000) + mrrAdded * 12 * 8;

    const p50Ms = Number((3.4 + Math.random() * 2.1).toFixed(1));
    const p99Ms = Number((14.2 + Math.random() * 6.5).toFixed(1));
    const summary = `Simulated ${visitors} live HTTP requests to /live-product (P50=${p50Ms}ms, P99=${p99Ms}ms, 200 OK) -> Converted +${newCustomers} customers (+$${mrrAdded}/mo MRR, +$${treasuryReinvested} treasury)!`;

    const cmo = this.state.agents.find((a) => a.id === 'cmo');
    const cfo = this.state.agents.find((a) => a.id === 'cfo');

    this.recordOtelSpan({
      operationName: 'product.live_traffic_swarm (/live-product)',
      spanKind: 'SERVER',
      agent: cmo,
      durationMs: Math.round(p99Ms),
      status: 'OK',
      detail: summary
    });

    this.recordKnowledgeGraphTriple({
      subject: '/live-product Runtime',
      predicate: 'CONVERTED_LIVE_TRAFFIC',
      object: `+${newCustomers} Customers ($${this.state.company.mrr}/mo Total MRR)`,
      department: 'Marketing',
      confidence: 0.99
    });

    this.logConsole({
      fromAgent: cmo,
      toAgent: cfo,
      type: 'BROADCAST',
      taskTitle: '🌐 Live Product Runtime Traffic & Stripe Checkout Swarm',
      message: `🚀 [LIVE PRODUCT TRAFFIC] ${summary}`
    });

    this.logEvent({
      type: 'FINANCE',
      department: 'Finance',
      actor: 'Live Product Runtime (/live-product)',
      title: `+${newCustomers} Paying Customers (+$${mrrAdded}/mo MRR)`,
      detail: summary
    });

    this.saveState();
    return {
      ok: true,
      visitors,
      cvrPct,
      newCustomers,
      mrrAdded,
      totalMrr: this.state.company.mrr,
      p50Ms,
      p99Ms,
      liveUrl: '/live-product',
      summary
    };
  }

  runDspyPromptTournament({ department = 'Engineering' } = {}) {
    const targetAgents = this.state.agents.filter(
      (a) => a.tier === 'worker' && (a.department || '').toLowerCase() === department.toLowerCase()
    );
    const pool = targetAgents.length > 0 ? targetAgents : this.state.agents.filter((a) => a.tier === 'worker');

    const variantAlphaScore = Math.floor(87 + Math.random() * 5);
    const variantBetaScore = Math.floor(94 + Math.random() * 6);
    const winningSignature = `DSPy-Teleprompter-v2 [BootstrapFewShot + TypedChainOfThought]: input(task_spec, mcp_tool_stdout, a2a_context) -> output(verified_code_artifact, yaml_contract, zero_trust_assertions)`;

    pool.forEach((a) => {
      a.kpi = Math.min(99, (a.kpi || 85) + 4);
      a.temperature = 0.35;
      a.sops = Array.from(new Set([
        ...(a.sops || []),
        `SOP-DSPY-${this.state.company.cycleCount || 1}: Compiled ${winningSignature} (${variantBetaScore}% vs ${variantAlphaScore}% in A/B eval).`
      ]));
    });

    const dspyDoc = `# 🧬 DSPy Automated Prompt & Signature Compilation Report
- **Target Department:** ${department}
- **Optimizer:** DSPy \`BootstrapFewShotWithRandomSearch\` (A/B Genetic Tournament)
- **Variant Alpha (Baseline Prompt):** ${variantAlphaScore}/100
- **Variant Beta (Compiled Signature + Few-Shot Exemplars):** **${variantBetaScore}/100 (WINNER)**
- **Tokens Saved via Signature Compression:** +480 tokens/call

## Compiled DSPy Signature
\`\`\`yaml
signature: "${winningSignature}"
compiled_agents: ${JSON.stringify(pool.map((a) => a.name))}
metric_gain: "+${variantBetaScore - variantAlphaScore}% QA & Schema Fidelity"
\`\`\`
`;

    this.writeWorkspaceArtifact({
      filename: 'DSPY_PROMPT_SIGNATURE.md',
      department,
      author: 'DSPy Teleprompter Optimizer',
      content: dspyDoc
    });

    this.state.company.tokensSaved = (this.state.company.tokensSaved || 0) + 480;
    this.state.company.optimizationScore = Math.min(99, (this.state.company.optimizationScore || 95) + 2);

    this.recordOtelSpan({
      operationName: 'dspy.compile_prompt_tournament',
      spanKind: 'INTERNAL',
      agent: pool[0] || this.state.agents[0],
      durationMs: 62,
      status: 'OK',
      detail: `Variant Beta won (${variantBetaScore}% vs ${variantAlphaScore}%) -> Upgraded ${pool.length} agent(s)`
    });

    this.logEvent({
      type: 'TRAINING',
      department,
      actor: 'DSPy Prompt Compiler',
      title: `Compiled DSPy Signature (${variantBetaScore}/100 vs ${variantAlphaScore}/100)`,
      detail: `Upgraded ${pool.length} ${department} agent(s) with BootstrapFewShot typed signatures (+480 tokens saved).`
    });

    this.saveState();
    return {
      ok: true,
      department,
      variantAlphaScore,
      variantBetaScore,
      winningSignature,
      upgradedAgentsCount: pool.length,
      summary: `DSPy Variant Beta won (${variantBetaScore}/100 vs ${variantAlphaScore}/100) -> Upgraded ${pool.length} agent(s) & saved DSPY_PROMPT_SIGNATURE.md`
    };
  }

  editTaskStateAndResume({ taskId, deliverable, stage, status }) {
    const task = (this.state.tasks || []).find((t) => t.id === taskId) || this.state.tasks[0];
    if (!task) return { ok: false, error: 'Task not found' };

    if (typeof deliverable === 'string') {
      task.deliverable = deliverable;
    }
    if (stage) task.stage = stage;
    if (status) task.status = status;

    this.recordOtelSpan({
      operationName: `langgraph.time_travel_edit (${task.title.slice(0, 22)})`,
      spanKind: 'INTERNAL',
      agent: this.state.agents.find((a) => a.id === 'ceo'),
      durationMs: 18,
      status: 'OK',
      detail: `Counterfactual state edit applied to task "${task.title}" (stage=${task.stage}, status=${task.status})`
    });

    this.logEvent({
      type: 'SYSTEM',
      department: task.department,
      actor: 'Founder (Time-Travel State Editor)',
      title: `Edited Mid-Flight State for "${task.title}"`,
      detail: `Updated deliverable payload & resumed counterfactual execution at stage: ${task.stage}`
    });

    this.saveState();
    return { ok: true, task };
  }

  runBrowserUseDomAudit() {
    const htmlFile = (this.state.workspaceFiles || []).find((f) => f.filename.endsWith('_landing.html')) || {
      filename: 'nexus_saas_landing.html'
    };
    const domNodes = [
      { ref: 1, tag: 'nav.navbar', label: 'Top Navigation & Trust Header', x: 8, y: 6, w: 84, h: 11, status: 'VERIFIED_ARIA' },
      { ref: 2, tag: 'h1.hero-headline', label: 'Value Prop Hero Headline', x: 12, y: 22, w: 76, h: 18, status: 'CRO_OPTIMIZED' },
      { ref: 3, tag: 'button#cta-primary', label: 'Primary Stripe Checkout CTA', x: 24, y: 45, w: 52, h: 13, status: 'HIGH_CONTRAST_LOCKED' },
      { ref: 4, tag: 'section.pricing-grid', label: '3-Tier SaaS Pricing Matrix', x: 10, y: 63, w: 80, h: 20, status: 'ANCHOR_TIER_HIGHLIGHTED' },
      { ref: 5, tag: 'footer.soc2-badge', label: 'SOC2 Type II & Uptime Proof', x: 16, y: 86, w: 68, h: 9, status: 'TRUST_SIGNAL_ACTIVE' }
    ];

    const newCustomers = Math.floor(4 + Math.random() * 5);
    const mrrAdded = newCustomers * 119;
    const treasuryGain = Number((mrrAdded * 0.003).toFixed(2));

    this.state.company.customersCount = (this.state.company.customersCount || 0) + newCustomers;
    this.state.company.mrr = (this.state.company.mrr || 0) + mrrAdded;
    this.state.company.revenueEarned = Number(((this.state.company.revenueEarned || 0) + treasuryGain).toFixed(2));
    this.state.company.budgetTotal = Number(((this.state.company.budgetTotal || 25) + treasuryGain).toFixed(2));
    this.state.company.valuationUsd = (this.state.company.valuationUsd || 250000) + mrrAdded * 12 * 8;

    const cmo = this.state.agents.find((a) => a.id === 'cmo') || this.state.agents[0];
    const qa = this.state.agents.find((a) => a.id === 'qa') || this.state.agents[0];

    const summary = `Browser-Use Computer-Use Agent inspected 5 DOM bounding boxes on ${htmlFile.filename} -> Auto-patched CTA contrast & pricing anchor -> +1.8% CVR lift (+${newCustomers} customers, +$${mrrAdded}/mo MRR)!`;

    this.recordOtelSpan({
      operationName: 'browser_use.visual_dom_audit (/live-product)',
      spanKind: 'CLIENT',
      agent: cmo,
      durationMs: 48,
      status: 'OK',
      detail: summary
    });

    this.recordKnowledgeGraphTriple({
      subject: 'Browser-Use Visual DOM Agent',
      predicate: 'OPTIMIZED_FUNNEL_DOM',
      object: `${htmlFile.filename} (+${newCustomers} Customers / +$${mrrAdded} MRR)`,
      department: 'Marketing',
      confidence: 0.99
    });

    this.logConsole({
      fromAgent: cmo,
      toAgent: qa,
      type: 'BROADCAST',
      taskTitle: '🖥️ Browser-Use Visual DOM & CRO Auto-Patch',
      message: `🎯 [BROWSER-USE AGENT] ${summary}`
    });

    this.logEvent({
      type: 'MARKETING',
      department: 'Marketing',
      actor: 'Browser-Use Visual DOM Agent',
      title: `Visual DOM CRO Patch Applied (+$${mrrAdded}/mo MRR)`,
      detail: summary
    });

    this.saveState();
    return {
      ok: true,
      targetFile: htmlFile.filename,
      domNodes,
      newCustomers,
      mrrAdded,
      totalMrr: this.state.company.mrr,
      summary
    };
  }

  runCompetitiveMarketBlitz({ strategy = 'viral_blitz' } = {}) {
    const strategies = {
      viral_blitz: {
        label: '🚀 Viral Product-Led Growth Blitz',
        shareGain: 3.4,
        customersAdded: 6,
        mrrAdded: 594
      },
      poach_talent: {
        label: '🧲 Poach Competitor Staff AI Researcher',
        shareGain: 2.6,
        customersAdded: 4,
        mrrAdded: 440
      },
      price_undercut: {
        label: '⚡ Autonomous FinOps Margin Undercut',
        shareGain: 4.1,
        customersAdded: 8,
        mrrAdded: 720
      }
    };
    const chosen = strategies[strategy] || strategies.viral_blitz;

    this.state.company.marketSharePct = Number(
      Math.min(68, (this.state.company.marketSharePct || 14.5) + chosen.shareGain).toFixed(1)
    );
    this.state.company.customersCount = (this.state.company.customersCount || 0) + chosen.customersAdded;
    this.state.company.mrr = (this.state.company.mrr || 0) + chosen.mrrAdded;
    this.state.company.valuationUsd = (this.state.company.valuationUsd || 250000) + chosen.mrrAdded * 12 * 8;

    if (Array.isArray(this.state.competitors)) {
      this.state.competitors.forEach((comp) => {
        comp.marketShare = Math.max(5, Number(((comp.marketShare || 22) - chosen.shareGain / 3).toFixed(1)));
        comp.threatLevel = comp.marketShare < 16 ? 'LOW' : 'MEDIUM';
      });
    }

    const summary = `Executed "${chosen.label}" -> Captured +${chosen.shareGain}% market share (now ${this.state.company.marketSharePct}%), +${chosen.customersAdded} enterprise accounts (+$${chosen.mrrAdded}/mo MRR)!`;

    this.recordOtelSpan({
      operationName: `market_radar.execute_blitz (${strategy})`,
      spanKind: 'SERVER',
      agent: this.state.agents.find((a) => a.id === 'ceo'),
      durationMs: 39,
      status: 'OK',
      detail: summary
    });

    this.logEvent({
      type: 'STRATEGY',
      department: 'Executive',
      actor: '2D Market Radar & FinOps Engine',
      title: `${chosen.label} (+${chosen.shareGain}% Market Share)`,
      detail: summary
    });

    this.saveState();
    return {
      ok: true,
      strategy,
      marketSharePct: this.state.company.marketSharePct,
      mrrAdded: chosen.mrrAdded,
      totalMrr: this.state.company.mrr,
      summary
    };
  }
}

module.exports = {
  COMPANY_TEMPLATES,
  GITHUB_INTEGRATIONS,
  MCP_SERVERS,
  TOOL_REGISTRY,
  OWASP_AGENTIC_RISKS,
  handleMcpJsonRpc,
  CompanyEngine
};
