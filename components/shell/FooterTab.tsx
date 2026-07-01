"use client";

import { Center, Stack, Text, ActionIcon } from "@mantine/core";

interface FooterTabProps {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  isPrimary?: boolean;
  onClick: () => void;
}

export function FooterTab({
  label,
  icon,
  active,
  isPrimary,
  onClick,
}: FooterTabProps) {
  if (isPrimary) {
    return (
      <Center
        onClick={onClick}
        style={{
          cursor: "pointer",
          position: "relative",
          flex: 1,
          height: "100%",
        }}
      >
        <Stack align="center" gap={0} mt="-10px">
          <ActionIcon
            variant="filled"
            color="brandPrimary"
            size={48}
            radius="xl"
            style={{
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.4)",
            }}
          >
            {icon}
          </ActionIcon>
        <Text size="xs" fw={active ? 700 : 400} mt={2}>
            {label}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Center
      onClick={onClick}
      style={{
        cursor: "pointer",
        flex: 1,
        height: "100%",
        opacity: active ? 1 : 0.6,
      }}
    >
      <Stack align="center" gap={0}>
        {icon}
        <Text size="xs" fw={active ? 700 : 400} mt={2}>
          {label}
        </Text>
      </Stack>
    </Center>
  );
}