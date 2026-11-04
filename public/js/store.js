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
})();
