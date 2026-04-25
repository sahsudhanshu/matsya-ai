"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const darkMode =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark")

  return (
    <Sonner
      theme={darkMode ? "dark" : "light"}
      richColors
      closeButton
      expand
      visibleToasts={5}
      duration={4000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "pointer-events-auto",
        },
      }}
      style={{
        zIndex: 2147483647,
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
