"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { strings } from "@/lib/i18n/strings";
import { clock } from "@/lib/format";
import { can } from "@/lib/auth/rbac";
import { EVACUATION_KEY } from "@/lib/evacuationKey";
import type { EvacuationResponse } from "@/lib/evacuation";

/**
 * Evacuation mode launch pad (idle state).
 *
 * While a session is ACTIVE this route is swallowed by the layout takeover —
 * every route in the app renders the full-screen display instead, so this
 * page only ever shows when the app is idle: start it (four roles), or read
 * the last run's summary. It shares the layout's SWR key, so starting here
 * flips every open screen immediately.
 */
export default function EvacuationPage() {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR<EvacuationResponse>(
    EVACUATION_KEY,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const handleStart = () => {
    modals.openConfirmModal({
      title: strings.evacStart,
      children: <Text size="sm">{strings.evacStartConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        try {
          const res = await fetch("/api/evacuation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (res.ok) {
            notifications.show({
              title: strings.success,
              message: strings.evacStartSuccess,
              color: "success",
            });
          } else {
            const err = await res.json().catch(() => ({}));
            notifications.show({
              title: strings.error,
              message: err.error || strings.serverError,
              color: "danger",
            });
          }
          // Same key as the layout → takeover appears on every open screen
          await mutate();
        } catch {
          notifications.show({
            title: strings.error,
            message: strings.serverError,
            color: "danger",
          });
        }
      },
    });
  };

  if (!session?.user) return <LoadingScreen />;

  // A session is live → the layout is already rendering the takeover
  if (data?.session) return null;

  const canStart = can(session.user.role, "evacuation:start");

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.evacMode}
        description={strings.evacModeDesc}
        actions={
          canStart ? (
            <Button
              color="danger"
              leftSection={<IconAlertTriangle size={16} />}
              onClick={handleStart}
            >
              {strings.evacStart}
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <Center py="xl">
          <Loader size="xl" />
        </Center>
      ) : error ? (
        <ErrorState error={error} onRetry={mutate} />
      ) : (
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md" py="lg">
            <Text className="evac-floor-name" c="var(--app-text-secondary)">
              {strings.evacNoSession}
            </Text>
            {canStart && (
              <Button
                color="danger"
                size="lg"
                leftSection={<IconAlertTriangle size={20} />}
                onClick={handleStart}
              >
                {strings.evacStart}
              </Button>
            )}
            {data?.lastClosed && (
              <Text size="sm" c="var(--app-text-secondary)">
                {strings.evacLastClosed(
                  clock(data.lastClosed.closedAt),
                  data.lastClosed.counts.confirmed,
                  data.lastClosed.counts.total
                )}
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
