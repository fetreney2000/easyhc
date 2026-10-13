"use client";

import { SimpleGrid, Skeleton, Stack } from "@mantine/core";
import { strings } from "@/lib/i18n/strings";

/**
 * App-wide route loading state — a skeleton of the page shape that is
 * coming (header, stat row, board) rather than a spinner, so navigation
 * reads as "arriving" and never flashes a blank screen. Announced to
 * screen readers via role="status".
 */
export default function Loading() {
  return (
    <Stack gap="lg" p="md" role="status" aria-label={strings.loading}>
      <Skeleton height={32} radius="md" width="min(320px, 60%)" />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height={84} radius="md" />
        ))}
      </SimpleGrid>
      <Skeleton height={260} radius="md" />
    </Stack>
  );
}
