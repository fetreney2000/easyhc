"use client";

import Link from "next/link";
import { UnstyledButton, Group, Text, ThemeIcon, type MantineColor } from "@mantine/core";

interface NavbarLinkProps {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  /** Group colour for the icon (and the label when active). */
  color?: MantineColor;
  /** Optional — used to close the mobile drawer after navigating. */
  onClick?: () => void;
}

/**
 * Sidebar navigation item. Rendered as a real <Link> (not a button that
 * calls router.push) so middle-click, copy-link, browser history and
 * screen-reader link semantics all work, with aria-current for the active
 * route (WCAG 4.1.2 / 2.4.4).
 *
 * Each nav group has its own colour (see NAV_COLORS in AppShellLayout), so
 * the icon is tinted in both states instead of every entry being grey.
 */
export function NavbarLink({
  label,
  icon,
  href,
  active,
  color = "brandPrimary",
  onClick,
}: NavbarLinkProps) {
  return (
    <UnstyledButton
      component={Link}
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "var(--mantine-spacing-xs) var(--mantine-spacing-sm)",
        borderRadius: "var(--mantine-radius-md)",
        backgroundColor: active
          ? `var(--mantine-color-${color}-light)`
          : "transparent",
        marginBottom: 2,
        textDecoration: "none",
      }}
    >
      <Group gap="sm">
        <ThemeIcon
          variant={active ? "light" : "subtle"}
          size="md"
          color={color}
          aria-hidden
        >
          {icon}
        </ThemeIcon>
        {/* c= keeps the active label in the group colour (Mantine resolves
            custom theme colours like brandPrimary too) */}
        <Text size="sm" fw={active ? 600 : 400} c={active ? color : undefined}>
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
