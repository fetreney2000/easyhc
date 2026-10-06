"use client";

import { Center, Stack, Text, Button, Paper } from "@mantine/core";
import { IconWifiOff } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";

/**
 * Offline fallback rendered by the service worker when a page is requested
 * without a connection and is not in the cache.
 */
export default function OfflinePage() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-default-bg)">
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        w={{ base: "100%", xs: 420 }}
        maw={420}
        mx="md"
      >
        <Stack align="center" gap="md">
          <IconWifiOff size={40} color="var(--mantine-color-orange-6)" />
          <Text fw={700} ta="center">
            {strings.offlineTitle}
          </Text>
          <Text size="sm" c="var(--app-text-secondary)" ta="center">
            {strings.offlineMessage}
          </Text>
          <Button variant="light" onClick={() => window.location.reload()}>
            {strings.retry}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
