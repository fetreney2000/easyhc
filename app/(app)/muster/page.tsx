"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Title,
  Paper,
  Text,
  Group,
  Stack,
  Button,
  Badge,
  Loader,
  Center,
  SimpleGrid,
  Alert,
  Table,
} from "@mantine/core";
import {
  IconRefresh,
  IconMaximize,
  IconMinimize,
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
} from "@tabler/icons-react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { strings } from "@/lib/i18n/strings";
import { clock } from "@/lib/format";
import { can } from "@/lib/auth/rbac";
import type { EvacuationResponse } from "@/lib/evacuation";

interface PresenceRecord {
  _id: string;
  type: "employee" | "visitor";
  visitorName?: string;
  floorId: { _id: string; name: string };
  checkedInAt: string;
}

interface MusterData {
  attendance: PresenceRecord[];
  totalEmployees: number;
  totalVisitors: number;
  totalPresent: number;
  lastUpdated: string;
  rowCount: number;
  pageSize: number;
  total: number;
}

interface FloorTally {
  floorId: string;
  name: string;
  employees: number;
  visitors: number;
  total: number;
}

function StatCard({
  label,
  value,
  emphasis,
  color,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  /** Semantic token for the number (e.g. "success", "danger"). */
  color?: string;
}) {
  return (
    <Paper p="lg" radius="md" withBorder shadow={emphasis ? "sm" : undefined}>
      <Stack gap={4} align="center">
        <Text className="muster-label" c="var(--app-text-secondary)">
          {label}
        </Text>
        <Text
          className="muster-number"
          c={color ?? (emphasis ? "brandPrimary" : undefined)}
        >
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

/**
 * Muster mode — the view used DURING an evacuation or drill, not for admin
 * work: numbers sized for reading at arm's length (or projected), the whole
 * building's floor tallies, a browser-fullscreen toggle that hides the app
 * chrome, 10s refresh instead of 25s, a stale-data warning, and aria-live so
 * screen readers announce count changes.
 *
 * While an EVACUATION SESSION is active it switches to reconciliation mode:
 * Selamat / Belum Kesan / Dijangka over the roster snapshot, plus the missing
 * list (names only for roles allowed to see them — server-enforced). Presence
 * stays below: who is still in the building is a different question from who
 * reported safe at the assembly point.
 *
 * It reads the same scoped /api/attendance endpoint as the dashboard, so a
 * role only ever sees the floors its scope allows.
 */
export default function MusterPage() {
  const { data: session } = useSession();
  const [fullscreen, setFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data, error, isLoading, mutate } = useSWR<MusterData>(
    "/api/attendance?active=true&pageSize=1000",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  // Evacuation session (?roster=1 returns names only when this role may see
  // them: safety/admin everything, floor_head their floor, others counts)
  const {
    data: evac,
    error: evacError,
    isLoading: evacLoading,
    mutate: mutateEvac,
  } = useSWR<EvacuationResponse>(
    "/api/evacuation?roster=1&closed=1",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );
  const [pendingRosterId, setPendingRosterId] = useState<string | null>(null);

  const activeSession = evac?.session ?? null;

  // Missing people first — that is the list a warden acts on
  const rosterRows = useMemo(() => {
    const rows = [...(activeSession?.roster ?? [])];
    rows.sort((a, b) =>
      a.confirmedAt === b.confirmedAt
        ? a.name.localeCompare(b.name)
        : a.confirmedAt
          ? 1
          : -1
    );
    return rows;
  }, [activeSession?.roster]);

  const notifyError = async (res: Response) => {
    const err = await res.json().catch(() => ({}));
    notifications.show({
      title: strings.error,
      message: err.error || strings.serverError,
      color: "danger",
    });
  };

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
            await notifyError(res);
          }
          await mutateEvac();
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
          await mutateEvac();
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

  // Warden tap: confirm (or correct) another roster entry — the API re-checks
  // the caller's floor scope; this button only renders when the role holds
  // evacuation:confirm_others at all
  const handleRosterConfirm = async (rosterId: string, confirm: boolean) => {
    setPendingRosterId(rosterId);
    try {
      const res = await fetch("/api/evacuation/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId, confirm }),
      });
      if (!res.ok) await notifyError(res);
      await mutateEvac();
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

  // Track browser fullscreen so the button label/state stays truthful
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
        // Permission denied (or unsupported) — stay in the page
      });
    }
  };

  // Per-floor tallies, biggest first (where people are concentrated)
  const tallies = useMemo<FloorTally[]>(() => {
    const byFloor = new Map<string, FloorTally>();

    for (const record of data?.attendance ?? []) {
      const id = record.floorId?._id;
      if (!id) continue;

      const tally = byFloor.get(id) ?? {
        floorId: id,
        name: record.floorId?.name || strings.unknownFloor,
        employees: 0,
        visitors: 0,
        total: 0,
      };

      if (record.type === "employee") tally.employees += 1;
      else tally.visitors += 1;
      tally.total += 1;
      byFloor.set(id, tally);
    }

    return Array.from(byFloor.values()).sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    );
  }, [data?.attendance]);

  const ageSeconds = data
    ? Math.round((Date.now() - new Date(data.lastUpdated).getTime()) / 1000)
    : null;
  // The view refreshes every 10s — anything older than two ticks is stale
  const isStale = ageSeconds !== null && ageSeconds > 25;

  if (!session?.user) return <LoadingScreen />;

  const role = session.user.role;
  const canStart = can(role, "evacuation:start");
  const canClose = can(role, "evacuation:close");
  const canConfirmOthers = can(role, "evacuation:confirm_others");
  const counts = activeSession?.counts;
  // A session left running for hours is almost certainly a forgotten one —
  // say so instead of silently showing it forever (no auto-magic expiry)
  const sessionTooLong = activeSession
    ? Date.now() - new Date(activeSession.startedAt).getTime() > 2 * 60 * 60 * 1000
    : false;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.musterMode}
        description={strings.musterModeDesc}
        actions={
          <>
            {evac && !activeSession && canStart && (
              <Button
                color="danger"
                leftSection={<IconAlertTriangle size={16} />}
                onClick={handleStart}
              >
                {strings.evacStart}
              </Button>
            )}
            {activeSession && canClose && (
              <Button
                color="danger"
                variant="light"
                leftSection={<IconAlertTriangle size={16} />}
                onClick={handleClose}
              >
                {strings.evacClose}
              </Button>
            )}
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={isLoading}
              onClick={() => mutate()}
            >
              {strings.refresh}
            </Button>
            <Button
              leftSection={
                fullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? strings.musterExitFullscreen : strings.musterFullscreen}
            </Button>
          </>
        }
      />

      {/* The stage: the only thing on screen in fullscreen */}
      <div ref={contentRef}>
        {isLoading ? (
          <Center py="xl">
            <Loader size="xl" />
          </Center>
        ) : error ? (
          <ErrorState error={error} onRetry={mutate} />
        ) : (
          <Stack gap="xl">
            {/* Evacuation session — replaces the headline when the alarm is
                live; "no active session" (plus start + last-run summary)
                when it is not. Renders nothing until the first fetch lands. */}
            {evac &&
              (activeSession ? (
                <>
                  <Alert
                    color="danger"
                    icon={<IconAlertTriangle size={20} />}
                  >
                    <Group justify="space-between" wrap="wrap" gap="xs">
                      <Text fw={800} className="evac-title">
                        {strings.evacSessionActive}
                      </Text>
                      <Text size="sm">
                        {strings.evacStartedAt(clock(activeSession.startedAt))}
                        {" · "}
                        {activeSession.startedByName}
                      </Text>
                    </Group>
                  </Alert>

                  {/* role=status + aria-live: confirmations are announced */}
                  <SimpleGrid
                    cols={{ base: 1, sm: 3 }}
                    role="status"
                    aria-live="polite"
                  >
                    <StatCard
                      label={strings.evacSafe}
                      value={counts?.confirmed ?? 0}
                      color="success"
                      emphasis
                    />
                    <StatCard
                      label={strings.evacMissing}
                      value={counts?.missing ?? 0}
                      color="danger"
                    />
                    <StatCard
                      label={strings.evacExpected}
                      value={counts?.total ?? 0}
                    />
                  </SimpleGrid>

                  {sessionTooLong && (
                    <Alert icon={<IconAlertCircle size={16} />} color="warning">
                      {strings.evacSessionOld}
                    </Alert>
                  )}

                  {activeSession.rosterVisible ? (
                    <Stack gap="xs">
                      <Title order={2} size="h3">
                        {strings.evacRosterTitle}
                      </Title>
                      <DataTable
                        isLoading={evacLoading}
                        error={evacError}
                        isEmpty={rosterRows.length === 0}
                        minWidth={760}
                      >
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
                          {rosterRows.map((row) => (
                            <Table.Tr key={row._id}>
                              <Table.Td>{row.name}</Table.Td>
                              <Table.Td>
                                {row.type === "employee"
                                  ? strings.employee
                                  : strings.visitor}
                              </Table.Td>
                              <Table.Td>
                                {row.floorName ?? strings.unknownFloor}
                              </Table.Td>
                              <Table.Td>
                                {row.confirmedAt ? (
                                  <Badge
                                    color="success"
                                    leftSection={<IconCircleCheck size={12} />}
                                  >
                                    {strings.evacSafe} · {clock(row.confirmedAt)}
                                  </Badge>
                                ) : (
                                  <Badge color="danger">
                                    {strings.evacMissing}
                                  </Badge>
                                )}
                              </Table.Td>
                              {canConfirmOthers && (
                                <Table.Td>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color={
                                      row.confirmedAt ? "gray" : "success"
                                    }
                                    loading={pendingRosterId === row._id}
                                    onClick={() =>
                                      handleRosterConfirm(
                                        row._id,
                                        !row.confirmedAt
                                      )
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
                </>
              ) : (
                <Stack gap="md" align="start">
                  <Text
                    className="muster-floor-name"
                    c="var(--app-text-secondary)"
                  >
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
                  {evac?.lastClosed && (
                    <Text size="sm" c="var(--app-text-secondary)">
                      {strings.evacLastClosed(
                        clock(evac.lastClosed.closedAt),
                        evac.lastClosed.counts.confirmed,
                        evac.lastClosed.counts.total
                      )}
                    </Text>
                  )}
                </Stack>
              ))}

            {/* role=status + aria-live: count changes are announced */}
            <SimpleGrid
              cols={{ base: 1, sm: 3 }}
              role="status"
              aria-live="polite"
            >
              <StatCard
                label={strings.totalPresent}
                value={data?.totalPresent ?? 0}
                emphasis
              />
              <StatCard
                label={strings.totalEmployees}
                value={data?.totalEmployees ?? 0}
              />
              <StatCard
                label={strings.totalVisitors}
                value={data?.totalVisitors ?? 0}
              />
            </SimpleGrid>

            {isStale && (
              <Alert icon={<IconAlertCircle size={16} />} color="warning">
                {strings.musterStale}
              </Alert>
            )}

            <Title order={2} size="h3">
              {strings.musterByFloor}
            </Title>

            {tallies.length === 0 ? (
              <Center py="xl">
                <Text className="muster-floor-name">
                  {strings.noOnePresent}
                </Text>
              </Center>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {tallies.map((tally) => (
                  <Paper key={tally.floorId} p="lg" radius="md" withBorder>
                    <Stack gap="xs" align="center">
                      <Text className="muster-floor-name" ta="center">
                        {tally.name}
                      </Text>
                      <Text className="muster-number" c="brandPrimary">
                        {tally.total}
                      </Text>
                      <Group gap="md">
                        <Badge size="lg" color="blue" variant="light">
                          {tally.employees} {strings.employee}
                        </Badge>
                        <Badge size="lg" color="warning" variant="light">
                          {tally.visitors} {strings.visitor}
                        </Badge>
                      </Group>
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            )}

            <Text
              className="muster-label"
              c="var(--app-text-secondary)"
              ta="center"
            >
              {strings.lastUpdated}:{" "}
              {data
                ? new Date(data.lastUpdated).toLocaleTimeString("ms-MY")
                : "—"}
              {data && data.rowCount < data.total
                ? ` · ${strings.showingXofY(data.rowCount, data.total)}`
                : ""}
            </Text>
          </Stack>
        )}
      </div>
    </Stack>
  );
}
