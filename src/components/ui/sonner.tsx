"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CancelIcon, CheckCircleIcon, InfoIcon, ProgressActivityIcon, WarningIcon } from "@/components/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon className="size-4.5" />
        ),
        info: (
          <InfoIcon className="size-4.5" />
        ),
        warning: (
          <WarningIcon className="size-4.5" />
        ),
        error: (
          <CancelIcon className="size-4.5" />
        ),
        loading: (
          <ProgressActivityIcon className="size-4.5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
