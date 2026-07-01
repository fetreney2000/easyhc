"use client";

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
  Button,
} from "@mantine/core";
import { IconRefresh, IconMapPin } from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { strings } from "@/lib/i18n/strings";
import { ROLE_LABELS } from "@/lib/db/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MyUnitPage() {
  const { data: session } = useSession();

  const { data: users, isLoading } = useSWR<any[]>(
    session?.user?.unitId ? `/api/users?unitId=${session.user.unitId}` : null,
    fetcher
  );

  const { data: attendanceData } = useSWR<{ attendance: any[] }>(
    "/api/attendance?active=true",
    fetcher,
    { refreshInterval: 25000 }
  );

  if (!session) return null;

  const attendanceMap = new Map<string, { floorName: string; checkedInAt: string }>();
  (attendanceData?.attendance || []).forEach((record) => {
    if (record.type === "employee" && record.userId?._id) {
      attendanceMap.set(record.userId._id, {
        floorName: record.floorId?.name || "-",
        checkedInAt: record.checkedInAt,
      });
    }
  });

  const userLocations = (Array.isArray(users) ? users : []).map((user) => ({
    ...user,
    currentFloor: attendanceMap.get(user._id)?.floorName,
    checkedInAt: attendanceMap.get(user._id)?.checkedInAt,
  }));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.myUnit}</Title>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => {}}>
          {strings.refresh}
        </Button>
      </Group>

      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl"><Loader /></Center>
        ) : !userLocations.length ? (
          <Center py="xl"><Text c="dimmed">{strings.noDataAvailable}</Text></Center>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{strings.name}</Table.Th>
                <Table.Th>{strings.role}</Table.Th>
                <Table.Th>Lokasi Semasa</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {userLocations.map((user: any) => (
                <Table.Tr key={user._id}>
                  <Table.Td><Text fw={500}>{user.name}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light">
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {user.currentFloor ? (
                      <Badge size="xs" color="green" leftSection={<IconMapPin size={12} />}>
                        {user.currentFloor}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}