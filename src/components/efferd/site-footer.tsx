import Link from "next/link";

import { Wordmark } from "@/components/layout/wordmark";

/**
 * Public-page footer. Structure from Efferd (https://efferd.com, @efferd/footer-1): brand row,
 * link row, then a hairline and a credit line. Social buttons and placeholder links are dropped;
 * only pages that exist are linked.
 */
const LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Create an account" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
        <Wordmark />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex h-11 items-center transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-sm text-muted-foreground md:px-6">
          Built by team CodeCrushers for VentureX, E-Summit ’26
        </p>
      </div>
    </footer>
  );
}
