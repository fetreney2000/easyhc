"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertTriangle, IconDownload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { strings } from "@/lib/i18n/strings";
import { clock, duration } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { can } from "@/lib/auth/rbac";
import { EVACUATION_KEY, EVACUATION_HISTORY_KEY } from "@/lib/evacuationKey";
import type { EvacuationResponse } from "@/lib/evacuation";

function StatMini({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap={2} align="center">
        <Text className="evac-label" c="var(--app-text-secondary)">
          {label}
        </Text>
        <Text fw={800} size="xl" c={color}>
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

/**
 * Evacuation mode landing page (idle state only — while a session runs the
 * layout takeover swallows every route).
 *
 * Two jobs in normal mode:
 *  1. activate a session (one big centred button; only the four roles that
 *     hold evacuation:start see it — a header duplicate was removed as
 *     redundant), and
 *  2. for evacuation:view_report holders, the after-action reports: every
 *     closed session with duration/counts, drilling into per-floor tallies
 *     and the full roster (own-floor scoped for ketua lantai), with a CSV
 *     export for incident documentation.
 */
export default function EvacuationPage() {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR<EvacuationResponse>(
    EVACUATION_KEY,
    fetcher,
    // Same 30s idle cadence as the layout (both share this key's cache, so
    // starting a session here still mutates every screen immediately)
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const role = session?.user?.role;
  const canStart = role ? can(role, "evacuation:start") : false;
  const canViewReport = role ? can(role, "evacuation:view_report") : false;

  // History is omitted server-side without the permission; the key is null
  // for everyone else, so they never even fetch it
  const {
    data: historyData,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR<EvacuationResponse>(
    canViewReport ? EVACUATION_HISTORY_KEY : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const [detailId, setDetailId] = useState<string | null>(null);
  const {
    data: detailData,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR<EvacuationResponse>(
    detailId ? `/api/evacuation/${detailId}` : null,
    fetcher
  );
  const detailSession = detailData?.session ?? null;

  // Missing people first — that is the line an incident reviewer reads
  const rosterRows = useMemo(() => {
    const rows = [...(detailSession?.roster ?? [])];
    rows.sort((a, b) =>
      a.confirmedAt === b.confirmedAt
        ? a.name.localeCompare(b.name)
        : a.confirmedAt
          ? 1
          : -1
    );
    return rows;
  }, [detailSession?.roster]);

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

  /** Incident documentation: the roster exactly as scoped to this viewer. */
  const handleExportCsv = () => {
    if (!detailSession) return;
    downloadCsv(
      [
        strings.name,
        strings.typeLabel,
        strings.floors,
        strings.status,
        strings.evacConfirmTime,
      ],
      rosterRows.map((row) => [
        row.name,
        row.type === "employee" ? strings.employee : strings.visitor,
        row.floorName ?? "-",
        row.confirmedAt ? strings.evacSafe : strings.evacMissing,
        row.confirmedAt
          ? new Date(row.confirmedAt).toLocaleString("ms-MY")
          : "",
      ]),
      `laporan-evakuasi-${detailSession.startedAt.split("T")[0]}.csv`
    );
    notifications.show({
      title: strings.success,
      message: strings.csvExported,
      color: "success",
    });
  };

  if (!session?.user) return <LoadingScreen />;

  // A session is live → the layout is already rendering the takeover
  if (data?.session) return null;

  const history = historyData?.history ?? [];

  return (
    <Stack gap="lg">
      <PageHeader title={strings.evacMode} description={strings.evacModeDesc} />
      {/* One start button only: the big centred action in the empty state
          below (a header duplicate was redundant) */}

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
            {/* One-line summary only for roles that cannot see the history
                table below (it would just repeat its first row) */}
            {!canViewReport && data?.lastClosed && (
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

      {canViewReport && (
        <Stack gap="md">
          <Title order={2} size="h3">
            {strings.evacReportTitle}
          </Title>
          <DataTable
            isLoading={historyLoading}
            error={historyError}
            isEmpty={history.length === 0}
            empty={strings.evacNoReports}
            minWidth={760}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{strings.evacReportWhen}</Table.Th>
                <Table.Th>{strings.evacDuration}</Table.Th>
                <Table.Th>{strings.evacSafe}</Table.Th>
                <Table.Th>{strings.evacExpected}</Table.Th>
                <Table.Th>{strings.evacMissing}</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((item) => (
                <Table.Tr key={item._id}>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(item.startedAt).toLocaleDateString("ms-MY")}
                    </Text>
                    <Text size="xs" c="var(--app-text-secondary)">
                      {clock(item.startedAt)} – {clock(item.closedAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{duration(item.startedAt, item.closedAt)}</Table.Td>
                  <Table.Td>{item.counts.confirmed}</Table.Td>
                  <Table.Td>{item.counts.total}</Table.Td>
                  <Table.Td>
                    {item.counts.missing > 0 ? (
                      <Badge color="danger">{item.counts.missing}</Badge>
                    ) : (
                      <Badge color="success">0</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setDetailId(item._id)}
                    >
                      {strings.evacViewDetail}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </DataTable>
        </Stack>
      )}

      <Modal
        opened={detailId !== null}
        onClose={() => setDetailId(null)}
        size="xl"
        title={strings.evacReportDetail}
      >
        {/* The roster can be long — scroll INSIDE the modal so it never
            grows past the viewport */}
        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        {detailLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : detailError ? (
          <ErrorState error={detailError} onRetry={mutateDetail} />
        ) : detailSession ? (
          <Stack gap="md">
            <Text size="sm" c="var(--app-text-secondary)">
              {strings.evacStartedAt(clock(detailSession.startedAt))} ·{" "}
              {detailSession.startedByName}
              {detailSession.closedAt
                ? ` — ${clock(detailSession.startedAt)}–${clock(
                    detailSession.closedAt
                  )}`
                : ""}
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <StatMini
                label={strings.evacSafe}
                value={detailSession.counts.confirmed}
                color="success"
              />
              <StatMini
                label={strings.evacMissing}
                value={detailSession.counts.missing}
                color="danger"
              />
              <StatMini
                label={strings.evacDuration}
                value={
                  detailSession.closedAt
                    ? duration(
                        detailSession.startedAt,
                        detailSession.closedAt
                      )
                    : "—"
                }
              />
            </SimpleGrid>

            {(detailSession.floors?.length ?? 0) > 0 && (
              <div>
                <Title order={4} mb={4}>
                  {strings.evacByFloor}
                </Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{strings.floors}</Table.Th>
                      <Table.Th>{strings.evacExpected}</Table.Th>
                      <Table.Th>{strings.evacSafe}</Table.Th>
                      <Table.Th>{strings.evacMissing}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(detailSession.floors ?? []).map((floor) => (
                      <Table.Tr key={floor.floorId}>
                        <Table.Td>{floor.name}</Table.Td>
                        <Table.Td>{floor.expected}</Table.Td>
                        <Table.Td>{floor.confirmed}</Table.Td>
                        <Table.Td>{floor.missing}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}

            {detailSession.rosterVisible ? (
              <div>
                <Group justify="space-between" mb={4}>
                  <Title order={4}>{strings.evacRosterTitle}</Title>
                  <Button
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    onClick={handleExportCsv}
                  >
                    {strings.exportCSV}
                  </Button>
                </Group>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{strings.name}</Table.Th>
                      <Table.Th>{strings.typeLabel}</Table.Th>
                      <Table.Th>{strings.floors}</Table.Th>
                      <Table.Th>{strings.status}</Table.Th>
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
                            <Badge color="success">
                              {strings.evacSafe} · {clock(row.confirmedAt)}
                            </Badge>
                          ) : (
                            <Badge color="danger">{strings.evacMissing}</Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            ) : (
              <Text size="sm" c="var(--app-text-secondary)">
                {strings.evacNamesNote}
              </Text>
            )}
          </Stack>
        ) : null}
        </div>
      </Modal>
    </Stack>
  );
}
