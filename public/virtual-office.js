/**
 * AI Company OS — Futuristic Animated Virtual Office Simulation ("People in an Office")
 * Renders an interactive 60fps 2.5D/Top-Down Futuristic Office Floorplan where:
 * - Each department is a distinct architectural room with desks, holo-screens, server racks, and lounge areas.
 * - Every hired agent is an animated character ("person") with head/shoulders/badge, bobbing/walking/typing animations,
 *   live speech bubbles, and orbiting Hermes Sub-Agent Mini-Drones.
 * - When agents pass tasks (Handoffs) or message each other in the Shared Mission Console, animated glowing
 *   Data Couriers / Handoff Orbs physically travel between their desks across the office!
 */

(function () {
  // Room layout coordinates (in a 1080 x 580 virtual office coordinate space)
  const OFFICE_ROOMS = [
    {
      id: 'Executive',
      title: '👑 EXECUTIVE PENTHOUSE & BOARDROOM',
      subtitle: 'CEO Strategy & Mission Control',
      x: 360, y: 16, w: 360, h: 145,
      color: '#6366f1',
      bgTint: 'rgba(99, 102, 241, 0.10)',
      desks: [
        { x: 540, y: 88, label: 'Holo-Board Table' }
      ]
    },
    {
      id: 'HR',
      title: '🤝 HR & NEURAL TRAINING LAB',
      subtitle: 'Recruitment Portal & SOP Upgrades',
      x: 18, y: 16, w: 324, h: 175,
      color: '#f59e0b',
      bgTint: 'rgba(245, 158, 11, 0.09)',
      desks: [
        { x: 110, y: 95, label: 'HR Director Desk' },
        { x: 245, y: 95, label: 'Neural Training Pod' }
      ]
    },
    {
      id: 'QA',
      title: '🛡️ QA CYBER-AUDIT CHAMBER',
      subtitle: 'Zero-Trust Verification & Skill Synth',
      x: 738, y: 16, w: 324, h: 175,
      color: '#38bdf8',
      bgTint: 'rgba(56, 189, 248, 0.09)',
      desks: [
        { x: 840, y: 95, label: 'QA Scanner Gate' },
        { x: 970, y: 95, label: 'Stress Test Rig' }
      ]
    },
    {
      id: 'Engineering',
      title: '⚡ ENGINEERING & SERVER BAY (CTO)',
      subtitle: 'Architecture, Code Synth & Sub-Agents',
      x: 18, y: 208, w: 360, h: 220,
      color: '#10b981',
      bgTint: 'rgba(16, 185, 129, 0.09)',
      desks: [
        { x: 105, y: 285, label: 'CTO Command Rig' },
        { x: 225, y: 285, label: 'Dev Station Alpha' },
        { x: 315, y: 285, label: 'Dev Station Beta' },
        { x: 155, y: 375, label: 'Systems Lab' },
        { x: 285, y: 375, label: 'AI Cluster Node' }
      ]
    },
    {
      id: 'Commons',
      title: '☕ HOLO-COMMONS & COLLAB HUB',
      subtitle: 'Shared Mission Bus & Coffee Lounge',
      x: 396, y: 178, w: 288, h: 210,
      color: '#a855f7',
      bgTint: 'rgba(168, 85, 247, 0.08)',
      desks: [
        { x: 485, y: 275, label: 'Coffee Bar' },
        { x: 595, y: 275, label: 'Collab Holo-Table' },
        { x: 540, y: 340, label: 'Lounge Sofa' }
      ]
    },
    {
      id: 'Marketing',
      title: '🚀 MARKETING & GROWTH STUDIO (CMO)',
      subtitle: 'GTM Funnels, Copy & Viral Loops',
      x: 702, y: 208, w: 360, h: 220,
      color: '#ec4899',
      bgTint: 'rgba(236, 72, 153, 0.09)',
      desks: [
        { x: 785, y: 285, label: 'CMO Studio' },
        { x: 895, y: 285, label: 'Growth Radar' },
        { x: 990, y: 285, label: 'Copy Lab' },
        { x: 835, y: 375, label: 'SEO Matrix' },
        { x: 955, y: 375, label: 'Media Hub' }
      ]
    },
    {
      id: 'Finance',
      title: '💎 CFO FINANCIAL VAULT & LEDGER',
      subtitle: 'Token Economics, Pricing & Budget Guard',
      x: 18, y: 444, w: 666, h: 120,
      color: '#eab308',
      bgTint: 'rgba(234, 179, 8, 0.09)',
      desks: [
        { x: 130, y: 506, label: 'CFO Ledger Terminal' },
        { x: 290, y: 506, label: 'Unit Econ Desk' },
        { x: 450, y: 506, label: 'Pricing Matrix' },
        { x: 590, y: 506, label: 'ROI Forecaster' }
      ]
    },
    {
      id: 'Airlock',
      title: '🔥 HR EXIT AIRLOCK & ARCHIVE',
      subtitle: 'Terminated / Fired Agent Portal',
      x: 702, y: 444, w: 360, h: 120,
      color: '#ef4444',
      bgTint: 'rgba(239, 68, 68, 0.09)',
      desks: [
        { x: 880, y: 506, label: 'Decommission Gate' }
      ]
    }
  ];

  // Persistent animation state for smooth 60fps interpolation of agent positions & courier packets
  const animAgents = new Map();
  let courierPackets = [];
  let officeParticles = [];
  let officeRipples = [];
  const ambientMotes = [];
  for (let i = 0; i < 24; i++) {
    ambientMotes.push({
      x: Math.random() * 1080,
      y: Math.random() * 580,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 8 - 2,
      r: 1 + Math.random() * 1.6,
      color: ['#38bdf8', '#818cf8', '#34d399', '#c084fc', '#f59e0b'][Math.floor(Math.random() * 5)],
      alpha: 0.16 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2
    });
  }
  let lastConsoleId = null;
  let showBubbles = true;
  let coffeeBreakMode = false;
  let soundFxEnabled = false;
  let audioCtx = null;

  function playOfficeSound(type = 'handoff') {
    if (!soundFxEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'revenue') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'redteam') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(440, now + 0.18);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      }
    } catch {}
  }
  window.playOfficeSound = playOfficeSound;

  function isWarRoomActive(state) {
    if (!state?.company?.lastWarRoomAt) return false;
    const elapsed = Date.now() - new Date(state.company.lastWarRoomAt).getTime();
    return elapsed >= 0 && elapsed < 22000;
  }

  function getTargetCoordsForAgent(agent, deptIndex, state) {
    if (isWarRoomActive(state) && agent.tier === 'c-suite') {
      const warRoomSeats = {
        ceo: { x: 540, y: 235 },
        cto: { x: 465, y: 268 },
        cmo: { x: 615, y: 268 },
        cfo: { x: 475, y: 332 },
        qa: { x: 605, y: 332 },
        hr: { x: 540, y: 350 }
      };
      const seat = warRoomSeats[agent.id] || { x: 540, y: 290 };
      return { x: seat.x, y: seat.y, roomLabel: '🎙️ War Room Holo-Table' };
    }
    if (agent.status === 'training') {
      // Go to HR Neural Training Pod!
      return { x: 245, y: 105, roomLabel: 'Neural Training Pod' };
    }
    if (coffeeBreakMode && agent.status === 'idle' && agent.tier === 'worker') {
      const loungeSpots = [
        { x: 475, y: 265 },
        { x: 595, y: 265 },
        { x: 535, y: 335 },
        { x: 495, y: 315 },
        { x: 580, y: 315 }
      ];
      const spot = loungeSpots[deptIndex % loungeSpots.length];
      return { x: spot.x, y: spot.y, roomLabel: 'Holo-Commons Lounge' };
    }

    const room = OFFICE_ROOMS.find((r) => r.id.toLowerCase() === (agent.department || '').toLowerCase()) || OFFICE_ROOMS[3];
    const desk = room.desks[deptIndex % room.desks.length] || { x: room.x + 80, y: room.y + 80, label: 'Workstation' };
    // Add slight offset if multiple workers share a desk cluster
    const ringOffset = deptIndex >= room.desks.length ? ((deptIndex % 2 === 0 ? 1 : -1) * 34) : 0;
    return {
      x: desk.x + ringOffset,
      y: desk.y + 6,
      roomLabel: desk.label
    };
  }

  function syncAgentsAndPackets(state) {
    if (!state) return;
    const agents = state.agents || [];
    const deptCounters = {};

    const activeIds = new Set();
    agents.forEach((a) => {
      activeIds.add(a.id);
      const dKey = (a.department || 'Engineering').toLowerCase();
      const idx = deptCounters[dKey] || 0;
      deptCounters[dKey] = idx + 1;

      const target = getTargetCoordsForAgent(a, idx, state);
      if (!animAgents.has(a.id)) {
        // Newly hired agents spawn at HR portal first and walk to their room!
        animAgents.set(a.id, {
          x: a.tier === 'worker' ? 180 : target.x,
          y: a.tier === 'worker' ? 105 : target.y,
          tx: target.x,
          ty: target.y,
          roomLabel: target.roomLabel,
          walkPhase: Math.random() * Math.PI * 2,
          droneAngle: Math.random() * Math.PI * 2,
          facing: 1,
          tiltAngle: 0,
          phaseOffset: Math.random() * 10
        });
      } else {
        const cur = animAgents.get(a.id);
        cur.tx = target.x;
        cur.ty = target.y;
        cur.roomLabel = target.roomLabel;
      }
    });

    // Clean up fired agents
    for (const k of animAgents.keys()) {
      if (!activeIds.has(k)) animAgents.delete(k);
    }

    // Check if a new console message or handoff arrived -> spawn an animated Courier Packet between the two agents!
    const newestMsg = state.consoleMessages?.[0];
    if (newestMsg && newestMsg.id !== lastConsoleId) {
      lastConsoleId = newestMsg.id;
      const fromPos = animAgents.get(newestMsg.fromId) || { x: 540, y: 90 };
      const toPos = animAgents.get(newestMsg.toId) || { x: 540, y: 280 };
      courierPackets.push({
        id: `pkt-${Date.now()}-${Math.random()}`,
        x1: fromPos.x,
        y1: fromPos.y,
        x2: toPos.x,
        y2: toPos.y,
        progress: 0,
        color: newestMsg.type === 'HANDOFF' ? '#10b981' : newestMsg.type === 'SUBAGENT' ? '#38bdf8' : '#f59e0b',
        label: newestMsg.type === 'HANDOFF' ? '📦 Task Handoff' : '💬 Comms'
      });
      playOfficeSound(newestMsg.taskTitle?.includes('MRR') ? 'revenue' : 'handoff');
    }
  }

  // React Component for the Futuristic Virtual Office
  function VirtualOfficeComponent({ state }) {
    const h = React.createElement;
    const [tick, setTick] = React.useState(0);
    const [hoveredAgentId, setHoveredAgentId] = React.useState(null);
    const [draggingAgentId, setDraggingAgentId] = React.useState(null);
    const [dragHoverRoomId, setDragHoverRoomId] = React.useState(null);
    const [showBoardAndTools, setShowBoardAndTools] = React.useState(true);
    const [showLiveTerminalDrawer, setShowLiveTerminalDrawer] = React.useState(true);
    const [showLiveProductDrawer, setShowLiveProductDrawer] = React.useState(false);
    const [showDomAgentOverlay, setShowDomAgentOverlay] = React.useState(true);
    const [domCursorStep, setDomCursorStep] = React.useState(0);
    const [mcpPricingArpu, setMcpPricingArpu] = React.useState(99);
    const [mcpSelectedCta, setMcpSelectedCta] = React.useState('v2');
    const [focusRoomId, setFocusRoomId] = React.useState(null);
    const focusRoomIdRef = React.useRef(null);
    focusRoomIdRef.current = focusRoomId;
    const camRef = React.useRef({ x: 0, y: 0, w: 1080, h: 580 });
    const svgRef = React.useRef(null);
    const dragMovedRef = React.useRef(false);

    React.useEffect(() => {
      window.toggleGlobalProductSplit = () => setShowLiveProductDrawer((prev) => !prev);
    }, []);

    React.useEffect(() => {
      if (!showLiveProductDrawer || !showDomAgentOverlay) return;
      const timer = setInterval(() => {
        setDomCursorStep((prev) => (prev + 1) % 5);
      }, 1600);
      return () => clearInterval(timer);
    }, [showLiveProductDrawer, showDomAgentOverlay]);

    React.useEffect(() => {
      syncAgentsAndPackets(state);
    }, [state]);

    React.useEffect(() => {
      let rafId;
      let lastTime = performance.now();
      let lastReactTickTime = 0;

      const stepAnim = (now) => {
        // Pause simulation physics & React ticks when browser tab is hidden or user is viewing another OS tab
        if (document.hidden || (window.getActiveTabId && window.getActiveTabId() !== 'org')) {
          lastTime = now;
          rafId = requestAnimationFrame(stepAnim);
          return;
        }

        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        let hasActiveMotion = courierPackets.length > 0 || officeRipples.length > 0;

        // Smoothly interpolate each person walking across the office floor
        animAgents.forEach((pos) => {
          if (pos.isDragging) {
            hasActiveMotion = true;
            return;
          }
          const dx = pos.tx - pos.x;
          const dy = pos.ty - pos.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1.5) {
            hasActiveMotion = true;
            const speed = Math.max(50, dist * 3.4);
            pos.x += (dx / dist) * Math.min(dist, speed * dt);
            pos.y += (dy / dist) * Math.min(dist, speed * dt);
            pos.isWalking = true;
            pos.facing = dx >= 0.5 ? 1 : dx <= -0.5 ? -1 : (pos.facing || 1);
            pos.tiltAngle = Math.max(-10, Math.min(10, (dx / dist) * 7));
            pos.walkPhase += dt * 14;

            // Subtle running dust particle footprints (bounded cap)
            if (officeParticles.length < 45 && Math.random() < 0.25) {
              officeParticles.push({
                id: `fp-${now}-${Math.random()}`,
                x: pos.x - (dx / dist) * 6 + (Math.random() - 0.5) * 4,
                y: pos.y + 16,
                vx: -(dx / dist) * 5 + (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3 - 2,
                r: 1.2 + Math.random() * 1.5,
                color: 'rgba(148, 163, 184, 0.65)',
                life: 0.6,
                decay: 1.8
              });
            }
          } else {
            pos.x = pos.tx;
            pos.y = pos.ty;
            pos.isWalking = false;
            pos.tiltAngle = (pos.tiltAngle || 0) * 0.85;
            pos.walkPhase += dt * 4;
          }
          pos.droneAngle += dt * 2.8;
        });

        // Typing spark particles for working agents (bounded cap)
        if (state?.agents && officeParticles.length < 45) {
          state.agents.forEach((ag) => {
            if (ag.status === 'working' && Math.random() < 0.14) {
              const p = animAgents.get(ag.id);
              if (p) {
                officeParticles.push({
                  id: `spk-${now}-${Math.random()}`,
                  x: p.x + (Math.random() - 0.5) * 20,
                  y: p.y + 8,
                  vx: (Math.random() - 0.5) * 8,
                  vy: -14 - Math.random() * 18,
                  r: 1.2 + Math.random() * 1.4,
                  color: Math.random() > 0.4 ? '#38bdf8' : '#10b981',
                  life: 0.75,
                  decay: 1.5
                });
              }
            }
          });
        }

        // Advance courier packets with trail particles & arrival ripples
        courierPackets.forEach((p) => {
          p.progress += dt * 0.85;
          if (officeParticles.length < 45 && Math.random() < 0.3) {
            const curX = p.x1 + (p.x2 - p.x1) * p.progress;
            const curY = p.y1 + (p.y2 - p.y1) * p.progress - Math.sin(p.progress * Math.PI) * 34;
            officeParticles.push({
              id: `tr-${now}-${Math.random()}`,
              x: curX + (Math.random() - 0.5) * 4,
              y: curY + (Math.random() - 0.5) * 4,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              r: 1.8,
              color: p.color,
              life: 0.55,
              decay: 2.2
            });
          }
          if (p.progress >= 1 && !p.rippled) {
            p.rippled = true;
            officeRipples.push({
              id: `rip-${now}-${Math.random()}`,
              x: p.x2,
              y: p.y2,
              r: 5,
              maxR: 34,
              color: p.color,
              life: 1.0,
              decay: 2.2
            });
          }
        });
        courierPackets = courierPackets.filter((p) => p.progress < 1);

        // Update office particles
        officeParticles.forEach((pt) => {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.life -= pt.decay * dt;
        });
        officeParticles = officeParticles.filter((pt) => pt.life > 0);

        // Update arrival ripples
        officeRipples.forEach((rp) => {
          rp.r += (rp.maxR - rp.r) * 6.5 * dt;
          rp.life -= rp.decay * dt;
        });
        officeRipples = officeRipples.filter((rp) => rp.life > 0);

        // Update ambient motes
        ambientMotes.forEach((m) => {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          m.phase += dt * 1.6;
          if (m.x < 0) m.x = 1080;
          if (m.x > 1080) m.x = 0;
          if (m.y < 0) m.y = 580;
          if (m.y > 580) m.y = 0;
        });

        // Smooth 60fps direct SVG camera glide towards focused room or full office
        const targetRoom = OFFICE_ROOMS.find((r) => r.id === focusRoomIdRef.current);
        const targetCam = targetRoom
          ? { x: targetRoom.x - 24, y: targetRoom.y - 18, w: targetRoom.w + 48, h: targetRoom.h + 36 }
          : { x: 0, y: 0, w: 1080, h: 580 };

        camRef.current.x += (targetCam.x - camRef.current.x) * Math.min(1, 5.2 * dt);
        camRef.current.y += (targetCam.y - camRef.current.y) * Math.min(1, 5.2 * dt);
        camRef.current.w += (targetCam.w - camRef.current.w) * Math.min(1, 5.2 * dt);
        camRef.current.h += (targetCam.h - camRef.current.h) * Math.min(1, 5.2 * dt);

        if (svgRef.current) {
          svgRef.current.setAttribute(
            'viewBox',
            `${camRef.current.x.toFixed(1)} ${camRef.current.y.toFixed(1)} ${camRef.current.w.toFixed(1)} ${camRef.current.h.toFixed(1)}`
          );
        }

        // Adaptive Frame Pacing: 32ms (~30fps) during active walking/packets, 55ms (~18fps) during stationary ambient idle
        const minIntervalMs = hasActiveMotion ? 30 : 52;
        if (now - lastReactTickTime >= minIntervalMs) {
          lastReactTickTime = now;
          setTick((t) => (t + 1) % 1000000);
        }
        rafId = requestAnimationFrame(stepAnim);
      };

      rafId = requestAnimationFrame(stepAnim);
      return () => cancelAnimationFrame(rafId);
    }, []);

    if (!state) return null;
    const agents = state.agents || [];
    const firedAgents = state.firedAgents || [];
    const recentMsgs = (state.consoleMessages || []).slice(0, 6);

    // Map latest speech bubble per agent
    const speechMap = {};
    recentMsgs.forEach((m) => {
      if (m.fromId && !speechMap[m.fromId]) {
        speechMap[m.fromId] = m.message;
      }
    });

    const triggerTestHandoff = () => {
      if (agents.length < 2) return;
      const a1 = agents[Math.floor(Math.random() * agents.length)];
      const a2 = agents.find((x) => x.id !== a1.id) || agents[0];
      const p1 = animAgents.get(a1.id) || { x: 540, y: 90 };
      const p2 = animAgents.get(a2.id) || { x: 220, y: 285 };
      courierPackets.push({
        id: `pkt-${Date.now()}`,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        progress: 0,
        color: '#00f0ff',
        label: '⇄ Data Packet'
      });
    };

    const getSvgCoords = (evt) => {
      const svg = svgRef.current;
      if (!svg) return { x: 540, y: 290 };
      const rect = svg.getBoundingClientRect();
      const cam = camRef.current || { x: 0, y: 0, w: 1080, h: 580 };
      const x = cam.x + ((evt.clientX - rect.left) / rect.width) * cam.w;
      const y = cam.y + ((evt.clientY - rect.top) / rect.height) * cam.h;
      return {
        x: Math.max(cam.x + 8, Math.min(cam.x + cam.w - 8, x)),
        y: Math.max(cam.y + 8, Math.min(cam.y + cam.h - 8, y))
      };
    };

    const findRoomAtCoords = (x, y) => {
      return OFFICE_ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
    };

    const handleSvgMouseMove = (evt) => {
      if (!draggingAgentId) return;
      dragMovedRef.current = true;
      const pt = getSvgCoords(evt);
      const pos = animAgents.get(draggingAgentId);
      if (pos) {
        pos.x = pt.x;
        pos.y = pt.y;
        pos.isDragging = true;
      }
      const room = findRoomAtCoords(pt.x, pt.y);
      setDragHoverRoomId(room ? room.id : null);
    };

    const handleSvgMouseUp = async (evt) => {
      if (!draggingAgentId) return;
      const agentId = draggingAgentId;
      const pos = animAgents.get(agentId);
      if (pos) pos.isDragging = false;
      setDraggingAgentId(null);
      const targetRoomId = dragHoverRoomId;
      setDragHoverRoomId(null);

      if (dragMovedRef.current && targetRoomId && targetRoomId !== 'Commons') {
        try {
          const res = await fetch('/api/agents/reassign-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, targetRoom: targetRoomId })
          });
          const data = await res.json();
          if (data.state && window.syncFromExternalState) {
            window.syncFromExternalState(data.state);
          }
        } catch (err) {
          console.error('Failed room reassignment:', err);
        }
      }
    };

    const resolveProposal = async (proposalId, decision) => {
      try {
        const res = await fetch('/api/board/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId, decision })
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
      } catch (e) {
        console.error('Board resolve error:', e);
      }
    };

    const triggerWarRoomStandup = async () => {
      try {
        const res = await fetch('/api/company/war-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
        // Spawn a multi-beam War Room courier burst around the Holo-Table!
        const seats = [
          { x: 540, y: 235 },
          { x: 465, y: 268 },
          { x: 615, y: 268 },
          { x: 475, y: 332 }
        ];
        for (let i = 0; i < seats.length; i++) {
          const next = seats[(i + 1) % seats.length];
          courierPackets.push({
            id: `war-pkt-${Date.now()}-${i}`,
            x1: seats[i].x,
            y1: seats[i].y,
            x2: next.x,
            y2: next.y,
            progress: 0,
            color: '#a855f7',
            label: '🎙️ War Room Sync'
          });
        }
      } catch (e) {
        console.error('War room standup error:', e);
      }
    };

    const saveCheckpoint = async () => {
      try {
        const res = await fetch('/api/company/checkpoints/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
      } catch (e) {
        console.error('Save checkpoint error:', e);
      }
    };

    const restoreLatestCheckpoint = async () => {
      const latest = (state.checkpoints || [])[0];
      if (!latest) return;
      try {
        const res = await fetch('/api/company/checkpoints/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkpointId: latest.id })
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
      } catch (e) {
        console.error('Restore checkpoint error:', e);
      }
    };

    const triggerRedTeamAudit = async () => {
      try {
        playOfficeSound('redteam');
        const res = await fetch('/api/company/red-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
        // Fire Red Team laser probe beams from QA Chamber (880, 95) to Engineering, Marketing, and Finance!
        const targets = [
          { x: 225, y: 285, label: '🧨 Patch JS Service' },
          { x: 895, y: 285, label: '🧨 Audit CSP/HTML' },
          { x: 290, y: 506, label: '🧨 Stress Margin' }
        ];
        targets.forEach((t, idx) => {
          courierPackets.push({
            id: `red-pkt-${Date.now()}-${idx}`,
            x1: 880,
            y1: 95,
            x2: t.x,
            y2: t.y,
            progress: 0,
            color: '#ef4444',
            label: t.label
          });
        });
      } catch (e) {
        console.error('Red team audit error:', e);
      }
    };

    const poachRivalStar = async (competitorId = null) => {
      try {
        playOfficeSound('revenue');
        const res = await fetch('/api/company/poach-talent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitorId })
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
      } catch (e) {
        console.error('Poach talent error:', e);
      }
    };

    const toggleShiftMode = async () => {
      const cur = state.company?.shiftMode || 'day';
      const next = cur === 'day' ? 'crunch' : cur === 'crunch' ? 'night' : 'day';
      try {
        const res = await fetch('/api/company/shift-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shiftMode: next })
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
      } catch (e) {
        console.error('Shift mode error:', e);
      }
    };

    const triggerSelfHealingDebugger = async () => {
      try {
        playOfficeSound('handoff');
        const res = await fetch('/api/workspace/auto-heal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.state && window.syncFromExternalState) {
          window.syncFromExternalState(data.state);
        }
        // Fire cyan/emerald Self-Healing AST repair beams from Engineering (225, 285) to QA & Commons!
        const healTargets = [
          { x: 880, y: 95, label: '🩹 AST Syntax Verified' },
          { x: 540, y: 280, label: '🩹 Self-Heal Report' }
        ];
        healTargets.forEach((t, idx) => {
          courierPackets.push({
            id: `heal-pkt-${Date.now()}-${idx}`,
            x1: 225,
            y1: 285,
            x2: t.x,
            y2: t.y,
            progress: 0,
            color: '#06b6d4',
            label: t.label
          });
        });
      } catch (e) {
        console.error('Self-heal error:', e);
      }
    };

    const pendingProposals = (state.boardInbox || []).filter((p) => p.status === 'pending');
    const toolLogs = (state.toolExecutions || []).slice(0, 6);
    const checkpoints = state.checkpoints || [];
    const competitors = state.competitors || [];
    const warRoomNow = isWarRoomActive(state);
    const mrr = state.company?.mrr || 0;
    const customersCount = state.company?.customersCount || 0;
    const valuationM = ((state.company?.valuationUsd || 250000) / 1000000).toFixed(2);
    const marketShare = state.company?.marketSharePct || 14.0;
    const shiftMode = state.company?.shiftMode || 'day';

    return h('div', { className: 'virtual-office-shell' },
      // Top Futuristic Office HUD Controls Bar
      h('div', { className: 'office-hud-toolbar' },
        h('div', { className: 'office-hud-left' },
          h('span', { className: 'hud-live-pill' }, warRoomNow ? '🎙️ WAR ROOM STANDUP ACTIVE' : '🟢 2.5D HOLO-OFFICE'),
          h('span', {
            className: 'hud-live-pill',
            style: { background: 'rgba(16, 185, 129, 0.16)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }
          }, `💰 MRR: $${mrr.toLocaleString()}/mo (${customersCount} Cust)`),
          h('span', {
            className: 'hud-live-pill',
            style: { background: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }
          }, `🏆 Val: $${valuationM}M • Share: ${marketShare}%`)
        ),
        h('div', { className: 'office-hud-actions' },
          h('button', {
            className: 'btn btn-sm btn-primary',
            onClick: triggerWarRoomStandup
          }, '🎙️ War Room'),
          h('button', {
            className: 'btn btn-sm btn-danger',
            onClick: triggerRedTeamAudit,
            title: 'Scan & auto-harden all /workspace files'
          }, '🧨 Red Team'),
          h('button', {
            className: 'btn btn-sm btn-secondary',
            style: { borderColor: '#06b6d4', color: '#38bdf8' },
            onClick: triggerSelfHealingDebugger,
            title: 'Closed-Loop Evaluator-Optimizer: Scan & auto-repair any broken syntax or failing tests in /workspace'
          }, '🩹 Auto-Heal Code'),
          h('button', {
            className: 'btn btn-sm btn-success',
            onClick: () => poachRivalStar(null),
            title: 'Poach a 95% KPI star from a rival startup'
          }, '🎯 Poach Rival Star'),
          h('button', {
            className: 'btn btn-sm btn-secondary',
            onClick: toggleShiftMode
          }, shiftMode === 'crunch' ? '🚨 Shift: CRUNCH (2.3x)' : shiftMode === 'night' ? '🌙 Shift: NIGHT' : '☀️ Shift: DAY'),
          h('button', {
            className: 'btn btn-sm btn-secondary',
            onClick: saveCheckpoint
          }, `💾 Snap (${checkpoints.length})`),
          checkpoints.length > 0 && h('button', {
            className: 'btn btn-sm btn-secondary',
            onClick: restoreLatestCheckpoint,
            title: `Restore: ${checkpoints[0].label}`
          }, '⏪ Restore'),
          h('button', {
            className: `btn btn-sm ${showLiveTerminalDrawer ? 'btn-primary' : 'btn-secondary'}`,
            onClick: () => setShowLiveTerminalDrawer(!showLiveTerminalDrawer),
            title: 'Toggle Split-View Live MCP & A2A Terminal Stream'
          }, '🖥️ MCP Terminal'),
          h('button', {
            className: `btn btn-sm ${showLiveProductDrawer ? 'btn-primary' : 'btn-secondary'}`,
            style: { borderColor: '#38bdf8', color: showLiveProductDrawer ? '#fff' : '#38bdf8' },
            onClick: () => setShowLiveProductDrawer(!showLiveProductDrawer),
            title: 'Toggle Split-Screen Live Product Runtime (/live-product)'
          }, '🌐 Live Product Split'),
          h('button', {
            className: `btn btn-sm ${showBoardAndTools ? 'btn-primary' : 'btn-secondary'}`,
            onClick: () => setShowBoardAndTools(!showBoardAndTools)
          }, `🏛️ HUD Drawer (${pendingProposals.length})`),
          h('button', {
            className: `btn btn-sm ${soundFxEnabled ? 'btn-primary' : 'btn-secondary'}`,
            onClick: () => {
              soundFxEnabled = !soundFxEnabled;
              if (soundFxEnabled) playOfficeSound('revenue');
            }
          }, soundFxEnabled ? '🔊 SFX' : '🔇 SFX')
        )
      ),

      // Cinema Camera Quick Navigator Bar
      h('div', {
        className: 'office-camera-bar',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.75)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }
      },
        h('span', { style: { fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 } }, '🎥 Cinema View:'),
        h('button', {
          className: `theme-chip ${!focusRoomId ? 'active' : ''}`,
          onClick: () => setFocusRoomId(null)
        }, '🌐 Full Office'),
        OFFICE_ROOMS.map((r) =>
          h('button', {
            key: r.id,
            className: `theme-chip ${focusRoomId === r.id ? 'active' : ''}`,
            style: {
              borderColor: r.color,
              color: focusRoomId === r.id ? '#fff' : r.color,
              background: focusRoomId === r.id ? r.color : 'transparent'
            },
            onClick: () => setFocusRoomId(focusRoomId === r.id ? null : r.id)
          }, `${r.title.slice(0, 18)}`)
        )
      ),

      // Interactive SVG Virtual Office Floorplan
      h('div', { className: 'office-canvas-wrap' },
        h('svg', {
          ref: svgRef,
          viewBox: `${Math.round(camRef.current.x)} ${Math.round(camRef.current.y)} ${Math.round(camRef.current.w)} ${Math.round(camRef.current.h)}`,
          width: '100%',
          height: '100%',
          className: 'office-svg-stage',
          onMouseMove: handleSvgMouseMove,
          onMouseUp: handleSvgMouseUp,
          onMouseLeave: handleSvgMouseUp
        },
          h('defs', null,
            h('pattern', { id: 'cyberGrid', width: '28', height: '28', patternUnits: 'userSpaceOnUse' },
              h('path', { d: 'M 28 0 L 0 0 0 28', fill: 'none', stroke: 'rgba(148, 163, 184, 0.08)', strokeWidth: '1' })
            ),
            h('filter', { id: 'neonGlow', x: '-20%', y: '-20%', width: '140%', height: '140%' },
              h('feGaussianBlur', { stdDeviation: '3.5', result: 'blur' }),
              h('feMerge', null,
                h('feMergeNode', { in: 'blur' }),
                h('feMergeNode', { in: 'SourceGraphic' })
              )
            )
          ),

          // Floor Grid Background
          h('rect', { x: 0, y: 0, width: 1080, height: 580, fill: 'url(#cyberGrid)' }),

          // Ambient Floating Cyber Motes / Energy Dust
          h('g', { className: 'ambient-motes-layer', opacity: 0.8 },
            ambientMotes.map((m, mIdx) =>
              h('circle', {
                key: `mote-${mIdx}`,
                cx: m.x,
                cy: m.y + Math.sin(m.phase) * 6,
                r: m.r,
                fill: m.color,
                opacity: m.alpha * (0.6 + Math.sin(m.phase) * 0.4)
              })
            )
          ),

          // Hallway / Neural Bus Conduit Lines connecting all rooms to Central Commons (Streaming Animated Energy)
          h('g', { opacity: 0.65 },
            h('line', { x1: 540, y1: 161, x2: 540, y2: 178, stroke: '#6366f1', strokeWidth: 4, strokeDasharray: '6 4', strokeDashoffset: -tick * 2.2 }),
            h('line', { x1: 378, y1: 290, x2: 396, y2: 290, stroke: '#10b981', strokeWidth: 4, strokeDasharray: '6 4', strokeDashoffset: -tick * 2.2 }),
            h('line', { x1: 684, y1: 290, x2: 702, y2: 290, stroke: '#ec4899', strokeWidth: 4, strokeDasharray: '6 4', strokeDashoffset: -tick * 2.2 }),
            h('line', { x1: 540, y1: 388, x2: 540, y2: 444, stroke: '#eab308', strokeWidth: 4, strokeDasharray: '6 4', strokeDashoffset: -tick * 2.2 })
          ),

          // Floor Footstep & Sparkle Particles Layer
          h('g', { className: 'particles-layer' },
            officeParticles.map((pt) =>
              h('circle', {
                key: pt.id,
                cx: pt.x,
                cy: pt.y,
                r: Math.max(0.5, pt.r * pt.life),
                fill: pt.color,
                opacity: pt.life * 0.95
              })
            )
          ),

          // Arrival Shockwave Ripples
          h('g', { className: 'ripples-layer' },
            officeRipples.map((rp) =>
              h('circle', {
                key: rp.id,
                cx: rp.x,
                cy: rp.y,
                r: rp.r,
                fill: 'none',
                stroke: rp.color,
                strokeWidth: Math.max(0.5, 2.5 * rp.life),
                opacity: rp.life * 0.85
              })
            )
          ),

          // Render Office Rooms & Furniture / Desks
          OFFICE_ROOMS.map((room) =>
            h('g', {
              key: room.id,
              style: { cursor: 'pointer' },
              onClick: () => setFocusRoomId(focusRoomId === room.id ? null : room.id)
            },
              // Room Outer Floor & Glowing Border
              h('rect', {
                x: room.x,
                y: room.y,
                width: room.w,
                height: room.h,
                rx: 14,
                fill: dragHoverRoomId === room.id ? 'rgba(56, 189, 248, 0.22)' : room.bgTint,
                stroke: dragHoverRoomId === room.id ? '#38bdf8' : room.color,
                strokeWidth: dragHoverRoomId === room.id ? 3.2 : 1.6,
                strokeOpacity: dragHoverRoomId === room.id ? 1 : 0.65
              }),
              // Futuristic Corner HUD Brackets
              h('path', {
                d: `M ${room.x} ${room.y + 18} L ${room.x} ${room.y} L ${room.x + 18} ${room.y}`,
                fill: 'none',
                stroke: room.color,
                strokeWidth: 3
              }),
              h('path', {
                d: `M ${room.x + room.w - 18} ${room.y} L ${room.x + room.w} ${room.y} L ${room.x + room.w} ${room.y + 18}`,
                fill: 'none',
                stroke: room.color,
                strokeWidth: 3
              }),
              // Room Header Banner
              h('text', {
                x: room.x + 14,
                y: room.y + 21,
                fill: room.color,
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.06em'
              }, room.title),
              h('text', {
                x: room.x + 14,
                y: room.y + 35,
                fill: 'rgba(226, 232, 240, 0.55)',
                fontSize: '9.5px'
              }, room.subtitle),

              // Desks / Workstations inside the room
              room.desks.map((d, dIdx) =>
                h('g', { key: `${room.id}-desk-${dIdx}`, transform: `translate(${d.x}, ${d.y})` },
                  // Desk Surface
                  h('rect', {
                    x: -36,
                    y: -22,
                    width: 72,
                    height: 30,
                    rx: 6,
                    fill: 'rgba(15, 23, 42, 0.85)',
                    stroke: room.color,
                    strokeWidth: 1,
                    strokeOpacity: 0.5
                  }),
                  // Glowing Dual Monitors on Desk
                  h('rect', {
                    x: -22,
                    y: -18,
                    width: 19,
                    height: 6,
                    rx: 2,
                    fill: room.color,
                    opacity: 0.75
                  }),
                  h('rect', {
                    x: 3,
                    y: -18,
                    width: 19,
                    height: 6,
                    rx: 2,
                    fill: '#38bdf8',
                    opacity: 0.75
                  }),
                  // Desk Chair
                  h('circle', {
                    cx: 0,
                    cy: 16,
                    r: 9,
                    fill: 'rgba(30, 41, 59, 0.9)',
                    stroke: 'rgba(148, 163, 184, 0.35)',
                    strokeWidth: 1
                  }),
                  // Desk Label
                  h('text', {
                    x: 0,
                    y: 35,
                    textAnchor: 'middle',
                    fill: 'rgba(148, 163, 184, 0.55)',
                    fontSize: '8.5px'
                  }, d.label)
                )
              )
            )
          ),

          // Holographic War Room Projection Ring when C-Suite Standup is Active
          warRoomNow && h('g', { transform: 'translate(540, 290)' },
            // Outer counter-rotating dashed ring
            h('circle', {
              cx: 0,
              cy: 0,
              r: 88,
              fill: 'none',
              stroke: '#c084fc',
              strokeWidth: 1.4,
              strokeDasharray: '12 8',
              strokeDashoffset: tick * 2.2,
              opacity: 0.7
            }),
            // Middle pulsing holo disc
            h('ellipse', {
              cx: 0,
              cy: 0,
              rx: 82 + Math.sin(tick * 0.08) * 6,
              ry: 50 + Math.cos(tick * 0.08) * 4,
              fill: 'rgba(168, 85, 247, 0.16)',
              stroke: '#a855f7',
              strokeWidth: 2,
              strokeDasharray: '6 4',
              strokeDashoffset: -tick * 1.5
            }),
            // Scanning sweep crosshair line
            h('line', {
              x1: Math.cos(tick * 0.05) * -75,
              y1: Math.sin(tick * 0.05) * -45,
              x2: Math.cos(tick * 0.05) * 75,
              y2: Math.sin(tick * 0.05) * 45,
              stroke: 'rgba(216, 180, 254, 0.45)',
              strokeWidth: 1.2
            }),
            h('text', {
              x: 0,
              y: -36,
              textAnchor: 'middle',
              fill: '#e9d5ff',
              fontSize: '10px',
              fontWeight: '800'
            }, '🎙️ EXECUTIVE WAR ROOM HOLO-SYNC')
          ),

          // Render Fired Agents in the Exit Airlock Room
          firedAgents.slice(0, 3).map((fa, fIdx) =>
            h('g', {
              key: fa.id || `fired-${fIdx}`,
              transform: `translate(${765 + fIdx * 95}, 505)`,
              opacity: 0.65
            },
              h('circle', { cx: 0, cy: 0, r: 14, fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeDasharray: '3 3' }),
              h('text', { x: 0, y: 4, textAnchor: 'middle', fontSize: '12px' }, '👻'),
              h('text', { x: 0, y: 24, textAnchor: 'middle', fill: '#fca5a5', fontSize: '9px', fontWeight: '700' }, `✕ ${fa.name.slice(0, 12)}`)
            )
          ),

          // Render Live Courier Handoff Beams & Moving Data Orbs between Agents!
          courierPackets.map((pkt) => {
            const curX = pkt.x1 + (pkt.x2 - pkt.x1) * pkt.progress;
            const curY = pkt.y1 + (pkt.y2 - pkt.y1) * pkt.progress - Math.sin(pkt.progress * Math.PI) * 32;
            return h('g', { key: pkt.id },
              h('line', {
                x1: pkt.x1,
                y1: pkt.y1,
                x2: pkt.x2,
                y2: pkt.y2,
                stroke: pkt.color,
                strokeWidth: 1.8,
                strokeDasharray: '5 5',
                opacity: 0.55
              }),
              h('circle', {
                cx: curX,
                cy: curY,
                r: 7,
                fill: pkt.color,
                filter: 'url(#neonGlow)'
              }),
              h('text', {
                x: curX,
                y: curY - 11,
                textAnchor: 'middle',
                fill: '#ffffff',
                fontSize: '9px',
                fontWeight: '700'
              }, pkt.label)
            );
          }),

          // Render Every Active Employee ("People in the Office")
          agents.map((agent) => {
            const pos = animAgents.get(agent.id) || { x: 540, y: 90, walkPhase: 0, droneAngle: 0, isWalking: false };
            const isWorking = agent.status === 'working';
            const isTraining = agent.status === 'training';
            const bobY = pos.isWalking
              ? Math.abs(Math.sin(pos.walkPhase)) * -6
              : isWorking
                ? Math.sin(pos.walkPhase * 2) * 2.2
                : Math.sin(pos.walkPhase * 0.7) * 1.2;

            const deptColors = {
              Executive: '#6366f1',
              HR: '#f59e0b',
              Finance: '#eab308',
              Engineering: '#10b981',
              Marketing: '#ec4899',
              QA: '#38bdf8'
            };
            const suitColor = deptColors[agent.department] || '#6366f1';
            const kpiColor = agent.kpi >= 80 ? '#10b981' : agent.kpi >= 65 ? '#f59e0b' : '#ef4444';
            const subs = agent.subAgents || [];
            const bubbleText = speechMap[agent.id] || (isWorking ? agent.currentAction : null);

            const facing = pos.facing || 1;
            const tilt = pos.tiltAngle || 0;

            return h('g', {
              key: agent.id,
              transform: `translate(${pos.x}, ${pos.y + bobY}) rotate(${tilt})`,
              style: { cursor: draggingAgentId === agent.id ? 'grabbing' : 'grab' },
              onMouseEnter: () => setHoveredAgentId(agent.id),
              onMouseLeave: () => setHoveredAgentId(null),
              onMouseDown: (e) => {
                e.stopPropagation();
                dragMovedRef.current = false;
                setDraggingAgentId(agent.id);
              },
              onClick: () => {
                if (!dragMovedRef.current && window.openAgentInspector) {
                  window.openAgentInspector(agent.id);
                }
              }
            },
              // Pulsing Floor Aura when Working or Training
              (isWorking || isTraining) && h('ellipse', {
                cx: 0,
                cy: 16,
                rx: 24 + Math.sin(pos.walkPhase * 2) * 4,
                ry: 10,
                fill: 'none',
                stroke: isTraining ? '#f59e0b' : '#10b981',
                strokeWidth: 2,
                opacity: 0.75
              }),

              // Character Shadow on Office Floor
              h('ellipse', {
                cx: 0,
                cy: 17,
                rx: 14 + (pos.isWalking ? Math.sin(pos.walkPhase) * 2 : 0),
                ry: 5,
                fill: 'rgba(0, 0, 0, 0.45)'
              }),

              // Stepping Feet / Animated Shoes
              h('g', null,
                h('ellipse', {
                  cx: -5 + (pos.isWalking ? Math.sin(pos.walkPhase) * 5 : 0),
                  cy: 16 - (pos.isWalking ? Math.max(0, Math.sin(pos.walkPhase) * 3) : 0),
                  rx: 3.2,
                  ry: 2.2,
                  fill: suitColor,
                  stroke: '#ffffff',
                  strokeWidth: 0.8
                }),
                h('ellipse', {
                  cx: 5 - (pos.isWalking ? Math.sin(pos.walkPhase) * 5 : 0),
                  cy: 16 - (pos.isWalking ? Math.max(0, -Math.sin(pos.walkPhase) * 3) : 0),
                  rx: 3.2,
                  ry: 2.2,
                  fill: suitColor,
                  stroke: '#ffffff',
                  strokeWidth: 0.8
                })
              ),

              // Direction-Aware Torso & Head
              h('g', { transform: `scale(${facing}, 1)` },
                // Character Body / Futuristic Suit Torso
                h('path', {
                  d: 'M -12 14 C -12 2, 12 2, 12 14 Z',
                  fill: suitColor,
                  stroke: '#ffffff',
                  strokeWidth: 1.2
                }),

                // Character Typing Hands (Animated when working at desk!)
                isWorking && h('g', null,
                  h('circle', {
                    cx: -8,
                    cy: 5 + Math.sin(pos.walkPhase * 5) * 2.5,
                    r: 3,
                    fill: '#fde68a'
                  }),
                  h('circle', {
                    cx: 8,
                    cy: 5 + Math.cos(pos.walkPhase * 5) * 2.5,
                    r: 3,
                    fill: '#fde68a'
                  })
                ),

                // Character Head / Avatar Badge
                h('circle', {
                  cx: 0,
                  cy: -4,
                  r: 12,
                  fill: '#0f172a',
                  stroke: isWorking ? '#10b981' : isTraining ? '#f59e0b' : suitColor,
                  strokeWidth: 2.2
                }),
                h('text', {
                  x: 0,
                  y: 0,
                  textAnchor: 'middle',
                  fontSize: '12px'
                }, agent.avatar || '🤖'),

                // Blinking Cyber Visor Eye Glow
                h('circle', {
                  cx: -3,
                  cy: -3,
                  r: Math.sin(tick * 0.08 + (pos.phaseOffset || 0)) > 0.94 ? 0.4 : 1.3,
                  fill: isWorking ? '#38bdf8' : '#a7f3d0'
                }),
                h('circle', {
                  cx: 3,
                  cy: -3,
                  r: Math.sin(tick * 0.08 + (pos.phaseOffset || 0)) > 0.94 ? 0.4 : 1.3,
                  fill: isWorking ? '#38bdf8' : '#a7f3d0'
                })
              ),

              // Status Dot on Character Shoulder
              h('circle', {
                cx: 10 * facing,
                cy: -11,
                r: 4,
                fill: isWorking ? '#10b981' : isTraining ? '#f59e0b' : '#94a3b8',
                stroke: '#0f172a',
                strokeWidth: 1.2
              }),

              // Orbiting Hermes Sub-Agent Mini-Drones around Parent Employee!
              subs.slice(-3).map((sub, sIdx) => {
                const angle = pos.droneAngle + (sIdx * (Math.PI * 2)) / Math.max(1, subs.length);
                const dx = Math.cos(angle) * 28;
                const dy = Math.sin(angle) * 14 - 8;
                return h('g', { key: sub.id, transform: `translate(${dx}, ${dy})` },
                  h('line', { x1: 0, y1: 0, x2: -dx * 0.6, y2: -dy * 0.6, stroke: '#38bdf8', strokeWidth: 0.8, strokeDasharray: '2 2' }),
                  h('circle', { cx: 0, cy: 0, r: 6, fill: '#0f172a', stroke: '#38bdf8', strokeWidth: 1.5 }),
                  h('text', { x: 0, y: 3, textAnchor: 'middle', fontSize: '7px' }, '🧬')
                );
              }),

              // Floating Nameplate & KPI Bar underneath Character
              h('g', { transform: 'translate(0, 26)' },
                h('rect', {
                  x: -48,
                  y: -9,
                  width: 96,
                  height: 18,
                  rx: 5,
                  fill: 'rgba(9, 13, 22, 0.88)',
                  stroke: 'rgba(148, 163, 184, 0.3)',
                  strokeWidth: 1
                }),
                h('text', {
                  x: 0,
                  y: 2,
                  textAnchor: 'middle',
                  fill: '#f8fafc',
                  fontSize: '8.5px',
                  fontWeight: '700'
                }, `${agent.name.slice(0, 14)} (${agent.kpi}%)`),
                // Mini KPI bar
                h('rect', { x: -42, y: 6, width: 84, height: 2, rx: 1, fill: '#1e293b' }),
                h('rect', { x: -42, y: 6, width: Math.max(8, (agent.kpi / 100) * 84), height: 2, rx: 1, fill: kpiColor }),
                // Active Tool Script Badge underneath nameplate
                (agent.activeTool || (agent.tools && agent.tools[0])) && h('text', {
                  x: 0,
                  y: 16,
                  textAnchor: 'middle',
                  fill: isWorking ? '#38bdf8' : 'rgba(148, 163, 184, 0.75)',
                  fontSize: '7.5px',
                  fontFamily: 'monospace',
                  fontWeight: '700'
                }, `⚙️ ${(agent.activeTool || agent.tools[0]).slice(0, 18)}`)
              ),

              // Floating Speech / Action Bubble above Employee's Head
              (showBubbles && (isWorking || isTraining || hoveredAgentId === agent.id) && bubbleText) && h('g', {
                transform: 'translate(0, -28)'
              },
                h('rect', {
                  x: -78,
                  y: -22,
                  width: 156,
                  height: 20,
                  rx: 6,
                  fill: 'rgba(15, 23, 42, 0.95)',
                  stroke: isWorking ? '#10b981' : suitColor,
                  strokeWidth: 1.2
                }),
                h('polygon', {
                  points: '-4,-2 4,-2 0,4',
                  fill: isWorking ? '#10b981' : suitColor
                }),
                h('text', {
                  x: 0,
                  y: -9,
                  textAnchor: 'middle',
                  fill: '#e2e8f0',
                  fontSize: '8px',
                  fontWeight: '600'
                }, `${bubbleText.slice(0, 28)}${bubbleText.length > 28 ? '...' : ''}`)
              )
            );
          })
        )
      ),

      // v12 + v13 Live Product Runtime, Synthetic Traffic Swarm & Browser-Use Visual DOM Agent Split-Screen Drawer
      showLiveProductDrawer && h('div', { className: 'split-product-drawer' },
        h('div', { className: 'split-product-bar' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            h('span', { style: { color: '#38bdf8', fontWeight: 800, fontSize: '0.8rem' } }, '🌐 LIVE PRODUCT RUNTIME (/live-product)'),
            h('span', { className: 'tag', style: { color: '#10b981' } }, `💰 MRR: $${(state.company?.mrr || 0).toLocaleString()}/mo`),
            h('span', { className: 'tag', style: { color: '#f59e0b' } }, `👥 Customers: ${state.company?.customersCount || 0}`),
            h('span', { className: 'tag', style: { color: '#ec4899' } }, `🖥️ Browser-Use DOM Agent: ${showDomAgentOverlay ? 'SCANNING [1-5]' : 'STANDBY'}`)
          ),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            h('button', {
              className: `btn btn-sm ${showDomAgentOverlay ? 'btn-primary' : 'btn-outline'}`,
              onClick: () => setShowDomAgentOverlay((v) => !v)
            }, showDomAgentOverlay ? '🎯 Hide DOM Boxes' : '🎯 Show DOM Boxes'),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              onClick: async () => {
                const res = await fetch('/api/product/browser-agent-audit', { method: 'POST' });
                const d = await res.json();
                if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
                if (window.triggerCelebrationBurst) window.triggerCelebrationBurst(window.innerWidth * 0.65, window.innerHeight * 0.55, 50);
                if (window.showToast) window.showToast('🖥️ Browser-Use Visual CRO Patch', d.result?.summary || 'DOM patched!');
              }
            }, '⚡ Visual CRO Auto-Patch (+MRR)'),
            h('button', {
              className: 'btn btn-sm btn-success',
              onClick: async () => {
                const res = await fetch('/api/product/simulate-traffic', { method: 'POST' });
                const d = await res.json();
                if (d.state && window.syncFromExternalState) window.syncFromExternalState(d.state);
                if (window.triggerCelebrationBurst && (d.traffic?.newCustomers > 0 || d.traffic?.ok)) {
                  window.triggerCelebrationBurst(window.innerWidth * 0.75, window.innerHeight * 0.55, 45);
                }
                if (window.showToast) window.showToast('📈 Customer Traffic Swarm', d.traffic?.summary);
              }
            }, '📈 Traffic Swarm (+250)'),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              onClick: () => {
                const iframe = document.getElementById('liveProductEmbedIframe');
                if (iframe) iframe.src = '/live-product?t=' + Date.now();
              }
            }, '🔄 Reload'),
            h('a', {
              className: 'btn btn-sm btn-outline',
              href: '/live-product',
              target: '_blank',
              rel: 'noopener'
            }, '↗ New Tab')
          )
        ),
        h('div', { style: { position: 'relative', width: '100%', height: '300px' } },
          h('iframe', {
            id: 'liveProductEmbedIframe',
            className: 'split-product-iframe',
            src: '/live-product',
            title: 'Live Product Runtime'
          }),
          showDomAgentOverlay && (() => {
            const domBoxes = [
              { ref: 1, tag: 'nav.navbar', label: 'Top Trust Nav', left: '6%', top: '5%', width: '88%', height: '14%', color: '#38bdf8' },
              { ref: 2, tag: 'h1.hero-title', label: 'Hero Value Prop', left: '12%', top: '23%', width: '76%', height: '22%', color: '#a855f7' },
              { ref: 3, tag: 'button#cta-stripe', label: 'Primary Checkout CTA (CVR 5.8%)', left: '26%', top: '49%', width: '48%', height: '15%', color: '#10b981' },
              { ref: 4, tag: 'section.pricing-tiers', label: '3-Tier Pricing Anchor', left: '8%', top: '68%', width: '84%', height: '18%', color: '#f59e0b' },
              { ref: 5, tag: 'footer.soc2-proof', label: 'SOC2 & Telemetry Badge', left: '18%', top: '88%', width: '64%', height: '9%', color: '#ec4899' }
            ];
            const activeBox = domBoxes[domCursorStep % domBoxes.length];
            return h('div', {
              style: {
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                background: 'rgba(6, 10, 20, 0.14)'
              }
            },
              domBoxes.map((b, i) => {
                const isTarget = i === (domCursorStep % domBoxes.length);
                return h('div', {
                  key: b.ref,
                  style: {
                    position: 'absolute',
                    left: b.left,
                    top: b.top,
                    width: b.width,
                    height: b.height,
                    border: `2px ${isTarget ? 'solid' : 'dashed'} ${b.color}`,
                    background: isTarget ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                    borderRadius: '6px',
                    transition: 'all 0.35s ease',
                    boxShadow: isTarget ? `0 0 16px ${b.color}` : 'none'
                  }
                },
                  h('span', {
                    style: {
                      position: 'absolute',
                      top: '-10px',
                      left: '6px',
                      background: b.color,
                      color: '#020617',
                      fontWeight: 800,
                      fontSize: '0.64rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontFamily: "'JetBrains Mono', monospace"
                    }
                  }, `[${b.ref}] <${b.tag}> ${b.label}`)
                );
              }),
              // Animated Autonomous Browser-Use Agent Cursor
              h('div', {
                style: {
                  position: 'absolute',
                  left: activeBox.left,
                  top: activeBox.top,
                  transform: 'translate(24px, 12px)',
                  transition: 'all 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 20
                }
              },
                h('div', {
                  style: {
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'rgba(236, 72, 153, 0.9)',
                    border: '2px solid #fff',
                    boxShadow: '0 0 14px #ec4899'
                  }
                }),
                h('span', {
                  style: {
                    background: 'rgba(2, 6, 23, 0.92)',
                    border: '1px solid #ec4899',
                    color: '#f9a8d4',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontFamily: "'JetBrains Mono', monospace"
                  }
                }, `🤖 Browser-Use Agent auditing [${activeBox.ref}] ${activeBox.tag}`)
              )
            );
          })()
        )
      ),

      // v10 + v13 Collapsible Split-Screen Live MCP 2026-07-28 ("MCP Apps" + MRTR) & Self-Healing Terminal Drawer
      showLiveTerminalDrawer && h('div', {
        style: {
          background: '#060911',
          borderTop: '1px solid rgba(56, 189, 248, 0.35)',
          padding: '10px 14px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.73rem'
        }
      },
        h('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            flexWrap: 'wrap',
            gap: '8px'
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            h('span', { style: { color: '#10b981', fontWeight: 800 } }, '● LIVE MCP 2026-07-28 & A2A STREAM'),
            h('span', { className: 'tag', style: { fontSize: '0.65rem', color: '#38bdf8' } }, 'Stateless JSON-RPC + MCP Apps'),
            h('span', { className: 'tag', style: { fontSize: '0.65rem', color: '#f472b6' } }, 'MRTR: input_required Ready'),
            h('span', { className: 'tag', style: { fontSize: '0.65rem', color: '#10b981' } }, `⚡ Saved: ${state.company?.tokensSaved || 0} tok`)
          ),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            h('button', {
              className: 'btn btn-sm btn-secondary',
              style: { fontSize: '0.68rem', padding: '3px 8px' },
              onClick: triggerSelfHealingDebugger
            }, '🩹 Self-Healing AST Debugger'),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              style: { fontSize: '0.68rem', padding: '3px 8px' },
              onClick: () => window.openGitHubSyncModal && window.openGitHubSyncModal()
            }, '🐙 OpenHands GitHub Push'),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              style: { fontSize: '0.68rem', padding: '3px 8px' },
              onClick: () => window.openModal && window.openModal('customToolModal')
            }, '🔌 + Custom MCP Tool')
          )
        ),
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 0.9fr',
            gap: '10px',
            maxHeight: '145px',
            overflowY: 'auto'
          }
        },
          // Left Pane: Live ANSI MCP Tool Execution stdout/stderr stream
          h('div', {
            style: {
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              padding: '8px 10px',
              overflowY: 'auto'
            }
          },
            (state.toolExecutions || []).slice(0, 6).map((tl, idx) =>
              h('div', {
                key: tl.id || idx,
                style: { marginBottom: '5px', lineHeight: 1.4, borderBottom: '1px dashed rgba(148,163,184,0.12)', paddingBottom: '4px' }
              },
                h('span', { style: { color: '#64748b' } }, `[${(tl.timestamp || '').slice(11, 19)}] `),
                h('span', { style: { color: '#38bdf8', fontWeight: 700 } }, `mcp://tools/call/${tl.tool} `),
                h('span', { style: { color: '#a855f7' } }, `(${tl.agentName}) `),
                h('div', { style: { color: tl.status === 'SUCCESS' ? '#10b981' : '#f59e0b', paddingLeft: '12px' } },
                  `↳ [${tl.status}] ${tl.output}`
                )
              )
            )
          ),
          // Middle Pane: Interactive MCP App Widget (MCP 2026-07-28 Spec)
          h('div', {
            style: {
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(244, 114, 182, 0.38)',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }
          },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              h('span', { style: { color: '#f472b6', fontWeight: 800, fontSize: '0.69rem' } }, '🧩 MCP APP: FINOPS + MRTR WIDGET'),
              h('span', { className: 'tag', style: { fontSize: '0.6rem', color: '#38bdf8' } }, 'mcp.apps/render')
            ),
            h('div', { style: { margin: '4px 0' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', color: '#cbd5e1' } },
                h('span', null, `SaaS Seat ARPU: $${mcpPricingArpu}/mo`),
                h('span', { style: { color: '#10b981', fontWeight: 700 } }, `Proj. ARR: $${(((state.company?.customersCount || 12) * mcpPricingArpu * 12)).toLocaleString()}/yr`)
              ),
              h('input', {
                type: 'range',
                min: 49,
                max: 299,
                value: mcpPricingArpu,
                onChange: (e) => setMcpPricingArpu(Number(e.target.value)),
                style: { width: '100%', accentColor: '#f472b6', cursor: 'pointer', marginTop: '3px' }
              })
            ),
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' } },
              h('span', { style: { fontSize: '0.64rem', color: '#fbbf24' } }, 'MRTR CTA Gate:'),
              h('button', {
                className: `btn btn-sm ${mcpSelectedCta === 'v1' ? 'btn-primary' : 'btn-outline'}`,
                style: { fontSize: '0.62rem', padding: '1px 6px' },
                onClick: () => {
                  setMcpSelectedCta('v1');
                  if (window.showToast) window.showToast('🧩 MCP App MRTR Resolved', 'Locked Variant A ("14-Day Free Trial") via MCP 2026-07-28 input_required callback.');
                }
              }, 'Var A (4.6%)'),
              h('button', {
                className: `btn btn-sm ${mcpSelectedCta === 'v2' ? 'btn-success' : 'btn-outline'}`,
                style: { fontSize: '0.62rem', padding: '1px 6px' },
                onClick: () => {
                  setMcpSelectedCta('v2');
                  if (window.showToast) window.showToast('🧩 MCP App MRTR Resolved', 'Locked Variant B ("Deploy AI Team in 60s" - 6.4% CVR) via MCP 2026-07-28 callback!');
                }
              }, 'Var B (6.4% ★)')
            )
          ),
          // Right Pane: Latest Generated Workspace Artifacts & A2A Handoff Status
          h('div', {
            style: {
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(168, 85, 247, 0.28)',
              borderRadius: '8px',
              padding: '8px 10px',
              overflowY: 'auto'
            }
          },
            h('div', { style: { color: '#a855f7', fontWeight: 700, marginBottom: '4px', fontSize: '0.7rem' } },
              `📦 /WORKSPACE ARTIFACTS (${(state.workspaceFiles || []).length} Files)`
            ),
            (state.workspaceFiles || []).slice(0, 5).map((wf, idx) =>
              h('div', {
                key: wf.filename || idx,
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '3px 0',
                  borderBottom: '1px dashed rgba(148,163,184,0.12)',
                  cursor: 'pointer'
                },
                onClick: () => window.switchTab && window.switchTab('workspace')
              },
                h('span', { style: { color: '#e2e8f0', fontWeight: 600 } }, `📄 ${wf.filename}`),
                h('span', { style: { color: '#10b981', fontSize: '0.66rem' } }, `${wf.author || wf.department}`)
              )
            )
          )
        )
      ),

      // Phase 7, 8 & 17: Board Inbox + Competitor Arena + Real Tool Execution Telemetry Drawer
      showBoardAndTools && h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
          padding: '10px 14px',
          background: 'rgba(9, 13, 22, 0.85)',
          borderTop: '1px solid var(--border-color)'
        }
      },
        // Column 1: Board of Directors Governance Inbox
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { style: { fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)' } },
              `🏛️ BOARD INBOX (${pendingProposals.length} Pending)`
            ),
            h('span', { className: 'sub-hint' }, 'Governance Gate')
          ),
          (state.boardInbox || []).slice(0, 3).map((prop) =>
            h('div', {
              key: prop.id,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: `1px solid ${prop.status === 'pending' ? 'rgba(245, 158, 11, 0.45)' : 'var(--border-color)'}`
              }
            },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-primary)' } },
                  `${prop.status === 'approved' ? '✅ ' : prop.status === 'vetoed' ? '❌ ' : '🔔 '}${prop.title}`
                ),
                h('div', { style: { fontSize: '0.66rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                  `${prop.proposedBy || prop.requestedBy || 'Executive'}: ${prop.detail || prop.description || ''}`
                )
              ),
              prop.status === 'pending'
                ? h('div', { style: { display: 'flex', gap: '4px' } },
                    h('button', {
                      className: 'btn btn-sm btn-success',
                      onClick: () => resolveProposal(prop.id, 'approve')
                    }, '✅'),
                    h('button', {
                      className: 'btn btn-sm btn-danger',
                      onClick: () => resolveProposal(prop.id, 'veto')
                    }, '❌')
                  )
                : h('span', { className: 'tag', style: { fontSize: '0.63rem' } }, prop.status.toUpperCase())
            )
          )
        ),

        // Column 2: Competitor Market Arena & Rival Talent Headhunting
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { style: { fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b' } },
              `🏆 COMPETITOR ARENA (Our Share: ${marketShare}%)`
            ),
            h('span', { className: 'sub-hint' }, 'Poach Rival Stars')
          ),
          competitors.map((comp) =>
            h('div', {
              key: comp.id,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(245, 158, 11, 0.28)'
              }
            },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' } },
                  `${comp.name} • ${comp.marketSharePct}% Share ($${(comp.valuationUsd / 1000).toFixed(0)}k)`
                ),
                h('div', { style: { fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                  `Star: ${comp.topStar?.name} (${comp.topStar?.department}, KPI ${comp.topStar?.kpi}%)`
                )
              ),
              comp.poached
                ? h('span', { className: 'tag', style: { fontSize: '0.63rem', color: '#10b981' } }, 'POACHED ✓')
                : h('button', {
                    className: 'btn btn-sm btn-primary',
                    onClick: () => poachRivalStar(comp.id)
                  }, '🎯 Poach')
            )
          )
        ),

        // Column 3: Real Tool Execution Engine Telemetry (`workspace_coder`, `unit_test_runner`, `node --check`)
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { style: { fontSize: '0.76rem', fontWeight: 800, color: '#10b981' } },
              `🛠️ REAL TOOL EXECUTION LOG (${state.company?.toolCallsCount || toolLogs.length} Runs)`
            ),
            h('span', { className: 'sub-hint' }, 'workspace/ .js, .html, .json + node --check')
          ),
          toolLogs.length === 0
            ? h('div', { className: 'sub-hint', style: { padding: '8px' } }, 'Run a pipeline step ("⏭ Next Step" or "▶ Start Auto-Pilot") to watch agents execute real tools & verify JS syntax!')
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '95px', overflowY: 'auto' } },
                toolLogs.map((tl) =>
                  h('div', {
                    key: tl.id,
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)'
                    }
                  },
                    h('span', { style: { color: '#38bdf8', fontWeight: 700 } }, `[${tl.tool}] ${tl.agentName}`),
                    h('span', { style: { color: 'var(--text-secondary)', margin: '0 6px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tl.output),
                    h('span', { style: { color: tl.status === 'SUCCESS' ? '#10b981' : '#f59e0b', fontWeight: 700 } }, tl.status)
                  )
                )
              )
        )
      )
    );
  }

  window.VirtualOfficeComponent = VirtualOfficeComponent;
})();
