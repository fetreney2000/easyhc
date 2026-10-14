"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Title,
  SimpleGrid,
  Paper,
  Text,
  Group,
  Avatar,
  Badge,
  Table,
  ActionIcon,
  Center,
  Stack,
  Button,
  Select,
  TextInput,
  Pagination,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconUsers,
  IconUser,
  IconUserStar,
  IconBuilding,
  IconRefresh,
  IconLogout,
  IconSearch,
  IconDoorExit,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { clock, floorColor, relativeTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/db/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { can } from "@/lib/auth/rbac";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface PresenceRecord {
  _id: string;
  type: "employee" | "visitor";
  userId?: {
    _id: string;
    name: string;
    role: string;
  };
  visitorName?: string;
  floorId: {
    _id: string;
    name: string;
  };
  checkedInAt: string;
  /** Set on closed records — the recent check-outs feed uses it. */
  checkedOutAt?: string;
  method: string;
}

interface DashboardData {
  attendance: PresenceRecord[];
  totalEmployees: number;
  totalVisitors: number;
  totalPresent: number;
  /** Live board only: headcount per floor across ALL pages. */
  byFloor?: { floorId: string | null; count: number }[];
  lastUpdated: string;
  /** Rows on THIS page (capped at pageSize). */
  rowCount: number;
  pageSize: number;
  /** Rows matching the filters across ALL pages. */
  total: number;
  page: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Search runs SERVER-side (employee names live on the User document),
  // debounced so typing does not fire a request per keystroke
  const [debouncedQuery] = useDebouncedValue(search.trim(), 300);

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    `/api/attendance?active=true${floorFilter ? `&floorId=${floorFilter}` : ""}&page=${page}${
      debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ""
    }`,
    fetcher,
    {
      refreshInterval: 25000, // 25s polling per spec
      revalidateOnFocus: true,
    }
  );

  // A new filter or search term starts back at page 1
  useEffect(() => {
    setPage(1);
  }, [floorFilter, debouncedQuery]);

  // A shrinking result set must not strand the table on an out-of-range
  // page — that rendered "no one present" while the totals above showed
  // people present (people checked out, a muster ended, search narrowed)
  const lastPage = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize || 200))
  );
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  // Fetch floors for filter
  const { data: floors } = useSWR<{ _id: string; name: string; hue?: number }[]>(
    "/api/floors",
    fetcher
  );

  // Latest arrivals ("Daftar Masuk Terkini") — fetched as their own tiny
  // page so paging the main table can never redefine "latest", mirroring
  // the departures feed below
  const { data: arrivalsData } = useSWR<DashboardData>(
    `/api/attendance?active=true&page=1&pageSize=5${
      floorFilter ? `&floorId=${floorFilter}` : ""
    }`,
    fetcher,
    {
      refreshInterval: 25000,
      revalidateOnFocus: true,
    }
  );

  // Recent check-outs ("Daftar Keluar Terkini") — who just LEFT the
  // building; same cadence as the presence feed above
  const { data: checkoutsData } = useSWR<DashboardData>(
    "/api/attendance?checkedOut=true&page=1&pageSize=5",
    fetcher,
    {
      refreshInterval: 25000,
      revalidateOnFocus: true,
    }
  );

  const handleSelfCheckout = async () => {
    // Find current user's active attendance record
    const myRecord = data?.attendance?.find(
      (r) => r.type === "employee" && r.userId?._id === session?.user?.id
    );
    if (!myRecord) return;

    try {
      const res = await fetch("/api/attendance/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: myRecord._id }),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.checkOutSuccess,
          color: "success",
        });
        mutate();
      } else {
        const errData = await res.json();
        notifications.show({
          title: strings.error,
          message: errData.error || strings.checkOutError,
          color: "danger",
        });
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    }
  };

  /**
   * Force check-out is destructive (it removes someone from the muster), so
   * it now asks first — strings.forceCheckoutConfirm had been defined since
   * the first release but never used.
   */
  const handleForceCheckout = (attendanceId: string) => {
    modals.openConfirmModal({
      title: strings.forceCheckout,
      children: <Text size="sm">{strings.forceCheckoutConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        try {
          const res = await fetch("/api/attendance/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attendanceId, force: true }),
          });

          if (res.ok) {
            notifications.show({
              title: strings.success,
              message: strings.forceCheckoutSuccess,
              color: "success",
            });
            mutate();
          } else {
            const errData = await res.json();
            notifications.show({
              title: strings.error,
              message: errData.error || strings.serverError,
              color: "danger",
            });
          }
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

  // Server-side filtered + paginated: this is simply the current page
  const rows = useMemo(() => data?.attendance ?? [], [data?.attendance]);

  // Brief acknowledgement when the headline count ticks (hydration-safe:
  // false on first render, fires only on a real client-side change)
  const previousPresent = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const current = data?.totalPresent ?? null;
    if (
      current !== null &&
      previousPresent.current !== null &&
      current !== previousPresent.current
    ) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 900);
      previousPresent.current = current;
      return () => clearTimeout(timer);
    }
    previousPresent.current = current;
  }, [data?.totalPresent]);

  // Per-floor headcount for the operations strip — from the presence feed,
  // which is already scoped to what this role may see; floors with nobody
  // sort last but stay visible so an empty floor reads as "empty"
  const floorCounts = useMemo(() => {
    // Server-computed over the WHOLE board (all pages): deriving it from
    // the current page silently undercounted once more than a page of
    // people were present — the strip disagreed with the totals above it.
    // Floors with nobody present are dropped: the strip answers "where are
    // people right now", and zero cards were noise (a plain staffer saw
    // every building floor at 0 — floors their scope cannot even see).
    const countById = new Map(
      (data?.byFloor ?? []).map((row) => [row.floorId ?? "", row.count])
    );
    return (floors ?? [])
      .map((floor) => ({
        _id: floor._id,
        name: floor.name,
        hue: floor.hue,
        count: countById.get(floor._id) ?? 0,
      }))
      .filter((floor) => floor.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [data?.byFloor, floors]);

  // Latest arrivals (the dedicated feed is already newest-first)
  const recent = useMemo(
    () => (arrivalsData?.attendance ?? []).slice(0, 5),
    [arrivalsData?.attendance]
  );

  // Latest departures (newest-checked-out-first from the API)
  const recentOut = useMemo(
    () => (checkoutsData?.attendance ?? []).slice(0, 5),
    [checkoutsData?.attendance]
  );

  /** One feed row — shared by the arrivals and departures cards. */
  const feedRow = (
    record: PresenceRecord,
    whenIso: string,
    key: string
  ) => {
    const name =
      record.type === "employee" ? record.userId?.name : record.visitorName;
    return (
      <Group key={key} gap="sm" wrap="nowrap">
        <Avatar size="sm" radius="xl" color="brandPrimary" aria-hidden>
          {name?.charAt(0).toUpperCase() || "?"}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {name}
            {record.type === "visitor" ? ` (${strings.visitor})` : ""}
          </Text>
          <Text size="xs" c="var(--app-text-secondary)" truncate>
            {record.floorId?.name} · {relativeTime(whenIso)}
          </Text>
        </div>
      </Group>
    );
  };
  const pageCount = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  if (!session?.user) return <LoadingScreen />;

  const canForceCheckout =
    can(session.user.role, "attendance:checkout_all") ||
    can(session.user.role, "attendance:checkout_department") ||
    can(session.user.role, "attendance:checkout_own_floor") ||
    can(session.user.role, "attendance:checkout_own_unit");

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.dashboard}
        actions={
          <>
            {/* Trust signal: the number below is refreshed automatically */}
            <Badge
              variant="light"
              color="success"
              size="lg"
              leftSection={<span className="live-dot" aria-hidden="true" />}
              suppressHydrationWarning
            >
              {strings.liveNow}
              {data?.lastUpdated ? ` · ${clock(data.lastUpdated)}` : ""}
            </Badge>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => mutate()}
              loading={isLoading}
            >
              {strings.refresh}
            </Button>
          </>
        }
      />

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper p="md" radius="md" withBorder>
          <Group>
            <IconUsers size={32} color="var(--mantine-primary-color-filled)" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">
                {strings.totalPresent}
              </Text>
              <Text
                className={flash ? "stat-number stat-flash" : "stat-number"}
              >
                {data?.totalPresent ?? "—"}
              </Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group>
            <IconUser size={32} color="blue" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">
                {strings.totalEmployees}
              </Text>
              <Text className="stat-number">
                {data?.totalEmployees ?? "—"}
              </Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group>
            <IconUserStar size={32} color="var(--mantine-color-warning-6)" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">
                {strings.totalVisitors}
              </Text>
              <Text className="stat-number">
                {data?.totalVisitors ?? "—"}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Operations strip: where people are right now, one card per floor
          WITH people. Hidden when that is a single floor — a plain staffer
          or a ketua lantai sees only their own floor here, and that number
          is already the headline stat card above. */}
      {!isLoading && floorCounts.length > 1 && (
        <div>
          <Text
            size="xs"
            fw={600}
            tt="uppercase"
            c="var(--app-text-secondary)"
            mb={6}
          >
            {strings.byFloorPresent}
          </Text>
          <SimpleGrid
            cols={{ base: 2, sm: 3, lg: Math.min(floorCounts.length, 6) }}
            spacing="sm"
          >
            {floorCounts.map((floor) => (
              <Paper
                key={floor._id}
                p="sm"
                radius="md"
                withBorder
                style={{ borderLeft: `4px solid ${floorColor(floor.hue ?? floor._id)}` }}
              >
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>
                    {floor.name}
                  </Text>
                  <Text
                    className="stat-number"
                    style={{ fontSize: "1.5rem" }}
                    c={floor.count === 0 ? "var(--app-text-secondary)" : undefined}
                  >
                    {floor.count}
                  </Text>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </div>
      )}

      {/* Two-way activity: who just arrived, who just left */}
      {(recent.length > 0 || recentOut.length > 0) && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {recent.length > 0 && (
            <Paper p="md" radius="md" withBorder>
              <Text fw={700} size="sm" mb="xs">
                {strings.recentCheckIns}
              </Text>
              <Stack gap={8}>
                {recent.map((record) =>
                  feedRow(record, record.checkedInAt, record._id)
                )}
              </Stack>
            </Paper>
          )}
          {recentOut.length > 0 && (
            <Paper p="md" radius="md" withBorder>
              <Text fw={700} size="sm" mb="xs">
                {strings.recentCheckOuts}
              </Text>
              <Stack gap={8}>
                {recentOut.map((record) =>
                  feedRow(
                    record,
                    record.checkedOutAt ?? record.checkedInAt,
                    record._id
                  )
                )}
              </Stack>
            </Paper>
          )}
        </SimpleGrid>
      )}

      {/* Self checkout button */}
      {data?.attendance?.some(
        (r) => r.type === "employee" && r.userId?._id === session?.user?.id
      ) && (
        <Paper p="md" radius="md" withBorder style={{ borderColor: "var(--mantine-color-orange-4)" }}>
          <Group justify="space-between">
            <div>
              <Text fw={600} size="sm">
                {strings.checkedInAtFloor}{" "}
                <Text span c="brandPrimary" fw={700}>
                  {data.attendance.find(
                    (r) => r.type === "employee" && r.userId?._id === session?.user?.id
                  )?.floorId?.name}
                </Text>
              </Text>
              <Text size="xs" c="var(--app-text-secondary)">
                {strings.pressButtonToCheckOut}
              </Text>
            </div>
            <Button
              color="warning"
              variant="filled"
              leftSection={<IconDoorExit size={18} />}
              onClick={handleSelfCheckout}
            >
              {strings.checkOut}
            </Button>
          </Group>
        </Paper>
      )}

      {/* Filters */}
      <Group>
        <TextInput
          placeholder={strings.search}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder={strings.allFloors}
          data={[
            { value: "", label: strings.allFloors },
            ...(floors?.map((f) => ({
              value: f._id,
              label: f.name,
            })) || []),
          ]}
          value={floorFilter}
          onChange={setFloorFilter}
          clearable
          w={200}
        />
      </Group>

      {/* Presence Table */}
      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={rows.length === 0}
        empty={
          <Stack align="center" gap="xs" py="md">
            <IconBuilding
              size={40}
              stroke={1.5}
              color="var(--app-text-secondary)"
              aria-hidden
            />
            <Text fw={600}>{strings.noOnePresent}</Text>
            <Text size="xs" c="var(--app-text-secondary)" ta="center">
              {strings.dashboardEmptyHint}
            </Text>
          </Stack>
        }
        minWidth={600}
      >
        <Table.Thead>
                <Table.Tr>
                  <Table.Th>{strings.name}</Table.Th>
                  <Table.Th>{strings.floors}</Table.Th>
                  <Table.Th>{strings.role}</Table.Th>
                  <Table.Th>{strings.checkIn}</Table.Th>
                  {canForceCheckout && (
                    <Table.Th>{strings.actions}</Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((record) => (
                  <Table.Tr key={record._id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Avatar
                          size="sm"
                          radius="xl"
                          color="brandPrimary"
                          aria-hidden
                        >
                          {(record.type === "employee"
                            ? record.userId?.name
                            : record.visitorName
                          )?.charAt(0).toUpperCase() || "?"}
                        </Avatar>
                        <Text fw={500}>
                          {record.type === "employee"
                            ? record.userId?.name
                            : record.visitorName}
                        </Text>
                        {record.type === "visitor" && (
                          <Badge size="xs" color="warning">
                            {strings.visitor}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{record.floorId?.name}</Table.Td>
                    <Table.Td>
                      {record.type === "employee" ? (
                        <Badge size="xs" variant="light">
                          {record.userId?.role
                            ? ROLE_LABELS[
                                record.userId.role as keyof typeof ROLE_LABELS
                              ] ?? record.userId.role
                            : "—"}
                        </Badge>
                      ) : (
                        <Text size="sm" c="var(--app-text-secondary)">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(record.checkedInAt).toLocaleString("ms-MY", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </Table.Td>
                    {canForceCheckout && (
                      <Table.Td>
                        <ActionIcon
                          color="danger"
                          variant="subtle"
                          onClick={() => handleForceCheckout(record._id)}
                          title={strings.forceCheckout}
                        >
                          <IconLogout size={16} />
                        </ActionIcon>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
      </DataTable>

      {data && (
        <Group justify="space-between" gap="sm">
          <Text size="xs" c="var(--app-text-secondary)">
            {data.total === 0
              ? strings.recordsCount(0)
              : strings.showingRange(
                  (data.page - 1) * data.pageSize + 1,
                  Math.min(data.page * data.pageSize, data.total),
                  data.total
                )}
          </Text>
          {pageCount > 1 && (
            <Pagination
              total={pageCount}
              value={data.page}
              onChange={setPage}
              size="sm"
            />
          )}
        </Group>
      )}

      {data?.lastUpdated && (
        <Text size="xs" c="var(--app-text-secondary)" ta="right">
          {strings.lastUpdated}:{" "}
          {new Date(data.lastUpdated).toLocaleString("ms-MY", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
      )}
    </Stack>
  );
}