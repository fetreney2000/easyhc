"use client";

import { useEffect } from "react";
import { Center, Stack, Text, Button, Paper, Group } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";

/**
 * Route-level error boundary (Next.js convention): any unhandled error in a
 * page subtree renders this instead of Next's bare default error page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <Center mih="100vh" bg="var(--mantine-color-default-bg)">
      <Paper shadow="md" p="xl" radius="md" w={{ base: "100%", xs: 420 }} maw={420} mx="md">
        <Stack align="center" gap="md">
          <IconAlertCircle size={40} color="red" />
          <Text fw={700} ta="center">
            {strings.pageError}
          </Text>
          <Text size="sm" c="var(--app-text-secondary)" ta="center">
            {strings.serverError}
          </Text>
          <Group gap="sm">
            <Button variant="light" onClick={reset}>
              {strings.retry}
            </Button>
            <Button variant="subtle" onClick={() => (window.location.href = "/dashboard")}>
              {strings.dashboard}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Center>
  );
}
