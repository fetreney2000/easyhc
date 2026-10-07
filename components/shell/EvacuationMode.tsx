"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { strings } from "@/lib/i18n/strings";
import { clock } from "@/lib/format";
import { can } from "@/lib/auth/rbac";
import { DataTable } from "@/components/ui/DataTable";
import type { EvacuationResponse } from "@/lib/evacuation";
import type { Role } from "@/lib/db/types";

interface EvacuationModeProps {
  user: { id: string; name: string; role: Role; username: string };
  data: EvacuationResponse;
  /** Revalidate the shared SWR key — flipping back when a session closes. */
  onRefresh: () => Promise<unknown>;
}

function StatCard({
  label,
  value,
  color,
  emphasis,
}: {
  label: string;
  value: number;
  color?: string;
  emphasis?: boolean;
}) {
  return (
    <Paper p="lg" radius="md" withBorder shadow={emphasis ? "sm" : undefined}>
      <Stack gap={4} align="center">
        <Text className="evac-label" c="var(--app-text-secondary)">
          {label}
        </Text>
        <Text className="evac-number" c={color}>
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

/**
 * The ENTIRE app while an evacuation session is active (spec): this component
 * replaces the shell — no header, no sidebar, no footer, no page content —
 * at every route, until the session is closed.
 *
 * Flow: everyone gets one giant "Saya Selamat" button; only after confirming
 * do the building-wide stats, the scoped floor locations and (for warden
 * roles) the name list appear. Visitors never reach this component — they
 * confirm from their own public check-in page and see no stats at all.
 */
export function EvacuationMode({ user, data, onRefresh }: EvacuationModeProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRosterId, setPendingRosterId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const session = data.session;

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const element = contentRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch(() => {
        // Permission denied — the display already fills the viewport
      });
    }
  };

  const notifyError = async (res: Response) => {
    const err = await res.json().catch(() => ({}));
    notifications.show({
      title: strings.error,
      message: err.error || strings.serverError,
      color: "danger",
    });
  };

  /** One tap: "I reached the assembly point" — atomic + idempotent. */
  const confirmSelf = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/evacuation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.evacSafeRecorded,
          color: "success",
        });
        await onRefresh();
      } else {
        await notifyError(res);
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** Warden tap on the roster (own floor only — the API enforces it). */
  const handleRosterConfirm = async (rosterId: string, confirm: boolean) => {
    setPendingRosterId(rosterId);
    try {
      const res = await fetch("/api/evacuation/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId, confirm }),
      });
      if (!res.ok) await notifyError(res);
      await onRefresh();
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setPendingRosterId(null);
    }
  };

  const handleClose = () => {
    modals.openConfirmModal({
      title: strings.evacClose,
      children: <Text size="sm">{strings.evacCloseConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        try {
          const res = await fetch("/api/evacuation", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (res.ok) {
            notifications.show({
              title: strings.success,
              message: strings.evacCloseSuccess,
              color: "success",
            });
          } else {
            await notifyError(res);
          }
          await onRefresh(); // session gone → the shell comes back
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

  if (!session) return null;

  const confirmed = !!session.mine.confirmedAt;
  const canClose = can(user.role, "evacuation:close");
  const canConfirmOthers = can(user.role, "evacuation:confirm_others");
  const counts = session.counts;
  const floors = session.floors ?? [];
  const roster = session.roster ?? [];
  const sessionTooLong =
    Date.now() - new Date(session.startedAt).getTime() > 2 * 60 * 60 * 1000;

  return (
    <div ref={contentRef} className="evac-fullscreen">
      <Stack gap="xl" py={{ base: "md", md: "xl" }} px={{ base: "md", md: "xl" }}>
        {/* Header — the only chrome: title, time, display controls */}
        <Group justify="space-between" gap="md" wrap="wrap">
          <Stack gap={4}>
            <Title order={1} className="evac-headline" c="danger">
              {strings.evacSessionActive}
            </Title>
            <Text className="evac-label" c="var(--app-text-secondary)">
              {strings.evacStartedAt(clock(session.startedAt))} ·{" "}
              {session.startedByName}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={
                fullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? strings.evacExitFullscreen : strings.evacFullscreen}
            </Button>
            {canClose && (
              <Button
                color="danger"
                leftSection={<IconAlertTriangle size={18} />}
                onClick={handleClose}
              >
                {strings.evacClose}
              </Button>
            )}
          </Group>
        </Group>

        {sessionTooLong && (
          <Alert icon={<IconAlertCircle size={16} />} color="warning">
            {strings.evacSessionOld}
          </Alert>
        )}

        {!confirmed ? (
          /* Gate: one giant button, no stats until they have confirmed */
          <Center mih="55vh">
            <Stack align="center" gap="xl" w="100%">
              <Text className="evac-prompt" ta="center">
                {strings.evacSafePrompt}
              </Text>
              {session.mine.inRoster ? (
                <Button
                  autoFocus
                  className="evac-safe-btn"
                  color="danger"
                  size="xl"
                  loading={submitting}
                  leftSection={<IconCircleCheck size={32} />}
                  onClick={confirmSelf}
                >
                  {strings.evacImSafe}
                </Button>
              ) : (
                <Text className="evac-prompt" c="danger" ta="center">
                  {strings.evacNotInRoster}
                </Text>
              )}
            </Stack>
          </Center>
        ) : (
          <Stack gap="xl">
            {/* role=status + aria-live: count changes are announced */}
            <SimpleGrid cols={{ base: 1, sm: 3 }} role="status" aria-live="polite">
              <StatCard
                label={strings.evacSafe}
                value={counts.confirmed}
                color="success"
                emphasis
              />
              <StatCard
                label={strings.evacMissing}
                value={counts.missing}
                color="danger"
              />
              <StatCard label={strings.evacExpected} value={counts.total} />
            </SimpleGrid>

            {floors.length > 0 && (
              <Stack gap="md">
                <Title order={2} size="h2">
                  {strings.evacByFloor}
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                  {floors.map((floor) => (
                    <Paper key={floor.floorId} p="lg" radius="md" withBorder>
                      <Stack gap="xs" align="center">
                        <Text className="evac-floor-name" ta="center">
                          {floor.name}
                        </Text>
                        <Text
                          className="evac-number"
                          c={floor.missing > 0 ? "danger" : "success"}
                        >
                          {floor.confirmed}/{floor.expected}
                        </Text>
                        <Group gap="md">
                          <Badge size="lg" color="success" variant="light">
                            {strings.evacSafe}: {floor.confirmed}
                          </Badge>
                          <Badge size="lg" color="danger" variant="light">
                            {strings.evacMissing}: {floor.missing}
                          </Badge>
                        </Group>
                      </Stack>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            )}

            {session.rosterVisible ? (
              <Stack gap="xs">
                <Title order={2} size="h2">
                  {strings.evacRosterTitle}
                </Title>
                <DataTable isEmpty={roster.length === 0} minWidth={760}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{strings.name}</Table.Th>
                      <Table.Th>{strings.typeLabel}</Table.Th>
                      <Table.Th>{strings.floors}</Table.Th>
                      <Table.Th>{strings.status}</Table.Th>
                      {canConfirmOthers && (
                        <Table.Th>{strings.actions}</Table.Th>
                      )}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {roster.map((row) => (
                      <Table.Tr key={row._id}>
                        <Table.Td>{row.name}</Table.Td>
                        <Table.Td>
                          {row.type === "employee"
                            ? strings.employee
                            : strings.visitor}
                        </Table.Td>
                        <Table.Td>{row.floorName ?? strings.unknownFloor}</Table.Td>
                        <Table.Td>
                          {row.confirmedAt ? (
                            <Badge
                              color="success"
                              leftSection={<IconCircleCheck size={12} />}
                            >
                              {strings.evacSafe} · {clock(row.confirmedAt)}
                            </Badge>
                          ) : (
                            <Badge color="danger">{strings.evacMissing}</Badge>
                          )}
                        </Table.Td>
                        {canConfirmOthers && (
                          <Table.Td>
                            <Button
                              size="xs"
                              variant="light"
                              color={row.confirmedAt ? "gray" : "success"}
                              loading={pendingRosterId === row._id}
                              onClick={() =>
                                handleRosterConfirm(row._id, !row.confirmedAt)
                              }
                            >
                              {row.confirmedAt
                                ? strings.evacUnmarkSafe
                                : strings.evacMarkSafe}
                            </Button>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </DataTable>
              </Stack>
            ) : (
              <Text size="sm" c="var(--app-text-secondary)">
                {strings.evacNamesNote}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
}
