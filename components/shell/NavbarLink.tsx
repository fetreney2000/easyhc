"use client";

import Link from "next/link";
import { UnstyledButton, Group, Text, ThemeIcon } from "@mantine/core";

interface NavbarLinkProps {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  /** Optional — used to close the mobile drawer after navigating. */
  onClick?: () => void;
}

/**
 * Sidebar navigation item. Rendered as a real <Link> (not a button that
 * calls router.push) so middle-click, copy-link, browser history and
 * screen-reader link semantics all work, with aria-current for the active
 * route (WCAG 4.1.2 / 2.4.4).
 */
export function NavbarLink({
  label,
  icon,
  href,
  active,
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
          ? "var(--mantine-primary-color-light)"
          : "transparent",
        color: active
          ? "var(--mantine-primary-color-filled)"
          : "var(--mantine-color-text)",
        marginBottom: 2,
        textDecoration: "none",
      }}
    >
      <Group gap="sm">
        <ThemeIcon
          variant={active ? "light" : "subtle"}
          size="md"
          color={active ? "brandPrimary" : "gray"}
          aria-hidden
        >
          {icon}
        </ThemeIcon>
        <Text size="sm" fw={active ? 600 : 400}>
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
