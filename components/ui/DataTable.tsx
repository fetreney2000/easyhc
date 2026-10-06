import { Paper, Table, Center, Loader, Text } from "@mantine/core";
import { ErrorState } from "./ErrorState";
import { strings } from "@/lib/i18n/strings";

interface DataTableProps {
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** True when the loaded result set has no rows. */
  isEmpty?: boolean;
  /** Empty-state message (defaults to a generic one). */
  empty?: React.ReactNode;
  /**
   * Width before the table scrolls horizontally. Every list uses this: a bare
   * <Table> overflowed its card on narrow screens (WCAG 1.4.10 reflow).
   */
  minWidth?: number;
  /** Thead + Tbody. */
  children: React.ReactNode;
}

/**
 * The standard list container: one Paper card that owns all four states
 * (loading / error / empty / data) and wraps the table in a scroll container.
 *
 * Replaces the hand-rolled ternary + Paper + optional ScrollContainer that
 * eight pages each re-implemented slightly differently.
 */
export function DataTable({
  isLoading,
  error,
  onRetry,
  isEmpty,
  empty,
  minWidth = 600,
  children,
}: DataTableProps) {
  return (
    <Paper p="md" radius="md" withBorder>
      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isEmpty ? (
        <Center py="xl">
          <Text size="sm" c="var(--app-text-secondary)">
            {empty ?? strings.noDataAvailable}
          </Text>
        </Center>
      ) : (
        <Table.ScrollContainer minWidth={minWidth}>
          <Table>{children}</Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
