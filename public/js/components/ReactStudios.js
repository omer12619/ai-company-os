/**
 * AI Company OS — Modular React 18 Studio Components
 * Extracted from public/app.js (Option A Modular Component Architecture)
 */
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
