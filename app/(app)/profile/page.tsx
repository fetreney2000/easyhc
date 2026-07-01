"use client";

import { useState, useEffect } from "react";
import {
  Title,
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Group,
  Text,
  Divider,
  Avatar,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck, IconKey, IconUser } from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { strings } from "@/lib/i18n/strings";
import { ROLE_LABELS } from "@/lib/db/types";
import { notifications } from "@mantine/notifications";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ProfilePage() {
  const { data: session } = useSession();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const { data: user } = useSWR(
    session?.user?.id ? `/api/users/${session.user.id}` : null,
    fetcher
  );

  const profileForm = useForm({
    initialValues: {
      name: user?.name || "",
      phone: user?.phone || "",
    },
  });

  // Reinitialize form when user data loads
  useEffect(() => {
    if (user) {
      profileForm.setValues({ name: user.name || "", phone: user.phone || "" });
    }
  }, [user]);

  const passwordForm = useForm({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validate: {
      newPassword: (value) =>
        value.length < 6 ? strings.passwordMinLength : null,
      confirmPassword: (value, values) =>
        value !== values.newPassword ? strings.passwordMismatch : null,
    },
  });

  const handleProfileUpdate = async (values: typeof profileForm.values) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.profileUpdated,
          color: "green",
        });
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.profileUpdateError,
          color: "red",
        });
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "red",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (values: typeof passwordForm.values) => {
    setPasswordLoading(true);
    try {
      const res = await fetch(`/api/users/${session?.user?.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.passwordChanged,
          color: "green",
        });
        passwordForm.reset();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.passwordChangeError,
          color: "red",
        });
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "red",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!session) return null;

  return (
    <Stack gap="lg">
      <Title order={2}>{strings.profile}</Title>

      {/* User info card */}
      <Paper p="xl" radius="md" withBorder>
        <Group>
          <Avatar size="xl" radius="xl" color="brandPrimary">
            {session.user.name?.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Text fw={700} size="lg">
              {session.user.name}
            </Text>
            <Text c="dimmed" size="sm">
              @{session.user.username}
            </Text>
            <Badge mt={4} variant="light">
              {ROLE_LABELS[session.user.role]}
            </Badge>
          </div>
        </Group>
      </Paper>

      {/* Edit profile */}
      <Paper p="xl" radius="md" withBorder>
        <Title order={4} mb="md">
          {strings.editProfile}
        </Title>
        <form onSubmit={profileForm.onSubmit(handleProfileUpdate)}>
          <Stack gap="md">
            <TextInput
              label={strings.name}
              {...profileForm.getInputProps("name")}
            />
            <TextInput
              label={strings.phone}
              {...profileForm.getInputProps("phone")}
            />
            <Group justify="flex-end">
              <Button
                type="submit"
                loading={profileLoading}
                leftSection={<IconCheck size={16} />}
              >
                {strings.save}
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      {/* Change password */}
      <Paper p="xl" radius="md" withBorder>
        <Title order={4} mb="md">
          {strings.changePassword}
        </Title>
        <form onSubmit={passwordForm.onSubmit(handlePasswordChange)}>
          <Stack gap="md">
            <PasswordInput
              label={strings.currentPassword}
              {...passwordForm.getInputProps("currentPassword")}
            />
            <PasswordInput
              label={strings.newPassword}
              {...passwordForm.getInputProps("newPassword")}
            />
            <PasswordInput
              label={strings.confirmNewPassword}
              {...passwordForm.getInputProps("confirmPassword")}
            />
            <Group justify="flex-end">
              <Button
                type="submit"
                loading={passwordLoading}
                leftSection={<IconKey size={16} />}
                variant="light"
              >
                {strings.changePassword}
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}