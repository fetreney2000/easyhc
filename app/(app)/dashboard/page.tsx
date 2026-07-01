"use client";

import { useEffect, useState } from "react";
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
} from "@mantine/core";
import {
  IconUsers,
  IconUser,
  IconUserStar,
  IconRefresh,
  IconLogout,
  IconSearch,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { strings } from "@/lib/i18n/strings";
import { can } from "@/lib/auth/rbac";
import { notifications } from "@mantine/notifications";

interface PresenceRecord {
  _id: string;
  type: "employee" | "visitor";
  userId?: {
    _id: string;
    name: string;
    staffId: string;
    role: string;
  };
  visitorName?: string;
  visitorDept?: string;
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
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    `/api/attendance?active=true${floorFilter ? `&floorId=${floorFilter}` : ""}`,
    fetcher,
    {
      refreshInterval: 25000, // 25s polling per spec
      revalidateOnFocus: true,
    }
  );

  // Fetch floors for filter
  const { data: floors } = useSWR<{ _id: string; name: string }[]>(
    "/api/floors",
    fetcher
  );

  const handleForceCheckout = async (attendanceId: string) => {
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
          color: "green",
        });
        mutate();
      } else {
        const errData = await res.json();
        notifications.show({
          title: strings.error,
          message: errData.error || strings.serverError,
          color: "red",
        });
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "red",
      });
    }
  };

  if (!session) return null;

  const canForceCheckout =
    can(session.user.role, "attendance:checkout_all") ||
    can(session.user.role, "attendance:checkout_own_floor") ||
    can(session.user.role, "attendance:checkout_own_unit");

  // Filter by search
  const filteredAttendance =
    data?.attendance?.filter((record) => {
      if (!search) return true;
      const name =
        record.type === "employee"
          ? record.userId?.name || ""
          : record.visitorName || "";
      return name.toLowerCase().includes(search.toLowerCase());
    }) || [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.dashboard}</Title>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => mutate()}
          loading={isLoading}
        >
          {strings.refresh}
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper p="md" radius="md" withBorder>
          <Group>
            <IconUsers size={32} color="var(--mantine-primary-color-filled)" />
            <div>
              <Text size="xs" c="dimmed">
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
              <Text size="xs" c="dimmed">
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
            <IconUserStar size={32} color="orange" />
            <div>
              <Text size="xs" c="dimmed">
                {strings.totalVisitors}
              </Text>
              <Text fw={700} size="xl">
                {data?.totalVisitors ?? "—"}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

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
          placeholder="Semua Lantai"
          data={[
            { value: "", label: "Semua Lantai" },
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
      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : error ? (
          <Center py="xl">
            <Text c="red">{strings.serverError}</Text>
          </Center>
        ) : filteredAttendance.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed">{strings.noOnePresent}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table>
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
                {filteredAttendance.map((record) => (
                  <Table.Tr key={record._id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text fw={500}>
                          {record.type === "employee"
                            ? record.userId?.name
                            : record.visitorName}
                        </Text>
                        {record.type === "visitor" && (
                          <Badge size="xs" color="orange">
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
                        <Text size="sm" c="dimmed">
                          {record.visitorDept}
                        </Text>
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
                          color="red"
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
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {data?.lastUpdated && (
        <Text size="xs" c="dimmed" ta="right">
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