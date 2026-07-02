"use client";

import { useState } from "react";
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
import { strings } from "@/lib/i18n/strings";
import { can } from "@/lib/auth/rbac";
import { notifications } from "@mantine/notifications";

interface PresenceRecord {
  _id: string;
  type: "employee" | "visitor";
  userId?: { _id: string; name: string; role: string };
  visitorName?: string;
  floorId: { _id: string; name: string };
  checkedInAt: string;
  method: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AllFloorsPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());

  const { data, isLoading, mutate } = useSWR<{
    attendance: PresenceRecord[];
    totalPresent: number;
    totalEmployees: number;
    totalVisitors: number;
  }>("/api/attendance?active=true", fetcher, {
    refreshInterval: 25000,
    revalidateOnFocus: true,
  });

  if (!session) return null;

  const canForceCheckout =
    can(session.user.role, "attendance:checkout_all") ||
    can(session.user.role, "attendance:checkout_own_floor");

  const handleForceCheckout = async (attendanceId: string) => {
    try {
      const res = await fetch("/api/attendance/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, force: true }),
      });
      if (res.ok) {
        notifications.show({ title: strings.success, message: strings.forceCheckoutSuccess, color: "green" });
        mutate();
      }
    } catch {
      notifications.show({ title: strings.error, message: strings.serverError, color: "red" });
    }
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
      const floorName = record.floorId?.name || "Tidak Diketahui";
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

  // Expand all by default on first load
  useState(() => {
    const allIds = new Set(sortedFloors.map(([id]) => id));
    setExpandedFloors(allIds);
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.allFloors}</Title>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => mutate()} loading={isLoading}>
            {strings.refresh}
          </Button>
        </Group>
      </Group>

      {/* Summary cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconBuildingSkyscraper size={20} color="var(--mantine-primary-color-filled)" />
            <div>
              <Text size="xs" c="dimmed">Lantai</Text>
              <Text fw={700}>{floorGroups.size}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconUsers size={20} color="var(--mantine-primary-color-filled)" />
            <div>
              <Text size="xs" c="dimmed">{strings.totalPresent}</Text>
              <Text fw={700}>{data?.totalPresent ?? "—"}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconUsers size={20} color="blue" />
            <div>
              <Text size="xs" c="dimmed">{strings.totalEmployees}</Text>
              <Text fw={700}>{data?.totalEmployees ?? "—"}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconUsers size={20} color="orange" />
            <div>
              <Text size="xs" c="dimmed">{strings.totalVisitors}</Text>
              <Text fw={700}>{data?.totalVisitors ?? "—"}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Search */}
      <TextInput
        placeholder="Cari mengikut nama..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        w={{ base: "100%", sm: 300 }}
      />

      {/* Floor-grouped presence */}
      {isLoading ? (
        <Center py="xl"><Loader /></Center>
      ) : sortedFloors.length === 0 ? (
        <Center py="xl"><Text c="dimmed">{strings.noOnePresent}</Text></Center>
      ) : (
        <Stack gap="md">
          {sortedFloors.map(([floorId, group]) => (
            <Paper key={floorId} p="md" radius="md" withBorder>
              {/* Floor header - clickable to expand/collapse */}
              <Group
                justify="space-between"
                style={{ cursor: "pointer" }}
                onClick={() => toggleFloor(floorId)}
              >
                <Group gap="sm">
                  <ThemeIcon size="md" variant="light" color="brandPrimary">
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
                      {group.employees} kakitangan
                    </Badge>
                  )}
                  {group.visitors > 0 && (
                    <Badge size="xs" color="orange" variant="light">
                      {group.visitors} pelawat
                    </Badge>
                  )}
                  <ActionIcon variant="subtle" size="sm">
                    {expandedFloors.has(floorId) ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                  </ActionIcon>
                </Group>
              </Group>

              {/* Expandable presence table for this floor */}
              <Collapse in={expandedFloors.has(floorId)}>
                <Table mt="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{strings.name}</Table.Th>
                      <Table.Th>Jenis</Table.Th>
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
                              <Badge size="xs" color="orange">{strings.visitor}</Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {record.type === "employee" ? (
                            <Badge size="xs" variant="light">{record.userId?.role}</Badge>
                          ) : (
                            <Text size="sm" c="dimmed">—</Text>
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
                              color="red"
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
              </Collapse>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}