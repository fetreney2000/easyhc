"use client";

import { useState } from "react";
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Text,
  Select,
  Alert,
} from "@mantine/core";
import {
  IconClipboardCheck,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { can } from "@/lib/auth/rbac";
import { LoadingScreen } from "@/components/shell/LoadingScreen";

interface SelectableUser {
  _id: string;
  name: string;
  username: string;
}

export default function ManualCheckInPage() {
  const { data: session } = useSession();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: users } = useSWR<SelectableUser[]>("/api/users", fetcher);
  const { data: floors } = useSWR<{ _id: string; name: string }[]>(
    "/api/floors",
    fetcher
  );

  if (!session?.user) return <LoadingScreen />;

  if (!can(session.user.role, "attendance:manual_checkin")) {
    return (
      <Stack gap="lg">
        <PageHeader title={strings.manualCheckIn} />
        <Alert icon={<IconAlertCircle size={16} />} color="danger">
          {strings.unauthorized}
        </Alert>
      </Stack>
    );
  }

  const handleSubmit = async () => {
    if (!selectedUser || !selectedFloor) return;
    setLoading(true);

    try {
      const res = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          floorId: selectedFloor,
          method: "manual",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.manualCheckInSuccess,
          color: "success",
          icon: <IconCheck size={16} />,
        });
        setSelectedUser(null);
        setSelectedFloor(null);
      } else {
        notifications.show({
          title: strings.error,
          message: data.error || strings.manualCheckInError,
          color: "danger",
        });
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <PageHeader title={strings.manualCheckIn} />

      <Paper p="xl" radius="md" withBorder>
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            {strings.manualCheckInDesc}
          </Alert>

          <Select
            label={strings.selectUser}
            placeholder={strings.selectUser}
            data={
              users?.map((u) => ({
                value: u._id,
                label: `${u.name} (${u.username})`,
              })) || []
            }
            value={selectedUser}
            onChange={setSelectedUser}
            searchable
            required
          />

          <Select
            label={strings.selectFloor}
            placeholder={strings.selectFloor}
            data={
              floors?.map((f) => ({
                value: f._id,
                label: f.name,
              })) || []
            }
            value={selectedFloor}
            onChange={setSelectedFloor}
            searchable
            required
          />

          <Group justify="flex-end">
            <Button
              leftSection={<IconClipboardCheck size={16} />}
              onClick={handleSubmit}
              loading={loading}
              disabled={!selectedUser || !selectedFloor}
            >
              {strings.checkIn}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}