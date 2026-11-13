"use client";

/**
 * Markdown + KaTeX for notes and tutor answers (Section 9, 11). No raw HTML (no rehype-raw);
 * links open safely; `[mm:ss]` references become seekable chips when `onSeek` is given.
 */
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { linkTimestamps, parseTimestampHref } from "@/lib/timestamps";
import { cn } from "@/lib/utils";

import { TimestampChip } from "./timestamp-chip";

type MarkdownProps = {
  children: string;
  className?: string;
  onSeek?: (seconds: number) => void;
  durationSeconds?: number;
  /** Render as phrasing content (for labels and legends): paragraphs become spans. */
  inline?: boolean;
};

function MarkdownImpl({ children, className, onSeek, durationSeconds, inline }: MarkdownProps) {
  const source = onSeek && durationSeconds ? linkTimestamps(children, durationSeconds) : children;

  const components: Components = {
    a({ href, children: linkChildren }) {
      const seconds = parseTimestampHref(href);
      if (seconds !== null && onSeek) return <TimestampChip seconds={seconds} onSeek={onSeek} />;
      if (!href || !/^https?:\/\//.test(href)) return <span>{linkChildren}</span>;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline decoration-foreground/30 underline-offset-4">
          {linkChildren}
        </a>
      );
    },
    // Images in AI text are never loaded.
    img: () => null,
    ...(inline ? { p: ({ children: inner }) => <span className="block">{inner}</span> } : {}),
  };
  const Wrapper = inline ? "span" : "div";

  return (
    <Wrapper className={cn(inline ? "block" : "prose-notes", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", output: "html" }]]}
        components={components}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </Wrapper>
  );
}

export const Markdown = memo(MarkdownImpl);
