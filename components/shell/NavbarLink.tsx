"use client";

import { UnstyledButton, Group, Text, ThemeIcon } from "@mantine/core";

interface NavbarLinkProps {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  onClick: () => void;
}

export function NavbarLink({ label, icon, active, onClick }: NavbarLinkProps) {
  return (
    <UnstyledButton
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
      }}
    >
      <Group gap="sm">
        <ThemeIcon
          variant={active ? "light" : "subtle"}
          size="md"
          color={active ? "brandPrimary" : "gray"}
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