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
  Select,
} from "@mantine/core";
import { IconRefresh, IconMapPin } from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { strings } from "@/lib/i18n/strings";
import { ROLE_LABELS } from "@/lib/db/types";
import { useState } from "react";
import { LoadingScreen } from "@/components/shell/LoadingScreen";

interface UserLocation {
  _id: string;
  name: string;
  role: string;
  currentFloor?: string;
  checkedInAt?: string;
}

interface StaffUser {
  _id: string;
  name: string;
  role: string;
  username?: string;
}

interface ActiveAttendance {
  _id: string;
  type: "employee" | "visitor";
  userId?: { _id: string; name?: string };
  visitorName?: string;
  floorId?: { _id: string; name?: string };
  checkedInAt: string;
}

export default function AllStaffPage() {
  const { data: session } = useSession();
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (roleFilter) queryParams.set("role", roleFilter);

  const { data: users, isLoading } = useSWR<StaffUser[]>(
    `/api/users?${queryParams.toString()}`,
    fetcher
  );

  const { data: attendanceData } = useSWR<{ attendance: ActiveAttendance[] }>(
    "/api/attendance?active=true",
    fetcher,
    { refreshInterval: 25000 }
  );

  if (!session?.user) return <LoadingScreen />;

  // Map users to their current location
  const attendanceMap = new Map<string, { floorName: string; checkedInAt: string }>();
  (attendanceData?.attendance || []).forEach((record) => {
    if (record.type === "employee" && record.userId?._id) {
      attendanceMap.set(record.userId._id, {
        floorName: record.floorId?.name || "-",
        checkedInAt: record.checkedInAt,
      });
    }
  });

  const userLocations: UserLocation[] = (Array.isArray(users) ? users : []).map((user) => ({
    _id: user._id,
    name: user.name,
    role: user.role,
    currentFloor: attendanceMap.get(user._id)?.floorName,
    checkedInAt: attendanceMap.get(user._id)?.checkedInAt,
  }));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.allStaffLocations}</Title>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => {}}>
          {strings.refresh}
        </Button>
      </Group>

      <Group>
        <Select
          placeholder={strings.allRoles}
          data={[
            { value: "", label: strings.allRoles },
            ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={roleFilter}
          onChange={setRoleFilter}
          clearable
          w={200}
        />
      </Group>

      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl"><Loader /></Center>
        ) : !userLocations.length ? (
          <Center py="xl"><Text c="dimmed">{strings.noDataAvailable}</Text></Center>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{strings.name}</Table.Th>
                  <Table.Th>{strings.role}</Table.Th>
                  <Table.Th>{strings.currentLocation}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {userLocations.map((user) => (
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
          </Table.ScrollContainer>
        )}
      </Paper>
    </Stack>
  );
}