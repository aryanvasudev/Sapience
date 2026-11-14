"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Portal, PortalBackdrop } from "@/components/efferd/portal";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { useScroll } from "@/hooks/use-scroll";

/**
 * Public header. From Efferd (https://efferd.com, @efferd/header-2): sticky, transparent over the
 * hero, gains a surface and hairline once the page scrolls, and folds its links into a full-screen
 * menu on phones. Adapted: only pages and sections that exist are linked, the account actions come
 * from the server (they depend on the session), and only colour properties transition.
 *
 * Hover: one surface glides between the links under the pointer (a shared-layout morph), fades in
 * where the pointer enters and out when it leaves, and follows keyboard focus too. Mouse only, so
 * a tap on a touch screen never leaves it stranded.
 */
export const SITE_NAV = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Questions", href: "/#faqs" },
  { label: "Privacy", href: "/privacy" },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export function SiteHeader({ actions }: { actions?: ReactNode }) {
  const scrolled = useScroll(10);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      data-scrolled={scrolled || open}
      className="sticky top-0 z-50 border-b border-transparent transition-[background-color,border-color] duration-200 ease-(--ease-out) data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/70 data-[scrolled=true]:backdrop-blur-xl"
    >
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Wordmark />
        <div className="hidden items-center md:flex">
          <HoverNav />
          {actions ? <div className="ml-4 flex items-center gap-1">{actions}</div> : null}
        </div>
        <Button
          aria-controls="site-menu"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="relative md:hidden"
          onClick={() => setOpen((value) => !value)}
          size="icon"
          variant="ghost"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={open ? "close" : "menu"}
              className="grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: open ? -45 : 45, scale: 0.8, filter: "blur(2px)" }}
              animate={{ opacity: 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: open ? 45 : -45, scale: 0.8, filter: "blur(2px)" }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {open ? <CloseIcon className="size-4.5" /> : <MenuIcon className="size-4.5" />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </nav>

      {open ? (
        <Portal className="top-16 md:hidden" id="site-menu">
          <PortalBackdrop />
          <div className="size-full p-4">
            <ul className="grid gap-1">
              {SITE_NAV.map((link, i) => (
                <motion.li
                  key={link.href}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.28, ease: EASE, delay: i * 0.04 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center rounded-lg px-3 text-base font-medium transition-colors duration-150 ease-(--ease-out) active:bg-muted [@media(hover:hover)]:hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            {actions ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.28, ease: EASE, delay: SITE_NAV.length * 0.04 }}
                className="mt-8 grid gap-2 border-t pt-6 *:data-[slot=button]:h-12 *:data-[slot=button]:w-full"
              >
                {actions}
              </motion.div>
            ) : null}
          </div>
        </Portal>
      ) : null}
    </header>
  );
}

type Pill = { x: number; width: number; visible: boolean; glide: boolean };

/**
 * Desktop links with one hover surface. It is measured against the hovered link: arriving from
 * outside it appears in place (fade + slight scale), moving between links it glides on a soft
 * spring, and leaving the nav it fades out where it is. Only transform, width and opacity animate.
 */
function HoverNav() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pill, setPill] = useState<Pill>({ x: 0, width: 0, visible: false, glide: false });
  const reduce = useReducedMotion();

  const show = (href: string, target: HTMLElement) => {
    setHovered(href);
    setPill((prev) => ({ x: target.offsetLeft, width: target.offsetWidth, visible: true, glide: prev.visible }));
  };
  const hide = () => {
    setHovered(null);
    setPill((prev) => ({ ...prev, visible: false, glide: false }));
  };

  const move = reduce || !pill.glide ? { duration: 0 } : { type: "spring" as const, duration: 0.34, bounce: 0.1 };

  return (
    <ul className="relative flex items-center" onPointerLeave={hide}>
      <motion.li
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-9 rounded-md bg-foreground/[0.07] ring-1 ring-foreground/[0.06] ring-inset"
        initial={false}
        animate={{
          x: pill.x,
          width: pill.width,
          opacity: pill.visible ? 1 : 0,
          scale: pill.visible || reduce ? 1 : 0.96,
        }}
        transition={{
          x: move,
          width: move,
          opacity: { duration: pill.visible ? 0.18 : 0.15, ease: EASE },
          scale: { duration: 0.2, ease: EASE },
        }}
      />
      {SITE_NAV.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") show(link.href, event.currentTarget);
            }}
            onFocus={(event) => show(link.href, event.currentTarget)}
            onBlur={() => {
              if (hovered === link.href) hide();
            }}
            data-on={hovered === link.href}
            className="relative inline-flex h-9 items-center rounded-md px-3 text-[0.8125rem] text-muted-foreground transition-colors duration-200 ease-(--ease-out) outline-none focus-visible:ring-2 focus-visible:ring-ring data-[on=true]:text-foreground"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
