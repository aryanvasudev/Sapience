"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps prefetched pages honest. The signed-in pages load their data in `"use cache: private"`
 * scopes, so the browser holds each page, with its data, for a few minutes and navigation shows
 * it at once. Most changes go through API routes, which can't clear that browser cache, so this
 * notices them instead: after any successful same-origin write (API call, Server Action, tutor
 * message), the next press on an in-app link first runs `router.refresh()`, which invalidates
 * every cached page. That navigation then loads fresh data, and later ones are instant again.
 *
 * Invalidating on the way out, rather than after each write, matters during a lesson: progress
 * saves every few seconds, and refreshing on each would re-render the lesson repeatedly.
 */
export function ClientCacheFreshness() {
  const router = useRouter();

  useEffect(() => {
    let changed = false;
    const original = window.fetch;
    const tracked: typeof window.fetch = async (input, init) => {
      const response = await original(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (response.ok && method !== "GET" && method !== "HEAD" && isSameOrigin(input)) changed = true;
      return response;
    };
    window.fetch = tracked;

    const beforeNavigation = (event: PointerEvent | KeyboardEvent) => {
      if (!changed) return;
      if (event instanceof KeyboardEvent ? event.key !== "Enter" : event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.origin !== window.location.origin) return;
      changed = false;
      router.refresh();
    };
    document.addEventListener("pointerdown", beforeNavigation, true);
    document.addEventListener("keydown", beforeNavigation, true);

    return () => {
      if (window.fetch === tracked) window.fetch = original;
      document.removeEventListener("pointerdown", beforeNavigation, true);
      document.removeEventListener("keydown", beforeNavigation, true);
    };
  }, [router]);

  return null;
}

function isSameOrigin(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
