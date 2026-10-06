"use client";

import { Center, Stack, Loader, Text } from "@mantine/core";
import { strings } from "@/lib/i18n/strings";

/**
 * App-wide route loading state — shown while a page's server component
 * tree resolves, so navigation never flashes a blank screen.
 */
export default function Loading() {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="sm">
        <Loader />
        <Text size="sm" c="var(--app-text-secondary)" role="status">
          {strings.loading}
        </Text>
      </Stack>
    </Center>
  );
}
