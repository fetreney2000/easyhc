"use client";

import Link from "next/link";
import { Box, Text, Tooltip } from "@mantine/core";

interface FooterTabProps {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  isPrimary?: boolean;
  /** Group colour for the active tab (matches the sidebar). */
  color?: string;
}

/**
 * Mobile tab-bar item.
 *
 * Rendered as a real <Link> with a VISIBLE text label: the previous version
 * was a div with onClick and its label trapped inside a tooltip, which meant
 * icon-only tabs that were neither keyboard-focusable nor announced
 * (WCAG 2.4.4, 4.1.2) — and the main navigation on phones.
 *
 * The active state is carried by colour AND font weight, never colour alone
 * (WCAG 1.4.1), and inactive items use a contrast-safe secondary colour
 * instead of opacity 0.5 (~1.7:1 → ~7:1).
 */
export function FooterTab({
  label,
  icon,
  href,
  active,
  isPrimary,
  color = "brandPrimary",
}: FooterTabProps) {
  if (isPrimary) {
    // Raised scan button: no room for a text label, so the link is named
    // explicitly and the tooltip is only a sighted-user affordance.
    return (
      <Tooltip label={label} position="top" withArrow openDelay={300}>
        <Box
          component={Link}
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            position: "relative",
            textDecoration: "none",
          }}
        >
          <Box
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--mantine-primary-color-filled)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--app-shadow-lift)",
              marginTop: "-20px",
              color: "white",
            }}
            aria-hidden
          >
            {icon}
          </Box>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      component={Link}
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        height: "100%",
        padding: "0 var(--mantine-spacing-xs)",
        textDecoration: "none",
        // Active tabs take their group colour so the mobile bar matches the
        // sidebar (Mantine emits -filled for every theme colour)
        color: active
          ? `var(--mantine-color-${color}-filled)`
          : "var(--app-text-secondary)",
        transition: "color 0.15s ease",
      }}
    >
      <Box style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
        {icon}
      </Box>
      <Text
        size="xs"
        fw={active ? 600 : 400}
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Text>
    </Box>
  );
}
