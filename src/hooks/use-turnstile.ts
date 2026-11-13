"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clientEnv } from "@/env-client";

/**
 * Cloudflare Turnstile (Sections 5.13, 9). When NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, Supabase
 * Auth requires a captcha token on sign-in, sign-up and anonymous sign-in. The widget renders
 * invisibly and only shows a challenge if Cloudflare needs one ("interaction-only"), and runs
 * when the form is submitted rather than on page load ("execute"), so pages that never sign
 * anyone in don't call Cloudflare.
 *
 * Without a site key, `getToken` resolves to undefined and nothing is loaded.
 */

type TurnstileOptions = {
  sitekey: string;
  execution: "render" | "execute";
  appearance: "always" | "execute" | "interaction-only";
  size?: "normal" | "flexible" | "compact";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
};

type TurnstileApi = {
  render: (el: HTMLElement, options: TurnstileOptions) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 30_000;
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile_missing")));
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("turnstile_load_failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export class CaptchaError extends Error {}

export function useTurnstile() {
  const siteKey = clientEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // A callback ref kept in state (not a ref object) so the container can be passed during render.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const pendingRef = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);

  useEffect(
    () => () => {
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    },
    [],
  );

  /** A fresh single-use token, or undefined when captcha is off. Throws CaptchaError on failure. */
  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!siteKey) return undefined;
    const el = container;
    if (!el) throw new CaptchaError("The security check didn't load. Refresh the page and try again.");

    let api: TurnstileApi;
    try {
      api = await loadTurnstile();
    } catch {
      throw new CaptchaError("The security check couldn't load. Check your connection, or turn off blockers for this site.");
    }

    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pendingRef.current = null;
        reject(new CaptchaError("The security check took too long. Try again."));
      }, TOKEN_TIMEOUT_MS);
      pendingRef.current = {
        resolve: (t) => {
          window.clearTimeout(timer);
          resolve(t);
        },
        reject: (e) => {
          window.clearTimeout(timer);
          reject(e);
        },
      };

      if (!widgetRef.current) {
        widgetRef.current = api.render(el, {
          sitekey: siteKey,
          execution: "execute",
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => {
            pendingRef.current?.resolve(token);
            pendingRef.current = null;
          },
          "error-callback": () => {
            pendingRef.current?.reject(new CaptchaError("The security check failed. Try again."));
            pendingRef.current = null;
          },
          "expired-callback": () => {
            if (widgetRef.current) api.reset(widgetRef.current);
          },
        });
      } else {
        // Tokens are single-use: reset before asking for another.
        api.reset(widgetRef.current);
      }
      api.execute(widgetRef.current);
    });
  }, [siteKey, container]);

  return { enabled: Boolean(siteKey), setContainer, getToken };
}
