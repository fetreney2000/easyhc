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
  Select,
  ActionIcon,
  Button,
} from "@mantine/core";
import {
  IconRefresh,
  IconLogout,
  IconSearch,
  IconUsers,
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AllFloorsPage() {
  const { data: session } = useSession();
  const [floorFilter, setFloorFilter] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  queryParams.set("active", "true");
  if (floorFilter) queryParams.set("floorId", floorFilter);

  const { data, isLoading, mutate } = useSWR<{
    attendance: PresenceRecord[];
    totalPresent: number;
    totalEmployees: number;
    totalVisitors: number;
  }>(`/api/attendance?${queryParams.toString()}`, fetcher, {
    refreshInterval: 25000,
    revalidateOnFocus: true,
  });

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
    can(session.user.role, "attendance:checkout_own_floor");

  // Group by floor for summary
  const floorSummary = new Map<
    string,
    { name: string; count: number }
  >();
  (data?.attendance || []).forEach((record) => {
    const floorName = record.floorId?.name || "Unknown";
    const floorId = record.floorId?._id;
    if (floorId) {
      const existing = floorSummary.get(floorId);
      if (existing) {
        existing.count++;
      } else {
        floorSummary.set(floorId, { name: floorName, count: 1 });
      }
    }
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.allFloors}</Title>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => mutate()}
          loading={isLoading}
        >
          {strings.refresh}
        </Button>
      </Group>

      {/* Floor summary cards */}
      <Group>
        {Array.from(floorSummary.entries()).map(([floorId, info]) => (
          <Paper
            key={floorId}
            p="md"
            radius="md"
            withBorder
            style={{ cursor: "pointer", minWidth: 150 }}
            onClick={() =>
              setFloorFilter(floorFilter === floorId ? null : floorId)
            }
          >
            <Group>
              <IconUsers size={20} />
              <div>
                <Text size="xs" c="dimmed">
                  {info.name}
                </Text>
                <Text fw={700}>{info.count}</Text>
              </div>
            </Group>
          </Paper>
        ))}
        {floorSummary.size === 0 && !isLoading && (
          <Text c="dimmed">{strings.noOnePresent}</Text>
        )}
      </Group>

      {/* Floor filter */}
      <Group>
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
          w={250}
        />
        <Text size="sm" c="dimmed">
          {data?.totalPresent ?? 0} {strings.totalPresent.toLowerCase()}
        </Text>
      </Group>

      {/* Presence table */}
      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : !data?.attendance?.length ? (
          <Center py="xl">
            <Text c="dimmed">{strings.noOnePresent}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={700}>
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
                {data.attendance.map((record) => (
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
    </Stack>
  );
}