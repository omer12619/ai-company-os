/**
 * AI Company OS — Domain Catalogs, Industry Templates & Initial State Factory
 * Extracted from company-engine.js for clean modular separation of Domain Data vs. Runtime State Machine.
 */

const COMPANY_TEMPLATES = [
  {
    id: 'ai-saas',
    name: 'NexusAI SaaS',
    theme: 'B2B AI Workflow Automation SaaS',
    goal: 'Build, price, and launch a multi-tenant AI document & workflow automation platform targeting SMBs to reach $50k MRR.',
    budget: 25.00
  },
  {
    id: 'fintech-quant',
    name: 'Aegis FinTech Labs',
    theme: 'Automated Personal Finance & Fraud Detection',
    goal: 'Architect a real-time expense anomaly detector, compliance engine, and consumer growth funnel with strict zero-trust QA.',
    budget: 30.00
  },
  {
    id: 'growth-agency',
    name: 'HyperScale Digital Agency',
    theme: 'Full-Funnel AI Marketing & Content Agency',
    goal: 'Create an automated SEO content engine, high-converting landing page framework, and ROI analytics dashboard for clients.',
    budget: 20.00
  },
  {
    id: 'game-studio',
    name: 'PixelForge Indie Studio',
    theme: 'Multiplayer Web & Roblox Game Studio',
    goal: 'Design core gameplay loop, economy monetization model, server netcode architecture, and viral creator launch campaign.',
    budget: 25.00
  }
];

const GITHUB_INTEGRATIONS = [
  {
    id: 'paperclip',
    repo: 'paperclipai/paperclip',
    name: 'Paperclip (Zero-Human Company Control Plane)',
    url: 'https://github.com/paperclipai/paperclip',
    roleInOS: 'Org Chart Governance, Per-Agent Budget Caps, Heartbeats & Portable Company Packs',
    status: 'Integrated'
  },
  {
    id: 'hermes',
    repo: 'NousResearch/hermes-agent',
    name: 'Hermes Agent (Recursive Sub-Agents & Skill Synthesis)',
    url: 'https://github.com/NousResearch/hermes-agent',
    roleInOS: 'Autonomous Child Sub-Agent Spawning & Closed-Loop SKILL.md Procedural Memory',
    status: 'Integrated'
  },
  {
    id: 'metagpt',
    repo: 'geekan/MetaGPT',
    name: 'MetaGPT (SOP-Driven Multi-Agent Pipeline)',
    url: 'https://github.com/geekan/MetaGPT',
    roleInOS: 'Standardized Operating Procedures (SOPs) & Structured Deliverable Schemas',
    status: 'Integrated'
  },
  {
    id: 'chatdev',
    repo: 'OpenBMB/ChatDev',
    name: 'ChatDev (Communicative Agent Software House)',
    url: 'https://github.com/OpenBMB/ChatDev',
    roleInOS: 'Instructor-Assistant Dual-Agent Handoff Console & Workspace Artifact Generation',
    status: 'Integrated'
  },
  {
    id: 'xyflow',
    repo: 'xyflow/xyflow',
    name: 'React Flow / XYFlow (Interactive Node-Graph UI)',
    url: 'https://github.com/xyflow/xyflow',
    roleInOS: 'Interactive SVG Node-Graph Topology for CEO, Departments, Workers & Sub-Agents',
    status: 'Integrated'
  }
];

function createFoundingAgents() {
  const now = new Date().toISOString();
  return [
    {
      id: 'ceo',
      name: 'Aria Vance',
      avatar: '👑',
      role: 'Chief Executive Officer (CEO)',
      department: 'Executive',
      tier: 'c-suite',
      reportsTo: null,
      harnessType: 'MetaGPT Executive Node',
      status: 'idle',
      currentAction: 'Monitoring company roadmap',
      kpi: 95,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 6.00,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.6,
      autonomyLevel: 'High',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['mission_planner', 'org_router', 'kpi_monitor'],
      systemPrompt: 'You are the CEO. Break down the founder\'s shared company goal into cross-departmental initiatives, coordinate handoffs between departments, and identify specialist roles HR needs to hire.',
      sops: [
        'SOP-EXEC-01: Align all departments (Engineering, Finance, Marketing, QA) around shared mission milestones.',
        'SOP-EXEC-02: Require cross-department agent handoffs and Hermes-style sub-agent delegation on complex deliverables.'
      ],
      heartbeatAt: now,
      hiredAt: now
    },
    {
      id: 'hr',
      name: 'Marcus Sterling',
      avatar: '🤝',
      role: 'VP of People & Evolution (HR)',
      department: 'HR',
      tier: 'c-suite',
      reportsTo: 'ceo',
      harnessType: 'Hermes Skill Synthesizer',
      status: 'idle',
      currentAction: 'Auditing team KPIs & skills',
      kpi: 94,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 4.50,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.6,
      autonomyLevel: 'High',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['agent_spawner', 'skill_synthesizer', 'prompt_mutator'],
      systemPrompt: 'You are the HR & Self-Evolution Director. You dynamically hire specialized AI agents, promote high-performing sub-agents, synthesize reusable SKILL.md modules, and fire agents whose KPI falls below 62.',
      sops: [
        'SOP-HR-01: Craft tailored system prompts, toolsets, and initial SOPs for every newly hired specialist.',
        'SOP-HR-02: Distill successful multi-agent workflows into reusable Hermes-style Company Skills.'
      ],
      heartbeatAt: now,
      hiredAt: now
    },
    {
      id: 'cfo',
      name: 'Elena Rostova',
      avatar: '💎',
      role: 'Chief Financial Officer (CFO)',
      department: 'Finance',
      tier: 'c-suite',
      reportsTo: 'ceo',
      harnessType: 'Paperclip Budget Guard',
      status: 'idle',
      currentAction: 'Tracking token ledger & ROI',
      kpi: 93,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 4.50,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.3,
      autonomyLevel: 'High',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['token_ledger', 'roi_calculator', 'budget_guard'],
      systemPrompt: 'You are the CFO. You monitor token consumption, API costs, departmental ROI, and unit economics. You collaborate on pricing and cost handoffs across the company.',
      sops: [
        'SOP-FIN-01: Track every LLM call in the financial ledger and enforce total company budget.',
        'SOP-FIN-02: Validate unit economics and token efficiency on cross-department handoffs.'
      ],
      heartbeatAt: now,
      hiredAt: now
    },
    {
      id: 'cto',
      name: 'Devon Kaur',
      avatar: '⚡',
      role: 'Chief Technology Officer (CTO)',
      department: 'Engineering',
      tier: 'c-suite',
      reportsTo: 'ceo',
      harnessType: 'ChatDev Architect Node',
      status: 'idle',
      currentAction: 'Overseeing technical architecture',
      kpi: 92,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 6.50,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.4,
      autonomyLevel: 'High',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['arch_designer', 'code_synth', 'subagent_orchestrator'],
      systemPrompt: 'You are the CTO. You lead technical architecture, system design, security, and engineering execution, spawning specialized sub-agents and coordinating handoffs.',
      sops: [
        'SOP-ENG-01: Produce modular, production-grade architectures, schemas, and code specifications.',
        'SOP-ENG-02: Spawn focused micro sub-agents for schema validation, security checks, and benchmarks.'
      ],
      heartbeatAt: now,
      hiredAt: now
    },
    {
      id: 'cmo',
      name: 'Sophia Chen',
      avatar: '🚀',
      role: 'Chief Marketing Officer (CMO)',
      department: 'Marketing',
      tier: 'c-suite',
      reportsTo: 'ceo',
      harnessType: 'Growth Loop Agent',
      status: 'idle',
      currentAction: 'Planning growth & GTM loops',
      kpi: 91,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 5.00,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.75,
      autonomyLevel: 'High',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['market_radar', 'copy_engine', 'funnel_optimizer'],
      systemPrompt: 'You are the CMO. You own brand positioning, customer acquisition funnels, copywriting, SEO, and Go-To-Market launches, collaborating closely with Engineering and Finance.',
      sops: [
        'SOP-MKT-01: Ground every marketing campaign in clear target personas and conversion metrics.',
        'SOP-MKT-02: Coordinate launch assets with Engineering telemetry and Finance pricing models.'
      ],
      heartbeatAt: now,
      hiredAt: now
    },
    {
      id: 'qa',
      name: 'Victor Hale',
      avatar: '🛡️',
      role: 'Director of Quality Assurance (QA)',
      department: 'QA',
      tier: 'c-suite',
      reportsTo: 'ceo',
      harnessType: 'Zero-Trust QA Gate',
      status: 'idle',
      currentAction: 'Guarding deliverable quality gates',
      kpi: 96,
      tasksCompleted: 0,
      handoffsSent: 0,
      handoffsReceived: 0,
      subAgentsSpawned: 0,
      failures: 0,
      tokensUsed: 0,
      costSpent: 0,
      budgetCap: 4.50,
      providerOverride: 'inherit',
      modelOverride: '',
      temperature: 0.25,
      autonomyLevel: 'Strict',
      canSpawnSubAgents: true,
      subAgents: [],
      tools: ['qa_fuzzer', 'rubric_grader', 'compliance_gate'],
      systemPrompt: 'You are the QA Director. You audit every multi-agent task output against strict quality rubrics (0-100), either approving deliverables or sending actionable retraining feedback to HR.',
      sops: [
        'SOP-QA-01: Score deliverables objectively from 0 to 100 based on completeness, specificity, and handoff quality.',
        'SOP-QA-02: Extract a concrete lesson/SOP and Hermes Skill from every audit so the company continuously teaches itself.'
      ],
      heartbeatAt: now,
      hiredAt: now
    }
  ];
}

function createInitialSkills() {
  return [
    {
      id: 'skill-hermes-decomp',
      name: 'recursive_subagent_decomposition',
      department: 'Engineering',
      createdBy: 'Devon Kaur (CTO)',
      usageCount: 4,
      trigger: 'When a task involves multi-layer architecture, benchmarking, or cross-domain validation',
      procedure: '1. Spawn a focused Child Sub-Agent with narrow scope.\n2. Execute sub-task in isolated context.\n3. Merge verified child artifact into parent deliverable before peer handoff.'
    },
    {
      id: 'skill-unit-econ',
      name: 'cfo_unit_economics_gate',
      department: 'Finance',
      createdBy: 'Elena Rostova (CFO)',
      usageCount: 3,
      trigger: 'Before any customer-facing feature or marketing campaign is sent to QA',
      procedure: '1. Compute token/compute COGS per user action.\n2. Attach 3-tier pricing & gross margin table (>75% target).\n3. Hand off verified numbers to QA.'
    }
  ];
}

function createInitialState(template = COMPANY_TEMPLATES[0]) {
  return {
    company: {
      name: template.name,
      theme: template.theme,
      goal: template.goal,
      budgetTotal: template.budget,
      budgetSpent: 0,
      totalTokens: 0,
      tokensSaved: 0,
      handoffsCount: 0,
      subAgentsCount: 0,
      toolCallsCount: 0,
      mrr: 0,
      customersCount: 0,
      revenueEarned: 0,
      valuationUsd: 250000,
      marketSharePct: 14.0,
      shiftMode: 'day',
      optimizationScore: 94,
      activePhase: 'strategy',
      cycleCount: 0,
      speedMs: 2200,
      uiTheme: 'classic',
      parallelMode: true,
      requireBoardApproval: false,
      isRunning: false,
      statusMessage: 'Ready! Click "▶ Start Auto-Pilot" or "⏭ Next Step" to watch your AI Company build itself.',
      createdAt: new Date().toISOString()
    },
    providerConfig: {
      activeProvider: 'simulator',
      providers: {
        simulator: { model: 'company-sim-v2', apiKey: '', baseUrl: '' },
        openai: { model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY || '', baseUrl: 'https://api.openai.com/v1/chat/completions' },
        anthropic: { model: 'claude-3-7-sonnet-latest', apiKey: process.env.ANTHROPIC_API_KEY || '', baseUrl: 'https://api.anthropic.com/v1/messages' },
        gemini: { model: 'gemini-3.8-flash', apiKey: process.env.GEMINI_API_KEY || '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models' },
        groq: { model: 'llama-3.3-70b-versatile', apiKey: process.env.GROQ_API_KEY || '', baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
        openrouter: { model: 'openai/gpt-4o-mini', apiKey: process.env.OPENROUTER_API_KEY || '', baseUrl: 'https://openrouter.ai/api/v1/chat/completions' },
        deepseek: { model: 'deepseek-chat', apiKey: process.env.DEEPSEEK_API_KEY || '', baseUrl: 'https://api.deepseek.com/v1/chat/completions' },
        ollama: { model: 'qwen2.5-coder:7b', apiKey: '', baseUrl: 'http://localhost:11434/v1/chat/completions' },
        custom: { model: 'local-model', apiKey: '', baseUrl: 'http://localhost:1234/v1/chat/completions' }
      }
    },
    agents: createFoundingAgents(),
    firedAgents: [],
    hireQueue: [],
    tasks: [],
    skillsRegistry: createInitialSkills(),
    toolExecutions: [],
    competitors: [
      {
        id: 'comp-apex',
        name: 'ApexAuto AI',
        marketSharePct: 33.5,
        valuationUsd: 890000,
        poached: false,
        topStar: {
          name: 'Dr. Kaelen Thorne',
          avatar: '⚡',
          role: 'Principal Distributed Systems Architect',
          department: 'Engineering',
          kpi: 96
        }
      },
      {
        id: 'comp-hyperscale',
        name: 'HyperScale GTM',
        marketSharePct: 28.5,
        valuationUsd: 720000,
        poached: false,
        topStar: {
          name: 'Soraia Lindqvist',
          avatar: '🚀',
          role: 'VP Viral Growth & Funnel Engineering',
          department: 'Marketing',
          kpi: 95
        }
      },
      {
        id: 'comp-quant',
        name: 'QuantLedger FinOps',
        marketSharePct: 24.0,
        valuationUsd: 560000,
        poached: false,
        topStar: {
          name: 'Darius Vance-Sterling',
          avatar: '💎',
          role: 'Head of Algorithmic Pricing & FinOps',
          department: 'Finance',
          kpi: 94
        }
      }
    ],
    boardInbox: [
      {
        id: 'board-welcome-1',
        type: 'BUDGET_EXPANSION',
        title: 'Approve Sprint R&D Compute Allocation (+$10.00 Budget)',
        department: 'Finance',
        proposedBy: 'Elena Rostova (CFO)',
        detail: 'Expand total company budget cap by $10.00 to accelerate parallel Engineering + Marketing tool executions.',
        payload: { addBudget: 10 },
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ],
    workspaceFiles: [
      {
        id: 'file-charter',
        filename: 'COMPANY_CHARTER.md',
        department: 'Executive',
        author: 'Aria Vance (CEO)',
        sizeBytes: 512,
        content: `# ${template.name} — Autonomous Charter\n\n- **Theme:** ${template.theme}\n- **Mission:** ${template.goal}\n- **Architecture:** Paperclip Org Governance + Hermes Recursive Sub-Agents + MetaGPT SOPs + ChatDev Handoffs\n`,
        updatedAt: new Date().toISOString()
      }
    ],
    consoleMessages: [
      {
        id: 'msg-init-1',
        timestamp: new Date().toISOString(),
        fromId: 'ceo',
        fromName: '👑 Aria Vance (Executive)',
        fromDept: 'Executive',
        toId: 'all',
        toName: '📡 Shared Mission Bus',
        type: 'BROADCAST',
        taskTitle: 'Shared Mission Kickoff',
        message: `Team, our shared mission is live: "${template.goal}". Every specialist can spawn Hermes-style sub-agents for complex subtasks, write real files to the Company Workspace, and pass structured handoffs in this console.`
      }
    ],
    memoryWiki: [
      {
        id: 'mem-founding',
        title: 'Company Founding Charter & Hermes Sub-Agent Protocol',
        department: 'Executive',
        author: 'Aria Vance (CEO)',
        type: 'CHARTER',
        content: `Mission initialized: ${template.goal}\nAll agents operate as distinct specialists with dedicated tools and models, can recursively spawn focused sub-agents for parallel decomposition, pass tasks across departments via the Shared Mission Console, and self-improve by synthesizing reusable SKILL.md modules.`,
        createdAt: new Date().toISOString()
      }
    ],
    ledger: [],
    events: [
      {
        id: 'evt-init',
        timestamp: new Date().toISOString(),
        type: 'SYSTEM',
        department: 'Executive',
        actor: 'System',
        title: `Company "${template.name}" Initialized`,
        detail: `Theme: ${template.theme} | Goal: ${template.goal}`
      }
    ]
  };
}

module.exports = {
  COMPANY_TEMPLATES,
  GITHUB_INTEGRATIONS,
  createFoundingAgents,
  createInitialSkills,
  createInitialState
};
