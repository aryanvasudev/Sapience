"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import { ComputerIcon, DarkModeIcon, LightModeIcon, LogoutIcon, PersonAddIcon, SettingsIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";

export function UserMenu({ email, isAnonymous }: { email: string | null; isAnonymous: boolean }) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const name = isAnonymous ? "Guest" : (email ?? "Your account");
  const initial = isAnonymous ? "G" : (email?.[0]?.toUpperCase() ?? "?");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Account menu for ${name}`} className="rounded-full">
          <span className="grid size-8 place-items-center rounded-full border bg-card font-serif text-sm font-medium transition-colors duration-150 ease-(--ease-out) group-aria-expanded/button:border-foreground/30">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          {isAnonymous ? (
            <span className="text-xs font-normal text-muted-foreground">
              Signing out of a guest session loses its progress. Create an account first to keep it.
            </span>
          ) : null}
        </DropdownMenuLabel>
        {isAnonymous ? (
          <DropdownMenuItem asChild>
            <Link href="/signup">
              <PersonAddIcon />
              Create an account
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <SettingsIcon />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <LightModeIcon />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <DarkModeIcon />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <ComputerIcon />
              Match my device
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => signOut());
          }}
        >
          <LogoutIcon />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
