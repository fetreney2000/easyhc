"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Title,
  SimpleGrid,
  Paper,
  Text,
  Group,
  Badge,
  Table,
  ActionIcon,
  Loader,
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
  IconUsersGroup,
  IconRefresh,
  IconLogout,
  IconSearch,
  IconDoorExit,
} from "@tabler/icons-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
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
  method: string;
}

interface DashboardData {
  attendance: PresenceRecord[];
  totalEmployees: number;
  totalVisitors: number;
  totalPresent: number;
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

  // Fetch floors for filter
  const { data: floors } = useSWR<{ _id: string; name: string }[]>(
    "/api/floors",
    fetcher
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
            <Button
              component={Link}
              href="/muster"
              leftSection={<IconUsersGroup size={16} />}
            >
              {strings.musterMode}
            </Button>
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
              <Text fw={700} size="xl">
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
              <Text fw={700} size="xl">
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
              <Text fw={700} size="xl">
                {data?.totalVisitors ?? "—"}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

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
        empty={strings.noOnePresent}
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
                          {record.userId?.role}
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