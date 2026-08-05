import "@testing-library/jest-dom/vitest";

// Node 26 exposes an unavailable experimental localStorage that can shadow
// jsdom's implementation. Keep browser-facing tests on a real Storage shape.
const browserLocalStorage: unknown = Reflect.get(window, "localStorage");

if (browserLocalStorage === undefined) {
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });
}

// jsdom has no IntersectionObserver; React Router viewport prefetch needs one.
if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    disconnect() {
      return undefined;
    }

    observe() {
      return undefined;
    }

    takeRecords() {
      return [];
    }

    unobserve() {
      return undefined;
    }
  } as unknown as typeof IntersectionObserver;
}

// jsdom has no ResizeObserver; Radix primitives (Switch) require one.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {
      return undefined;
    }

    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }
  };
}

// Node 22+ has an uninitialized experimental globalThis.localStorage that breaks jsdom window.localStorage unless mocked
try {
  if (typeof window !== "undefined" && (!window.localStorage || typeof window.localStorage.setItem !== "function")) {
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  }
} catch {
  // ignore if window is undefined
}
