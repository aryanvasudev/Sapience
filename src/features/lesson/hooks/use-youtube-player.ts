"use client";

/**
 * Official YouTube IFrame Player (Section 5.2). Loads the API once, uses the privacy-enhanced
 * host, never autoplays, maps player errors to plain messages, and cleans up on unmount.
 * Nothing is ever drawn over the iframe.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      videoId: string;
      width?: string;
      height?: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type PlayerState = "loading" | "unstarted" | "playing" | "paused" | "buffering" | "ended" | "cued" | "error";

const STATE_NAMES: Record<number, PlayerState> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};

/** IFrame API error codes → what the student sees (Section 10). */
export const PLAYER_ERRORS: Record<number, string> = {
  2: "This video link is invalid. Check the address and try again.",
  5: "This video can't play in this browser. Try another browser or update this one.",
  100: "This video has been removed or made private.",
  101: "The video's owner doesn't allow it to play outside YouTube.",
  150: "The video's owner doesn't allow it to play outside YouTube.",
  153: "YouTube couldn't verify where this video is playing. Reload the page; if it keeps happening, open it on YouTube.",
};

let apiPromise: Promise<YTNamespace> | null = null;

function loadIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Couldn't load the YouTube player."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export type YouTubePlayerApi = {
  /** Attach to the element the iframe replaces. */
  mount: (element: HTMLDivElement | null) => void;
  state: PlayerState;
  error: string | null;
  ready: boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
};

export function useYouTubePlayer(videoId: string, startSeconds: number): YouTubePlayerApi {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const [state, setState] = useState<PlayerState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!element) return;
    let cancelled = false;
    // The API replaces the element it's given; give it a child so React keeps owning `element`.
    const target = document.createElement("div");
    element.appendChild(target);

    loadIframeApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(target, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, playsinline: 1, start: Math.max(0, Math.floor(startSeconds)) },
          events: {
            onReady: () => {
              if (cancelled) return;
              readyRef.current = true;
              setReady(true);
              setState("unstarted");
            },
            onStateChange: (event) => setState(STATE_NAMES[event.data] ?? "unstarted"),
            onError: (event) => {
              setState("error");
              setError(PLAYER_ERRORS[event.data] ?? "The video couldn't play. Reload the page to try again.");
            },
          },
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState("error");
        setError(e instanceof Error ? e.message : "Couldn't load the YouTube player.");
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        playerRef.current?.destroy();
      } catch {
        // The iframe may already be gone.
      }
      playerRef.current = null;
      element.replaceChildren();
    };
    // startSeconds is only the initial position; changing it must not rebuild the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, videoId]);

  const withPlayer = useCallback(<T,>(fn: (p: YTPlayer) => T, fallback: T): T => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return fallback;
    try {
      return fn(player);
    } catch {
      return fallback;
    }
  }, []);

  const getCurrentTime = useCallback(() => withPlayer((p) => p.getCurrentTime(), 0), [withPlayer]);
  const getDuration = useCallback(() => withPlayer((p) => p.getDuration(), 0), [withPlayer]);
  const seekTo = useCallback((s: number) => withPlayer((p) => p.seekTo(Math.max(0, s), true), undefined), [withPlayer]);
  const play = useCallback(() => withPlayer((p) => p.playVideo(), undefined), [withPlayer]);
  const pause = useCallback(() => withPlayer((p) => p.pauseVideo(), undefined), [withPlayer]);
  const togglePlay = useCallback(
    () => withPlayer((p) => (p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo()), undefined),
    [withPlayer],
  );

  return useMemo(
    () => ({ mount: setElement, state, error, ready, getCurrentTime, getDuration, seekTo, play, pause, togglePlay }),
    [state, error, ready, getCurrentTime, getDuration, seekTo, play, pause, togglePlay],
  );
}
