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

export const theme = createTheme({
  primaryColor: "brandPrimary",
  colors: {
    brandPrimary,
  },
  defaultRadius: "md",
  fontFamily:
    "'Inter', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily:
      "'Inter', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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