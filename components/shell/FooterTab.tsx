"use client";

import { Box, Text } from "@mantine/core";

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
      <Box
        onClick={onClick}
        style={{
          cursor: "pointer",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          height: "100%",
          position: "relative",
          paddingBottom: "4px",
        }}
      >
        <Box
          style={{
            position: "absolute",
            top: -18,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--mantine-primary-color-filled)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.45)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          {icon}
        </Box>
        <Text
          size="xs"
          fw={600}
          c="var(--mantine-primary-color-filled)"
          mt="28px"
          style={{ letterSpacing: "0.2px" }}
        >
          {label}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      onClick={onClick}
      style={{
        cursor: "pointer",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "2px",
        transition: "opacity 0.15s ease",
        opacity: active ? 1 : 0.5,
      }}
    >
      <Box
        style={{
          color: active
            ? "var(--mantine-primary-color-filled)"
            : "var(--mantine-color-dimmed)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "24px",
          transition: "color 0.15s ease",
        }}
      >
        {icon}
      </Box>
      <Text
        size="xs"
        fw={active ? 600 : 400}
        c={active ? "var(--mantine-primary-color-filled)" : "dimmed"}
        style={{ letterSpacing: "0.2px", lineHeight: 1.2 }}
      >
        {label}
      </Text>
      {active && (
        <Box
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "var(--mantine-primary-color-filled)",
            marginTop: "1px",
          }}
        />
      )}
    </Box>
  );
}