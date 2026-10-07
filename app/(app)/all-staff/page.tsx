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
import { useAccess } from "@/components/shell/useAccess";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ROLE_LABELS } from "@/lib/db/types";
import { useMemo, useState } from "react";
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

  const { data: usersData, error, isLoading, mutate } = useSWR<{
    users: StaffUser[];
    total: number;
  }>(`/api/users?${queryParams.toString()}`, fetcher);

  const { data: attendanceData } = useSWR<{ attendance: ActiveAttendance[] }>(
    "/api/attendance?active=true",
    fetcher,
    { refreshInterval: 25000 }
  );

  // Derived: memoised — two collections used to be rebuilt on every render
  // (each 25s poll and every role-filter change)
  const userLocations = useMemo<UserLocation[]>(() => {
    const attendanceMap = new Map<string, { floorName: string; checkedInAt: string }>();
    (attendanceData?.attendance ?? []).forEach((record) => {
      if (record.type === "employee" && record.userId?._id) {
        attendanceMap.set(record.userId._id, {
          floorName: record.floorId?.name || "-",
          checkedInAt: record.checkedInAt,
        });
      }
    });

    return (usersData?.users ?? []).map((user) => ({
      _id: user._id,
      name: user.name,
      role: user.role,
      currentFloor: attendanceMap.get(user._id)?.floorName,
      checkedInAt: attendanceMap.get(user._id)?.checkedInAt,
    }));
  }, [attendanceData?.attendance, usersData?.users]);

  const access = useAccess([
    "locations:track_all",
    "locations:track_department",
    "locations:track_own_unit",
  ]);
  if (!session?.user) return <LoadingScreen />;
  if (access) return access;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.allStaffLocations}
        actions={
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => mutate()}
            loading={isLoading}
          >
            {strings.refresh}
          </Button>
        }
      />

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

      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!userLocations.length}
        empty={strings.noDataAvailable}
        minWidth={700}
      >
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
                        <Badge size="xs" color="success" leftSection={<IconMapPin size={12} />}>
                          {user.currentFloor}
                        </Badge>
                      ) : (
                        <Text size="sm" c="var(--app-text-secondary)">—</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
      </DataTable>
    </Stack>
  );
}