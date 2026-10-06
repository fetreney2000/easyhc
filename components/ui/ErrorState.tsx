import { Center, Stack, Text, Alert, Button } from "@mantine/core";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";
import { ApiError } from "@/lib/api/fetcher";

/**
 * Shared failure state for data views.
 *
 * The fetcher throws on non-2xx, so without this every page silently showed
 * "Tiada data tersedia" for a 401/403/500 — users could not tell an empty
 * list from a broken one. Renders the server's message (or a generic one)
 * plus a retry that re-runs the SWR request.
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError ? error.message : strings.serverError;

  return (
    <Center py="xl">
      <Stack align="center" gap="md" w="100%">
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="danger"
          variant="light"
          w="100%"
        >
          {message}
        </Alert>
        {onRetry && (
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={onRetry}
          >
            {strings.retry}
          </Button>
        )}
      </Stack>
    </Center>
  );
}
