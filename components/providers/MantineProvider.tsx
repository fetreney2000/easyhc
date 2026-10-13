"use client";

import { MantineProvider as BaseMantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { theme } from "@/theme/theme";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

export function MantineProvider({ children }: { children: React.ReactNode }) {
  // Motion for modals opened through @mantine/modals (confirm dialogs);
  // direct <Modal> instances get the same fade from theme.components.Modal.
  const modalMotion = {
    transitionProps: { transition: "fade" as const, duration: 150 },
    exitTransitionProps: { duration: 100 },
  };

  return (
    <BaseMantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider modalProps={modalMotion}>
        <Notifications position="top-right" transitionDuration={150} />
        {children}
      </ModalsProvider>
    </BaseMantineProvider>
  );
}