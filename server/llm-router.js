/**
 * Universal Multi-Provider LLM Router for AI Company OS (Optimized v2)
 * Supports: OpenAI, Anthropic, Google Gemini, Ollama (Local), OpenRouter, Groq, DeepSeek, Custom OpenAI-Compatible, and Built-in Autonomous Simulator.
 * Features: Per-Agent Provider/Model Override, Prompt Compression, LRU Response Cache, and Inter-Agent Handoff Simulation.
 */

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini'],
    endpoint: 'https://api.openai.com/v1/chat/completions',
    requiresKey: true
  },
  anthropic: {
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-7-sonnet-latest',
    models: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    endpoint: 'https://api.anthropic.com/v1/messages',
    requiresKey: true
  },
  gemini: {
    name: 'Google Gemini (★ #1 Best Free Cloud API)',
    defaultModel: 'gemini-3.8-flash',
    models: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    requiresKey: true,
    signupUrl: 'https://aistudio.google.com/apikey',
    recommendation: 'Best free cloud tier for multi-agent loops: huge 1M context window & generous daily rate limits.'
  },
  ollama: {
    name: 'Ollama Local PC (★ #1 Best Zero-Cost Local GPU)',
    defaultModel: 'qwen2.5-coder:7b',
    models: ['qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'llama3.2', 'deepseek-r1:8b', 'mistral'],
    endpoint: 'http://localhost:11434/v1/chat/completions',
    requiresKey: false,
    signupUrl: 'https://ollama.com',
    recommendation: 'Run `ollama run qwen2.5-coder:7b` on your PC: 100% free, zero rate limits, top coding & tool-use accuracy.'
  },
  groq: {
    name: 'Groq LPU (★ Fastest 500+ tok/sec)',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-2.5-coder-32b', 'deepseek-r1-distill-llama-70b'],
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    requiresKey: true,
    signupUrl: 'https://console.groq.com/keys',
    recommendation: 'Blazing-fast LPU inference. Tip: use `llama-3.1-8b-instant` for high-frequency worker agents to save daily token quota.'
  },
  openrouter: {
    name: 'OpenRouter (Unified + :free Models)',
    defaultModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
    models: [
      'qwen/qwen-2.5-coder-32b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-r1:free',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.7-sonnet'
    ],
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    requiresKey: true,
    signupUrl: 'https://openrouter.ai/keys',
    recommendation: 'Single API key for 200+ models including `:free` tier models.'
  },
  deepseek: {
    name: 'DeepSeek (V3 & R1 Reasoner)',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    requiresKey: true,
    signupUrl: 'https://platform.deepseek.com',
    recommendation: 'Ultra-low cost ($0.27/1M tokens) and strong coding/math reasoning.'
  },
  custom: {
    name: 'Custom OpenAI-Compatible (LM Studio / vLLM)',
    defaultModel: 'local-model',
    models: ['local-model'],
    endpoint: 'http://localhost:1234/v1/chat/completions',
    requiresKey: false
  },
  simulator: {
    name: 'Built-in Autonomous Engine (Zero-Key Demo / Simulation)',
    defaultModel: 'company-sim-v2',
    models: ['company-sim-v2', 'company-sim-turbo'],
    endpoint: 'internal://simulator',
    requiresKey: false
  }
};

const COST_PER_1M = {
  openai: { input: 0.40, output: 1.60 },
  anthropic: { input: 3.00, output: 15.00 },
  gemini: { input: 0.30, output: 1.20 },
  groq: { input: 0.59, output: 0.79 },
  openrouter: { input: 0.50, output: 1.50 },
  deepseek: { input: 0.27, output: 1.10 },
  ollama: { input: 0.05, output: 0.05 },
  custom: { input: 0.10, output: 0.10 },
  simulator: { input: 0.20, output: 0.60 }
};

// Lightweight LRU Cache for optimization
const responseCache = new Map();
const MAX_CACHE_ENTRIES = 80;

function compressPrompt(text = '') {
  return String(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function estimateTokens(text = '') {
  return Math.max(8, Math.ceil(String(text).length / 4));
}

function calculateCost(provider, promptTokens, completionTokens) {
  const rates = COST_PER_1M[provider] || { input: 0.5, output: 1.5 };
  const cost = (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
  return Number(Math.max(0.0015, cost * 22).toFixed(4));
}

async function callLLM({ providerConfig, agent, systemPrompt, userPrompt, jsonMode = false, useCache = false }) {
  // Respect per-agent provider & model override if configured on this specific worker
  const activeProvider = (agent?.providerOverride && agent.providerOverride !== 'inherit')
    ? agent.providerOverride
    : (providerConfig?.activeProvider || 'simulator');

  const settings = providerConfig?.providers?.[activeProvider] || {};
  const model = (agent?.modelOverride && agent.modelOverride.trim())
    ? agent.modelOverride.trim()
    : (settings.model || PROVIDERS[activeProvider]?.defaultModel || 'gpt-4o-mini');

  const temperature = typeof agent?.temperature === 'number' ? agent.temperature : 0.7;
  const apiKey = settings.apiKey || process.env[`${activeProvider.toUpperCase()}_API_KEY`] || '';
  const baseUrl = settings.baseUrl || PROVIDERS[activeProvider]?.endpoint;

  const compressedSys = compressPrompt(systemPrompt);
  const compressedUser = compressPrompt(userPrompt);
  const tokensSaved = Math.max(0, estimateTokens(systemPrompt + userPrompt) - estimateTokens(compressedSys + compressedUser));

  const cacheKey = `${activeProvider}:${model}:${compressedSys.slice(0, 120)}:${compressedUser}`;
  if (useCache && responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    return { ...cached, cached: true, tokensSaved: tokensSaved + cached.promptTokens };
  }

  if (PROVIDERS[activeProvider]?.requiresKey && !apiKey) {
    return runSimulator({
      agent,
      systemPrompt: compressedSys,
      userPrompt: compressedUser,
      jsonMode,
      tokensSaved,
      fallbackNotice: `No API key set for ${activeProvider}; used Autonomous Simulator.`
    });
  }

  if (activeProvider === 'simulator') {
    return runSimulator({ agent, systemPrompt: compressedSys, userPrompt: compressedUser, jsonMode, tokensSaved });
  }

  try {
    let content = '';
    let promptTokens = estimateTokens(compressedSys + compressedUser);
    let completionTokens = 0;

    if (activeProvider === 'anthropic') {
      const res = await fetch(baseUrl || 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: agent?.maxTokens || 2048,
          temperature,
          system: compressedSys,
          messages: [{ role: 'user', content: compressedUser }]
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      content = data.content?.[0]?.text || '';
      promptTokens = data.usage?.input_tokens || promptTokens;
      completionTokens = data.usage?.output_tokens || estimateTokens(content);
    } else if (activeProvider === 'gemini') {
      const url = `${baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models'}/${model}:generateContent?key=${apiKey}`;
      const body = {
        systemInstruction: { parts: [{ text: compressedSys }] },
        contents: [{ role: 'user', parts: [{ text: compressedUser }] }],
        generationConfig: {
          temperature,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {})
        }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      promptTokens = data.usageMetadata?.promptTokenCount || promptTokens;
      completionTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(content);
    } else {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      if (activeProvider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/ai-company-os';
        headers['X-Title'] = 'AI Company OS';
      }

      const payload = {
        model,
        messages: [
          { role: 'system', content: compressedSys },
          { role: 'user', content: compressedUser }
        ],
        temperature
      };
      if (jsonMode && (activeProvider === 'openai' || activeProvider === 'groq' || activeProvider === 'deepseek')) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${activeProvider.toUpperCase()} API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      content = data.choices?.[0]?.message?.content || '';
      promptTokens = data.usage?.prompt_tokens || promptTokens;
      completionTokens = data.usage?.completion_tokens || estimateTokens(content);
    }

    const cost = calculateCost(activeProvider, promptTokens, completionTokens);
    const result = {
      content,
      provider: activeProvider,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      tokensSaved,
      cost
    };

    if (responseCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = responseCache.keys().next().value;
      responseCache.delete(oldestKey);
    }
    responseCache.set(cacheKey, result);
    return result;
  } catch (error) {
    return runSimulator({
      agent,
      systemPrompt: compressedSys,
      userPrompt: compressedUser,
      jsonMode,
      tokensSaved,
      fallbackNotice: `Provider ${activeProvider} failed (${error.message}); fell back to Simulator.`
    });
  }
}

async function runSimulator({ agent, systemPrompt, userPrompt, jsonMode, tokensSaved = 0, fallbackNotice = null }) {
  await new Promise((r) => setTimeout(r, 180));
  let content = '';

  if (userPrompt.includes('ACTION:CEO_PLAN')) {
    const themeMatch = userPrompt.match(/Company Goal:\s*(.+)/i);
    const goal = themeMatch ? themeMatch[1].trim() : 'Build an AI-driven product';
    content = JSON.stringify({
      executiveSummary: `Cross-departmental shared mission initialized for: "${goal}". Tasks will flow across Engineering, Marketing, Finance, and QA via live agent handoffs.`,
      hireRequests: [
        {
          role: 'Lead Systems Architect',
          department: 'Engineering',
          reportsTo: 'cto',
          reason: `Core system architecture & API implementation for ${goal}`,
          skills: ['System Design', 'Distributed APIs', 'Security', 'Code Gen']
        },
        {
          role: 'Growth & GTM Strategist',
          department: 'Marketing',
          reportsTo: 'cmo',
          reason: `Positioning, viral loops, and acquisition funnel for ${goal}`,
          skills: ['Copywriting', 'Growth Loops', 'SEO', 'Funnel Analytics']
        },
        {
          role: 'Unit Economics Analyst',
          department: 'Finance',
          reportsTo: 'cfo',
          reason: `Pricing model, margin optimization & token cost forecast for ${goal}`,
          skills: ['Financial Modeling', 'Pricing Strategy', 'Token ROI']
        }
      ],
      tasks: [
        {
          title: 'Core Platform Architecture & API Pipeline',
          department: 'Engineering',
          collaboratorDept: 'Finance',
          priority: 'High',
          description: `Design the full stack architecture and hand off to Finance to validate infrastructure unit costs for: ${goal}`
        },
        {
          title: 'Go-To-Market Launch & Conversion Funnel',
          department: 'Marketing',
          collaboratorDept: 'Engineering',
          priority: 'High',
          description: `Build positioning & landing funnel, then hand off to Engineering for telemetry integration: ${goal}`
        },
        {
          title: 'Pricing Tiers & 12-Month Margin Model',
          department: 'Finance',
          collaboratorDept: 'Marketing',
          priority: 'Medium',
          description: `Create pricing tiers and unit economics, then hand off to Marketing to align packaging: ${goal}`
        },
        {
          title: 'End-to-End Stress Test & Security Audit',
          department: 'QA',
          collaboratorDept: 'Engineering',
          priority: 'Medium',
          description: `Define automated verification suites and edge-case guardrails for: ${goal}`
        }
      ]
    }, null, 2);
  } else if (userPrompt.includes('ACTION:HR_HIRE')) {
    const roleMatch = userPrompt.match(/Role:\s*([^\n]+)/i);
    const deptMatch = userPrompt.match(/Department:\s*([^\n]+)/i);
    const role = roleMatch ? roleMatch[1].trim() : 'Specialist Agent';
    const dept = deptMatch ? deptMatch[1].trim() : 'Engineering';
    const codenames = ['Nova', 'Atlas', 'Vega', 'Orion', 'Lyra', 'Zephyr', 'Echo', 'Pulse', 'Kestrel', 'Cipher'];
    const pickedName = `${role} (${codenames[Math.floor(Math.random() * codenames.length)]})`;
    content = JSON.stringify({
      name: pickedName,
      role,
      department: dept,
      systemPrompt: `You are ${pickedName}, a specialized ${role} in the ${dept} department. You collaborate closely with peer agents across departments, pass structured handoff notes in the Shared Mission Console, and produce quantitative, production-grade deliverables.`,
      sops: [
        `SOP-01: Align ${dept} artifacts directly with the shared company mission.`,
        `SOP-02: Include clear handoff notes and interface contracts when passing tasks to collaborating agents.`
      ],
      tools: dept === 'Engineering' ? ['workspace_coder', 'sql_schema_architect', 'unit_test_runner', 'benchmark_profiler', 'openapi_contract_synth']
        : dept === 'Marketing' ? ['landing_page_builder', 'live_market_intel', 'seo_copy_auditor']
        : dept === 'Finance' ? ['financial_monte_carlo']
        : ['qa_sandbox_verifier'],
      salaryPerTask: 0.04
    }, null, 2);
  } else if (userPrompt.includes('ACTION:WORKER_EXECUTE')) {
    const titleMatch = userPrompt.match(/Task Title:\s*([^\n]+)/i);
    const goalMatch = userPrompt.match(/Company Mission:\s*([^\n]+)/i);
    const handoffMatch = userPrompt.match(/Prior Handoff Context:\s*([^\n]+)/i);
    const nextAgentMatch = userPrompt.match(/Next Collaborator:\s*([^\n]+)/i);
    const sopMatch = userPrompt.match(/Learned SOPs:\s*([^\n]+)/i);
    const toolCtxMatch = userPrompt.match(/Real Tool & Script Execution Results:\n([\s\S]+?)(?:\nLearned SOPs:|$)/i);

    const taskTitle = titleMatch ? titleMatch[1].trim() : 'Strategic Deliverable';
    const mission = goalMatch ? goalMatch[1].trim() : 'Company Objective';
    const priorHandoff = handoffMatch ? handoffMatch[1].trim() : 'Initial Stage';
    const nextCollab = nextAgentMatch ? nextAgentMatch[1].trim() : 'QA Director';
    const hasSopUpgrade = sopMatch && sopMatch[1].includes('QA-RETRAIN');
    const toolTelemetryBlock = toolCtxMatch ? toolCtxMatch[1].trim() : 'Executed department tool scripts in /workspace.';

    const safeAgentLabel = (agent?.name || 'Lead Agent').replace(/["[\]()]/g, '');
    const safeNextLabel = (nextCollab || 'QA Director').replace(/["[\]()]/g, '');
    const safeToolLabel = (agent?.activeTool || 'workspace_coder').replace(/["[\]()]/g, '');

    content = `### Deliverable: ${taskTitle}
**Lead Agent:** ${agent?.name || 'Specialist'} (${agent?.role || 'Worker'} • ${agent?.department || 'Ops'})
**Active MCP Tools & Scripts Executed:** \`${(agent?.tools || ['workspace_coder', 'unit_test_runner']).join('`, `')}\`
**Shared Mission:** ${mission}

---

#### 1. MCP Progressive Router & Script Execution Telemetry
${toolTelemetryBlock}

#### 2. Live A2A & MCP Execution Architecture (Mermaid Diagram)
\`\`\`mermaid
flowchart LR
  Router["🔌 MCP Progressive Router"] --> Tool["⚙️ ${safeToolLabel}"]
  Tool --> Artifact["📂 /workspace Artifact"]
  Artifact --> Agent["🤖 ${safeAgentLabel}"]
  Agent -->|A2A Protocol Handoff| Next["🤝 ${safeNextLabel}"]
  Next --> QA["🛡️ Zero-Trust QA Gate"]
\`\`\`

#### 3. Execution & Collaborative Contribution
- **Prior Handoff Integrated:** ${priorHandoff}
- **Core Output:** Modular, production-verified artifacts written to \`/workspace\` and validated via automated MCP scripts for immediate cross-department consumption.
${hasSopUpgrade ? '- **Self-Taught SOP Applied:** Added quantitative fault-tolerance bounds and strict unit-cost verification per HR/QA retraining.\n' : ''}
#### 4. Technical / A2A Operational Contract
\`\`\`yaml
protocol: "Google-A2A-1.0 + Anthropic-MCP-2025-03-26"
artifact_id: "${taskTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}"
owner_agent: "${agent?.name || 'worker'}"
active_mcp_tool: "${agent?.activeTool || (agent?.tools && agent.tools[0]) || 'workspace_coder'}"
handoff_target: "${nextCollab}"
status: "ready_for_handoff"
kpis:
  conversion_or_throughput_lift: "+42%"
  p99_latency_ms: 18.6
  ltv_to_cac_ratio: 6.8
  cost_per_execution_usd: 0.014
\`\`\`

#### 5. Handoff Package -> ${nextCollab}
- Verified schema, unit tests, and interface constraints via automated scripts.
- Ready for downstream review and integration in the Shared Mission Console.`;
  } else if (userPrompt.includes('ACTION:AGENT_HANDOFF_CONSOLE')) {
    const fromMatch = userPrompt.match(/From Agent:\s*([^\n]+)/i);
    const toMatch = userPrompt.match(/To Agent:\s*([^\n]+)/i);
    const taskMatch = userPrompt.match(/Task:\s*([^\n]+)/i);
    const fromA = fromMatch ? fromMatch[1].trim() : 'Agent A';
    const toA = toMatch ? toMatch[1].trim() : 'Agent B';
    const tName = taskMatch ? taskMatch[1].trim() : 'Shared Task';
    content = JSON.stringify({
      handoffMessage: `@${toA} — I've completed my stage on "${tName}". Passing the artifact package to you now. Please validate your department's constraints before we send to QA.`,
      replyMessage: `Received @${fromA}! Merging your output with my departmental tools and running cross-check now.`
    });
  } else if (userPrompt.includes('ACTION:QA_AUDIT')) {
    const isRetrained = userPrompt.includes('QA-RETRAIN') || userPrompt.includes('Retrained: true');
    const hasCollaborated = userPrompt.includes('Handoffs Completed: 2') || userPrompt.includes('Handoffs Completed: 3');
    const randomRoll = Math.random();
    const score = isRetrained
      ? Math.floor(88 + Math.random() * 11)
      : randomRoll < 0.34
        ? Math.floor(55 + Math.random() * 17)
        : Math.floor((hasCollaborated ? 81 : 77) + Math.random() * 18);

    const passed = score >= 75;
    content = JSON.stringify({
      score,
      passed,
      verdict: passed ? 'APPROVED' : score < 60 ? 'CRITICAL_DEFICIENCY' : 'NEEDS_RETRAINING',
      strengths: [
        'Strong cross-agent handoff continuity across the shared mission',
        'Structured YAML specification and measurable KPI benchmarks'
      ],
      weaknesses: passed
        ? ['Could further tighten automated telemetry alerts in Sprint +1']
        : [
            'Handoff contract between departments lacked explicit rollback thresholds',
            'Needs concrete unit-cost sensitivity table'
          ],
      newLessonSOP: passed
        ? `SOP-VERIFIED: Cross-agent handoffs with explicit YAML contracts yield ${score}% QA reliability.`
        : `QA-RETRAIN: Every cross-agent handoff must include explicit rollback thresholds and unit-cost bounds.`
    }, null, 2);
  } else if (userPrompt.includes('ACTION:DIRECT_CHAT')) {
    const msgMatch = userPrompt.match(/Founder Message:\s*([\s\S]+)/i);
    const founderMsg = msgMatch ? msgMatch[1].trim() : 'Status update?';
    content = `Acknowledged, Founder. Regarding "${founderMsg.slice(0, 80)}": as ${agent?.role || 'Specialist'} in ${agent?.department || 'the company'} (current KPI: ${agent?.kpi || 85}%), I am applying my ${agent?.sops?.length || 2} learned SOPs and coordinating with my peers in the Shared Mission Console to accelerate delivery.`;
  } else {
    content = jsonMode
      ? JSON.stringify({ status: 'ok', message: 'Autonomous step executed.' })
      : `Completed analysis for ${agent?.name || 'Agent'}.`;
  }

  const promptTokens = estimateTokens(systemPrompt + userPrompt);
  const completionTokens = estimateTokens(content);
  const cost = calculateCost('simulator', promptTokens, completionTokens);

  return {
    content,
    provider: agent?.providerOverride && agent.providerOverride !== 'inherit' ? agent.providerOverride : 'simulator',
    model: agent?.modelOverride || 'company-sim-v2',
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    tokensSaved,
    cost,
    fallbackNotice
  };
}

/**
 * v12 Live LLM API Connection Doctor (`testProviderConnection`)
 * Sends a lightweight live verification ping to any cloud API or local Ollama/LM Studio server
 * so the user can test their API key & round-trip latency before starting the autonomous pipeline.
 */
async function testProviderConnection({ providerKey = 'simulator', model = '', apiKey = '', baseUrl = '' }) {
  const start = Date.now();
  const meta = PROVIDERS[providerKey] || PROVIDERS.simulator;
  const targetModel = model || meta.defaultModel;
  const targetUrl = baseUrl || meta.endpoint;

  if (providerKey === 'simulator') {
    await new Promise((r) => setTimeout(r, 45));
    return {
      ok: true,
      provider: providerKey,
      model: targetModel,
      latencyMs: Math.max(12, Date.now() - start),
      reply: 'Built-in Autonomous Engine online (Zero-Key Simulation Mode ready).',
      recommendation: meta.recommendation || 'Ready for instant zero-key simulation.'
    };
  }

  if (meta.requiresKey && (!apiKey || !apiKey.trim())) {
    return {
      ok: false,
      provider: providerKey,
      model: targetModel,
      latencyMs: Date.now() - start,
      error: `Missing API Key for ${meta.name}. Get a free key at: ${meta.signupUrl || 'provider portal'}`
    };
  }

  try {
    const controller = new AbortController();
    const isLocal = providerKey === 'ollama' || providerKey === 'custom';
    const timer = setTimeout(() => controller.abort(), isLocal ? 90000 : 15000);

    let replyText = '';
    if (providerKey === 'anthropic') {
      const res = await fetch(targetUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'Reply with: AI_COMPANY_OS_CONNECTED' }]
        })
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const d = await res.json();
      replyText = d.content?.[0]?.text || 'Connected';
    } else if (providerKey === 'gemini') {
      const url = `${targetUrl}/${targetModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with: AI_COMPANY_OS_CONNECTED' }] }]
        })
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const d = await res.json();
      replyText = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Connected';
    } else {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'Reply with: AI_COMPANY_OS_CONNECTED' }]
        })
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const d = await res.json();
      replyText = d.choices?.[0]?.message?.content || 'Connected';
    }

    return {
      ok: true,
      provider: providerKey,
      model: targetModel,
      latencyMs: Math.max(1, Date.now() - start),
      reply: replyText.trim().slice(0, 120)
    };
  } catch (err) {
    return {
      ok: false,
      provider: providerKey,
      model: targetModel,
      latencyMs: Math.max(1, Date.now() - start),
      error: providerKey === 'ollama'
        ? `Could not reach local Ollama at ${targetUrl} (${err.message}). Run "ollama serve" and "ollama run ${targetModel}" on your PC.`
        : err.message
    };
  }
}

module.exports = {
  PROVIDERS,
  callLLM,
  testProviderConnection
};
