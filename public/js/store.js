/**
 * AI Company OS — Reactive State Store (Zustand Pattern + React 18 Hook)
 * Centralizes state, catalogs, active tab routing, SSE telemetry, and selector subscriptions.
 */
(function () {
  const listeners = new Set();

  let storeState = {
    companyState: null,
    providersCatalog: {},
    companyTemplates: [],
    githubIntegrations: [],
    mcpServersCatalog: [],
    toolRegistry: [],
    a2aCardsCatalog: [],
    activeTabId: 'org',
    orgViewMode: 'office',
    sseConnected: false,
    updatesCount: 0,
    lastUpdatedAt: null
  };

  function getState() {
    return storeState;
  }

  function setState(partial) {
    const nextPartial = typeof partial === 'function' ? partial(storeState) : partial;
    if (!nextPartial) return storeState;
    storeState = Object.assign({}, storeState, nextPartial, {
      updatesCount: storeState.updatesCount + 1,
      lastUpdatedAt: new Date().toISOString()
    });
    listeners.forEach((fn) => {
      try {
        fn(storeState);
      } catch (e) {
        console.error('CompanyStore listener error:', e);
      }
    });
    return storeState;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // React 18 Hook: window.CompanyStore.useStore((s) => s.companyState)
  function useStore(selector = (s) => s) {
    if (!window.React) return selector(storeState);
    const [slice, setSlice] = window.React.useState(() => selector(storeState));
    window.React.useEffect(() => {
      return subscribe((nextState) => {
        const nextSlice = selector(nextState);
        setSlice((prev) => (prev === nextSlice ? prev : nextSlice));
      });
    }, []);
    return slice;
  }

  async function dispatchApi(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (data && data.state) {
      setState({ companyState: data.state });
      if (window.syncFromExternalState) {
        window.syncFromExternalState(data.state);
      }
    }
    return data;
  }

  window.CompanyStore = {
    getState,
    setState,
    subscribe,
    useStore,
    dispatchApi
  };

  /**
   * Motion.dev S-Tier Web Animations API (WAAPI) GPU Compositor Engine
   * Drives hardware-accelerated transform & opacity animations on the compositor thread
   * (0% Main-Thread Layout/Paint cost, immune to main-thread JS work).
   */
  const MotionTierS = {
    springIn(el, opts = {}) {
      if (!el || typeof el.animate !== 'function') return null;
      return el.animate(
        [
          {
            opacity: 0,
            transform: 'translate3d(0, 14px, 0) scale3d(0.965, 0.965, 1)'
          },
          {
            opacity: 1,
            transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)'
          }
        ],
        {
          duration: opts.duration || 240,
          easing: opts.easing || 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both'
        }
      );
    },
    pulse(el, opts = {}) {
      if (!el || typeof el.animate !== 'function') return null;
      return el.animate(
        [
          { transform: 'scale3d(1, 1, 1)' },
          { transform: 'scale3d(1.035, 1.035, 1)' },
          { transform: 'scale3d(1, 1, 1)' }
        ],
        {
          duration: opts.duration || 260,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        }
      );
    }
  };

  window.MotionTierS = MotionTierS;

  // Automatically attach S-Tier WAAPI spring physics when modals or toasts appear
  if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            const target = m.target;
            if (
              target &&
              target.classList &&
              target.classList.contains('modal-backdrop') &&
              !target.classList.contains('hidden')
            ) {
              const card = target.querySelector('.modal-card, .modal-box, .modal-content');
              if (card) MotionTierS.springIn(card);
            }
          } else if (m.type === 'childList' && m.addedNodes.length > 0) {
            m.addedNodes.forEach((node) => {
              if (node.nodeType === 1 && node.classList && node.classList.contains('toast-item')) {
                MotionTierS.springIn(node, { duration: 210 });
              }
            });
          }
        }
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      });
    });
  }
})();
