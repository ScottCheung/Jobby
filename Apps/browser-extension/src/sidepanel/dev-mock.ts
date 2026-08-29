/** @format */

// Polyfill window.chrome when running in standalone browser dev mode (outside Chrome Extension context)
if (typeof window !== 'undefined' && (!window.chrome || !window.chrome.runtime?.id)) {
  const storageLocalData: Record<string, unknown> = {};
  const storageSessionData: Record<string, unknown> = {};

  const createStorageArea = (store: Record<string, unknown>) => ({
    get: async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (!keys) return { ...store };
      if (typeof keys === 'string') return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (store[k] !== undefined) result[k] = store[k];
        }
        return result;
      }
      return { ...keys, ...store };
    },
    set: async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    },
    remove: async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete store[k];
    },
    clear: async () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  });

  const dummyListeners = {
    addListener: () => {},
    removeListener: () => {},
    hasListener: () => false,
  };

  (window as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'mock-jobby-dev-id',
      getURL: (path: string) => path,
      getManifest: () => ({ version: '0.2.4-dev', content_scripts: [] }),
      sendMessage: async (msg: unknown) => {
        console.log('[Dev Mock] chrome.runtime.sendMessage called with:', msg);
        const m = msg as { type?: string; payload?: unknown };
        if (m?.type === 'auth.status') {
          return {
            state: 'authenticated',
            user: {
              id: 'dev-user-id',
              email: 'developer@jobby.ai',
              user_metadata: { full_name: 'Developer' },
            },
          };
        }
        if (m?.type === 'page.inspect') {
          return {
            kind: 'job',
            snapshot: {
              platform: 'seek',
              externalId: '10001',
              url: 'https://www.seek.com.au/software-engineer-jobs',
              title: 'Senior Full Stack Developer',
              company: 'Tech Innovators Pty Ltd',
              location: 'Brisbane QLD',
              datePosted: '1d ago',
              technologies: [
                'React',
                'TypeScript',
                'Tailwind CSS',
                'Node.js',
                'Python',
                'PostgreSQL',
                'AWS',
                'Docker',
              ],
              description:
                'We are seeking an experienced Senior Full Stack Developer to lead development of next-generation cloud solutions. You will work across modern React, TypeScript, Node.js and scalable cloud architectures.',
            },
          };
        }
        if (m?.type === 'tailored-resume.list') {
          return { ok: true, tailoredResumes: [] };
        }
        if (m?.type === 'diagnostics.get') {
          return { logs: [] };
        }
        return { ok: true, data: null };
      },
      onMessage: dummyListeners,
      connect: () => ({
        postMessage: () => {},
        onMessage: dummyListeners,
        onDisconnect: dummyListeners,
        disconnect: () => {},
      }),
    },
    storage: {
      local: createStorageArea(storageLocalData),
      session: createStorageArea(storageSessionData),
      onChanged: dummyListeners,
    },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.com/job/123', title: 'Example Job Post' }],
      sendMessage: async (_tabId: number, msg: unknown) => {
        console.log('[Dev Mock] chrome.tabs.sendMessage called with:', msg);
        return { ok: true };
      },
      onActivated: dummyListeners,
      onUpdated: dummyListeners,
    },
    windows: {
      getCurrent: async () => ({ id: 1 }),
    },
    scripting: {
      executeScript: async () => [{ result: null }],
    },
  };
}
