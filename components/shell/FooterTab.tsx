"use client";

import { Box, Tooltip } from "@mantine/core";

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
      <Tooltip label={label} position="top" withArrow openDelay={300}>
        <Box
          onClick={onClick}
          style={{
            cursor: "pointer",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            position: "relative",
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
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.45)",
              marginTop: "-20px",
              color: "white",
            }}
          >
            {icon}
          </Box>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={label} position="top" withArrow openDelay={300}>
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
            height: "28px",
            transition: "color 0.15s ease",
          }}
        >
          {icon}
        </Box>
        {active && (
          <Box
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              background: "var(--mantine-primary-color-filled)",
              marginTop: "4px",
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}