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
