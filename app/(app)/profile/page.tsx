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
import { signOut, useSession } from "next-auth/react";
import { strings } from "@/lib/i18n/strings";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { ROLE_LABELS } from "@/lib/db/types";
import { notifications } from "@mantine/notifications";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";

interface ProfileUser {
  _id: string;
  name: string;
  username: string;
  phone?: string;
  role: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const { data: user, error: userError, mutate: mutateUser } =
    useSWR<ProfileUser>(
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
    // profileForm's identity changes on every render; listing it would make
    // this effect loop (setValues → re-render → effect → setValues …)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        passwordForm.reset();
        notifications.show({
          title: strings.success,
          message: `${strings.passwordChanged}. ${strings.reloginRequired}`,
          color: "green",
        });
        // Changing the password bumps sessionVersion, which revokes every
        // session for this user — sign out immediately and explicitly rather
        // than letting the token die silently a few minutes later.
        await signOut({ callbackUrl: "/login" });
        return;
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

  if (!session?.user) return <LoadingScreen />;

  return (
    <Stack gap="lg">
      <Title order={1} size="h2">{strings.profile}</Title>

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
            <Text c="var(--app-text-secondary)" size="sm">
              @{session.user.username}
            </Text>
            <Badge mt={4} variant="light">
              {ROLE_LABELS[session.user.role]}
            </Badge>
          </div>
        </Group>
      </Paper>

      {/* Profile data failed to load — say so instead of showing an empty form */}
      {userError && <ErrorState error={userError} onRetry={mutateUser} />}

      {/* Edit profile */}
      <Paper p="xl" radius="md" withBorder>
        <Title order={2} size="h4" mb="md">
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
        <Title order={2} size="h4" mb="md">
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