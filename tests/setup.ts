import "@testing-library/jest-dom/vitest";

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
