"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import {
  ComputerIcon,
  DarkModeIcon,
  LightModeIcon,
  LogoutIcon,
  MonitoringIcon,
  PersonAddIcon,
  SettingsIcon,
  UnfoldMoreIcon,
} from "@/components/icons";
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
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { signOut } from "@/features/auth/actions";

/** Account row at the foot of the sidebar (Efferd app-shell nav-user), opening the account menu. */
export function SidebarUserMenu({
  email,
  isAnonymous,
  isAdmin = false,
}: {
  email: string | null;
  isAnonymous: boolean;
  isAdmin?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const { isMobile } = useSidebar();
  const [pending, startTransition] = useTransition();
  const name = isAnonymous ? "Guest" : (email?.split("@")[0] ?? "Your account");
  const detail = isAnonymous ? "Not saved to an account" : (email ?? "");
  const initial = isAnonymous ? "G" : (email?.[0]?.toUpperCase() ?? "?");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`Account menu for ${isAnonymous ? "Guest" : (email ?? "your account")}`}
              className="h-12 gap-2.5 px-2 data-[state=open]:bg-sidebar-accent"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-raised text-[0.8125rem] font-medium">
                {initial}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-[0.8125rem] font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{detail}</span>
              </span>
              <UnfoldMoreIcon className="ml-auto size-4! text-faint" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="w-64">
            <DropdownMenuLabel className="grid gap-0.5 py-2">
              <span className="truncate text-sm font-medium text-foreground">{isAnonymous ? "Guest" : (email ?? "Your account")}</span>
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
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/app/admin/usage">
                  <MonitoringIcon />
                  Usage
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="dark">
                  <DarkModeIcon />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">
                  <LightModeIcon />
                  Light
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
