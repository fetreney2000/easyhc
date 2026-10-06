"use client";

import { createTheme, MantineColorsTuple } from "@mantine/core";

const brandPrimary: MantineColorsTuple = [
  "#e8f0fe",
  "#c9d8fb",
  "#8aaff4",
  "#4a85ec",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
  "#1c3478",
  "#182d66",
];

/**
 * Semantic status scales — success / danger / warning.
 *
 * The values are Mantine's built-in green/red/orange, so this is a pure
 * rename today: pages used to hardcode `color="green"|"red"|"orange"`, which
 * meant recolouring a status meant editing every usage. Now it is one edit
 * here, and the names document intent at the call site.
 */
const success: MantineColorsTuple = [
  "#ebfbee",
  "#d3f9d8",
  "#b2f2bb",
  "#8ce99a",
  "#69db7c",
  "#51cf66",
  "#40c057",
  "#37b24d",
  "#2f9e44",
  "#2b8a3e",
];

const danger: MantineColorsTuple = [
  "#fff5f5",
  "#ffe3e3",
  "#ffc9c9",
  "#ffa8a8",
  "#ff8787",
  "#ff6b6b",
  "#fa5252",
  "#f03e3e",
  "#e03131",
  "#c92a2a",
];

const warning: MantineColorsTuple = [
  "#fff4e6",
  "#ffe8cc",
  "#ffd8a8",
  "#ffc078",
  "#ffa94d",
  "#ff922b",
  "#fd7e14",
  "#f76707",
  "#e8590c",
  "#d9480f",
];

export const theme = createTheme({
  primaryColor: "brandPrimary",
  colors: {
    brandPrimary,
    success,
    danger,
    warning,
  },
  defaultRadius: "md",
  // --font-inter is provided by next/font (app/layout.tsx): self-hosted,
  // non-blocking, and available offline. The old Google Fonts <import> was
  // render-blocking and failed without a connection.
  fontFamily:
    "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  components: {
    Button: {
      defaultProps: {
        size: "md",
      },
    },
    TextInput: {
      defaultProps: {
        size: "md",
      },
    },
    PasswordInput: {
      defaultProps: {
        size: "md",
      },
    },
    Select: {
      defaultProps: {
        size: "md",
      },
    },
    Table: {
      defaultProps: {
        size: "sm",
        striped: true,
        highlightOnHover: true,
      },
    },
  },
});