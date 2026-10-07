"use client";

import { useMemo } from "react";
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
import { fetcher } from "@/lib/api/fetcher";
import { useAccess } from "@/components/shell/useAccess";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ROLE_LABELS } from "@/lib/db/types";
import { LoadingScreen } from "@/components/shell/LoadingScreen";

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
  floorId?: { _id: string; name?: string };
  checkedInAt: string;
}

export default function MyUnitPage() {
  const { data: session } = useSession();

  const { data: usersData, error, isLoading, mutate } = useSWR<{
    users: StaffUser[];
    total: number;
  }>(session?.user?.unitId ? `/api/users?unitId=${session.user.unitId}` : null, fetcher);

  const { data: attendanceData } = useSWR<{ attendance: ActiveAttendance[] }>(
    "/api/attendance?active=true",
    fetcher,
    { refreshInterval: 25000 }
  );

  // Derived: memoised — two collections used to be rebuilt on every render
  // (each 25s poll and every mount)
  const userLocations = useMemo(() => {
    const presenceByUser = new Map<string, { floorName: string; checkedInAt: string }>();
    (attendanceData?.attendance ?? []).forEach((record) => {
      if (record.type === "employee" && record.userId?._id) {
        presenceByUser.set(record.userId._id, {
          floorName: record.floorId?.name || "-",
          checkedInAt: record.checkedInAt,
        });
      }
    });

    return (usersData?.users ?? []).map((user) => ({
      ...user,
      currentFloor: presenceByUser.get(user._id)?.floorName,
      checkedInAt: presenceByUser.get(user._id)?.checkedInAt,
    }));
  }, [usersData?.users, attendanceData?.attendance]);

  const access = useAccess(["locations:track_own_unit"]);
  if (access) return access;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.myUnit}
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

      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!userLocations.length}
        empty={strings.noDataAvailable}
        minWidth={600}
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