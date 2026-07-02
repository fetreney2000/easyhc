"use client";

import { useState } from "react";
import {
  Title,
  Paper,
  Table,
  Group,
  Button,
  Stack,
  Text,
  Loader,
  Center,
  ActionIcon,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconSearch,
  IconKey,
} from "@tabler/icons-react";
import useSWR from "swr";
import { strings } from "@/lib/i18n/strings";
import { ROLES, ROLE_LABELS } from "@/lib/db/types";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { useSession } from "next-auth/react";
import { can } from "@/lib/auth/rbac";

interface UserRecord {
  _id: string;
  name: string;
  username: string;
  phone?: string;
  role: string;
  jabatanId?: { _id: string; name: string };
  unitId?: { _id: string; name: string };
  status: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function UsersPage() {
  const { data: session } = useSession();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (roleFilter) queryParams.set("role", roleFilter);

  const { data: users, isLoading, mutate } = useSWR<UserRecord[]>(
    `/api/users?${queryParams.toString()}`,
    fetcher
  );

  const { data: jabatans, mutate: mutateJabatans } = useSWR<{ _id: string; name: string }[]>(
    "/api/jabatans",
    fetcher
  );

  const { data: units, mutate: mutateUnits } = useSWR<{ _id: string; name: string }[]>(
    "/api/units",
    fetcher
  );

  // Reload jabatan/unit lists when modal opens
  if (modalOpened) {
    mutateJabatans();
    mutateUnits();
  }

  const form = useForm({
    initialValues: {
      name: "",
      username: "",
      password: "",
      phone: "",
      role: "user" as string,
      jabatanId: "",
      unitId: "",
      status: "active" as string,
    },
  });

  const handleCreate = () => {
    setEditingUser(null);
    form.reset();
    setModalOpened(true);
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    form.setValues({
      name: user.name,
      username: user.username,
      password: "",
      phone: user.phone || "",
      role: user.role,
      jabatanId: user.jabatanId?._id || "",
      unitId: user.unitId?._id || "",
      status: user.status,
    });
    setModalOpened(true);
  };

  const handleDelete = (user: UserRecord) => {
    modals.openConfirmModal({
      title: strings.deleteUser,
      children: (
        <Text size="sm">
          {strings.deleteConfirm} ({user.name})
        </Text>
      ),
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const res = await fetch(`/api/users/${user._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: strings.deleteUserSuccess,
            color: "green",
          });
          mutate();
        } else {
          const data = await res.json();
          notifications.show({
            title: strings.error,
            message: data.error || strings.serverError,
            color: "red",
          });
        }
      },
    });
  };

  const handleResetPassword = (user: UserRecord) => {
    modals.openConfirmModal({
      title: strings.resetPassword,
      children: (
        <Text size="sm">
          {strings.resetPasswordConfirm} ({user.name})
        </Text>
      ),
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      onConfirm: async () => {
        const res = await fetch(`/api/users/${user._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "password123" }),
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: strings.resetPasswordSuccess,
            color: "green",
          });
        }
      },
    });
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const url = editingUser
        ? `/api/users/${editingUser._id}`
        : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      // Don't send empty password on edit
      const body = { ...values };
      if (editingUser && !body.password) {
        delete (body as any).password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.userSaved,
          color: "green",
        });
        setModalOpened(false);
        mutate();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.userSaveError,
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
      setLoading(false);
    }
  };

  if (!session) return null;

  // Filter available roles based on current user's role
  const availableRoles = ROLES.filter((role) => {
    if (session.user.role === "admin") {
      return role !== "superadmin";
    }
    return true;
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.userManagement}</Title>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => mutate()}
          >
            {strings.refresh}
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreate}
          >
            {strings.addUser}
          </Button>
        </Group>
      </Group>

      {/* Filters */}
      <Group>
        <TextInput
          placeholder={strings.searchUsers}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder={strings.allRoles}
          data={[
            { value: "", label: strings.allRoles },
            ...availableRoles.map((r) => ({
              value: r,
              label: ROLE_LABELS[r],
            })),
          ]}
          value={roleFilter}
          onChange={setRoleFilter}
          clearable
          w={200}
        />
      </Group>

      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : !users?.length ? (
          <Center py="xl">
            <Text c="dimmed">{strings.noDataAvailable}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{strings.name}</Table.Th>
                  <Table.Th>{strings.username}</Table.Th>
                  <Table.Th>{strings.role}</Table.Th>
                  <Table.Th>{strings.status}</Table.Th>
                  <Table.Th>{strings.actions}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user._id}>
                    <Table.Td>
                      <Text fw={500}>{user.name}</Text>
                    </Table.Td>
                    <Table.Td>{user.username}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light">
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={user.status === "active" ? "green" : "red"}
                      >
                        {user.status === "active"
                          ? strings.active
                          : strings.inactive}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => handleEdit(user)}
                          title={strings.edit}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="orange"
                          onClick={() => handleResetPassword(user)}
                          title={strings.resetPassword}
                        >
                          <IconKey size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(user)}
                          title={strings.delete}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {/* Create/Edit modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingUser ? strings.editUser : strings.addUser}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label={strings.name}
              required
              {...form.getInputProps("name")}
            />
            <TextInput
              label={strings.username}
              required
              disabled={!!editingUser}
              {...form.getInputProps("username")}
            />
            {!editingUser && (
              <PasswordInput
                label={strings.password}
                required
                {...form.getInputProps("password")}
              />
            )}
            <TextInput
              label={strings.phone}
              {...form.getInputProps("phone")}
            />
            <Select
              label={strings.role}
              required
              data={availableRoles.map((r) => ({
                value: r,
                label: ROLE_LABELS[r],
              }))}
              {...form.getInputProps("role")}
            />
            <Group grow>
            <Select
              label={strings.jabatan}
              placeholder={
                jabatans?.length
                  ? strings.jabatan
                  : "Tiada jabatan tersedia. Sila tambah jabatan dahulu."
              }
              data={
                jabatans?.map((j) => ({
                  value: j._id,
                  label: j.name,
                })) || []
              }
              {...form.getInputProps("jabatanId")}
              clearable
              searchable
              disabled={!jabatans?.length}
            />
            <Select
              label={strings.unit}
              placeholder={
                units?.length
                  ? strings.unit
                  : "Tiada unit tersedia. Sila tambah unit dahulu."
              }
              data={
                units?.map((u) => ({
                  value: u._id,
                  label: u.name,
                })) || []
              }
              {...form.getInputProps("unitId")}
              clearable
              searchable
              disabled={!units?.length}
            />
            </Group>
            <Select
              label={strings.status}
              data={[
                { value: "active", label: strings.active },
                { value: "inactive", label: strings.inactive },
              ]}
              {...form.getInputProps("status")}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                {strings.cancel}
              </Button>
              <Button type="submit" loading={loading}>
                {strings.save}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}