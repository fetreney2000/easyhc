"use client";

import { useEffect, useRef, useState } from "react";
import {
  Title,
  Paper,
  Table,
  Group,
  Stack,
  Text,
  Loader,
  Center,
  Badge,
  ActionIcon,
  Button,
  SimpleGrid,
  TextInput,
  Collapse,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import {
  IconRefresh,
  IconLogout,
  IconSearch,
  IconUsers,
  IconChevronDown,
  IconChevronUp,
  IconBuildingSkyscraper,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/rbac";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { LoadingScreen } from "@/components/shell/LoadingScreen";

interface PresenceRecord {
  _id: string;
  type: "employee" | "visitor";
  userId?: { _id: string; name: string; role: string };
  visitorName?: string;
  floorId: { _id: string; name: string };
  checkedInAt: string;
  method: string;
}

export default function AllFloorsPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const expandedInitialized = useRef(false);

  const { data, error, isLoading, mutate } = useSWR<{
    attendance: PresenceRecord[];
    totalPresent: number;
    totalEmployees: number;
    totalVisitors: number;
    rowCount: number;
    pageSize: number;
  }>("/api/attendance?active=true", fetcher, {
    refreshInterval: 25000,
    revalidateOnFocus: true,
  });

  // Expand every floor once on first load (hooks must run unconditionally,
  // so this lives above the session guard — the old version called useState
  // after an early return, which crashes React when the session arrives).
  useEffect(() => {
    if (expandedInitialized.current) return;
    const rows = data?.attendance ?? [];
    if (rows.length === 0) return;

    const ids = new Set<string>();
    rows.forEach((row) => {
      if (row.floorId?._id) ids.add(row.floorId._id);
    });
    expandedInitialized.current = true;
    setExpandedFloors(ids);
  }, [data]);

  if (!session?.user) return <LoadingScreen />;

  const canForceCheckout =
    can(session.user.role, "attendance:checkout_all") ||
    can(session.user.role, "attendance:checkout_department") ||
    can(session.user.role, "attendance:checkout_own_floor") ||
    can(session.user.role, "attendance:checkout_own_unit");

  /** Destructive: confirm first, and surface failures (it used to swallow them). */
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

  const toggleFloor = (floorId: string) => {
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  };

  // Group attendance by floor
  const attendance = data?.attendance || [];
  const floorGroups = new Map<string, { name: string; records: PresenceRecord[]; employees: number; visitors: number }>();

  attendance
    .filter((r) => {
      if (!search) return true;
      const name = r.type === "employee" ? r.userId?.name || "" : r.visitorName || "";
      return name.toLowerCase().includes(search.toLowerCase());
    })
    .forEach((record) => {
      const floorId = record.floorId?._id;
      const floorName = record.floorId?.name || strings.unknownFloor;
      if (!floorId) return;
      if (!floorGroups.has(floorId)) {
        floorGroups.set(floorId, { name: floorName, records: [], employees: 0, visitors: 0 });
      }
      const group = floorGroups.get(floorId)!;
      group.records.push(record);
      if (record.type === "employee") group.employees++;
      else group.visitors++;
    });

  // Sort floors by name
  const sortedFloors = Array.from(floorGroups.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.allFloors}
        actions={
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => mutate()} loading={isLoading}>
            {strings.refresh}
          </Button>
        }
      />

      {/* Summary cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconBuildingSkyscraper size={20} color="var(--mantine-primary-color-filled)" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">{strings.floors}</Text>
              <Text fw={700}>{floorGroups.size}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconUsers size={20} color="var(--mantine-primary-color-filled)" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">{strings.totalPresent}</Text>
              <Text fw={700}>{data?.totalPresent ?? "—"}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconUsers size={20} color="blue" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">{strings.totalEmployees}</Text>
              <Text fw={700}>{data?.totalEmployees ?? "—"}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconUsers size={20} color="var(--mantine-color-warning-6)" />
            <div>
              <Text size="xs" c="var(--app-text-secondary)">{strings.totalVisitors}</Text>
              <Text fw={700}>{data?.totalVisitors ?? "—"}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Search */}
      <TextInput
        placeholder={strings.searchByName}
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        w={{ base: "100%", sm: 300 }}
      />

      {/* Floor-grouped presence */}
      {isLoading ? (
        <Center py="xl"><Loader /></Center>
      ) : error ? (
        <ErrorState error={error} onRetry={mutate} />
      ) : sortedFloors.length === 0 ? (
        <Center py="xl"><Text c="var(--app-text-secondary)">{strings.noOnePresent}</Text></Center>
      ) : (
        <Stack gap="md">
          {sortedFloors.map(([floorId, group]) => (
            <Paper key={floorId} p="md" radius="md" withBorder>
              {/* Floor header — a real <button> so it is keyboard-operable
                  (WCAG 2.1.1) and announces its state (WCAG 4.1.2). The old
                  version was a Group with onClick: not focusable, and the
                  chevron ActionIcon inside it was a button with no handler. */}
              <UnstyledButton
                onClick={() => toggleFloor(floorId)}
                aria-expanded={expandedFloors.has(floorId)}
                aria-controls={`floor-${floorId}`}
                style={{ width: "100%", display: "block", borderRadius: "var(--mantine-radius-md)" }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" style={{ minWidth: 0 }}>
                    <ThemeIcon size="md" variant="light" color="brandPrimary" aria-hidden>
                      <IconBuildingSkyscraper size={16} />
                    </ThemeIcon>
                    <Text fw={600}>{group.name}</Text>
                    <Badge size="sm" variant="light">
                      {group.employees + group.visitors}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    {group.employees > 0 && (
                      <Badge size="xs" color="blue" variant="light">
                        {strings.countStaff(group.employees)}
                      </Badge>
                    )}
                    {group.visitors > 0 && (
                      <Badge size="xs" color="warning" variant="light">
                        {strings.countVisitors(group.visitors)}
                      </Badge>
                    )}
                    <span
                      aria-hidden
                      style={{ display: "flex", alignItems: "center" }}
                    >
                      {expandedFloors.has(floorId) ? (
                        <IconChevronUp size={16} />
                      ) : (
                        <IconChevronDown size={16} />
                      )}
                    </span>
                  </Group>
                </Group>
              </UnstyledButton>

              {/* Expandable presence table for this floor */}
              <Collapse in={expandedFloors.has(floorId)} id={`floor-${floorId}`}>
                <Table.ScrollContainer minWidth={600}>
                  <Table mt="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{strings.name}</Table.Th>
                      <Table.Th>{strings.typeLabel}</Table.Th>
                      <Table.Th>{strings.checkIn}</Table.Th>
                      {canForceCheckout && <Table.Th>{strings.actions}</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {group.records.map((record) => (
                      <Table.Tr key={record._id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={500}>
                              {record.type === "employee" ? record.userId?.name : record.visitorName}
                            </Text>
                            {record.type === "visitor" && (
                              <Badge size="xs" color="warning">{strings.visitor}</Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {record.type === "employee" ? (
                            <Badge size="xs" variant="light">{record.userId?.role}</Badge>
                          ) : (
                            <Text size="sm" c="var(--app-text-secondary)">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {new Date(record.checkedInAt).toLocaleString("ms-MY", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </Text>
                        </Table.Td>
                        {canForceCheckout && (
                          <Table.Td>
                            <ActionIcon
                              color="danger"
                              variant="subtle"
                              size="sm"
                              onClick={() => handleForceCheckout(record._id)}
                              title={strings.forceCheckout}
                            >
                              <IconLogout size={14} />
                            </ActionIcon>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Collapse>
            </Paper>
          ))}
        </Stack>
      )}

      {data && data.rowCount > data.attendance.length && (
        <Text size="xs" c="var(--app-text-secondary)">
          {strings.showingXofY(data.attendance.length, data.rowCount)}
        </Text>
      )}
    </Stack>
  );
}