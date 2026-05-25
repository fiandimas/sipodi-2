"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group pointer-events-auto md:![--width:560px]"
      toastOptions={{
        style: {
          "--z-index": 99999,
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties,
        classNames: {
          toast: "group toast border shadow-lg rounded-lg px-4 py-3 gap-2",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton:
            "h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
          cancelButton:
            "h-8 px-3 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
