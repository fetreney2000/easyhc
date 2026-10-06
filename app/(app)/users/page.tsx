"use client";

import { useEffect, useMemo, useState } from "react";
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
  Pagination,
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
import { useDebouncedValue } from "@mantine/hooks";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormModal } from "@/components/ui/FormModal";
import { DataTable } from "@/components/ui/DataTable";
import { ROLES, ROLE_LABELS } from "@/lib/db/types";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { useSession } from "next-auth/react";
import { can } from "@/lib/auth/rbac";
import { LoadingScreen } from "@/components/shell/LoadingScreen";

interface UserRecord {
  _id: string;
  name: string;
  username: string;
  phone?: string;
  jawatanInfo?: string;
  role: string;
  jabatanId?: string | { _id: string; name: string };
  unitId?: string | { _id: string; name: string };
  jabatanName?: string | null;
  unitName?: string | null;
  status: string;
}

// Title case helper: capitalize first letter of every word
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function UsersPage() {
  const { data: session } = useSession();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [search, setSearch] = useState("");
  // Debounced: typing must not fire a request per keystroke
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Memoised: this builds the SWR key, so it only needs rebuilding when the
  // debounced search or the role filter changes (not on every render).
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (roleFilter) params.set("role", roleFilter);
    return params;
  }, [debouncedSearch, roleFilter]);

  const { data: users, error, isLoading, mutate } = useSWR<UserRecord[]>(
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

  // Client-side pagination: the API can return up to 500 users, which is far
  // more than fits on a screen (and cost time to map on mid-range phones).
  const ROWS_PER_PAGE = 25;
  // Must match .limit() in app/api/users/route.ts — surfaced below so a full
  // directory is never mistaken for a truncated one.
  const USER_LIST_LIMIT = 500;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  const totalUsers = users?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalUsers / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * ROWS_PER_PAGE;
  const visibleUsers = users
    ? users.slice(pageStart, pageStart + ROWS_PER_PAGE)
    : [];

  // Refresh jabatan/unit lists when the modal opens. This belongs in an
  // effect: called from the render body it fired on every single render
  // while the modal was open (a request storm).
  useEffect(() => {
    if (modalOpened) {
      mutateJabatans();
      mutateUnits();
    }
  }, [modalOpened, mutateJabatans, mutateUnits]);

  const form = useForm({
    initialValues: {
      name: "",
      username: "",
      password: "",
      phone: "",
      jawatanInfo: "",
      role: "user" as string,
      jabatanId: "",
      unitId: "",
      status: "active" as string,
    },
  });

  // Password-reset modal form (admin resetting someone else's password)
  const resetForm = useForm({
    initialValues: {
      password: "",
      confirmPassword: "",
    },
    validate: {
      password: (value) =>
        value.length < 6 ? strings.passwordMinLength : null,
      confirmPassword: (value, values) =>
        value !== values.password ? strings.passwordMismatch : null,
    },
  });

  const handleCreate = () => {
    setEditingUser(null);
    form.reset();
    setModalOpened(true);
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    const jabatanIdVal = typeof user.jabatanId === "object" ? user.jabatanId?._id || "" : user.jabatanId || "";
    const unitIdVal = typeof user.unitId === "object" ? user.unitId?._id || "" : user.unitId || "";
    form.setValues({
      name: user.name,
      username: user.username,
      password: "",
      phone: user.phone || "",
      jawatanInfo: user.jawatanInfo || "",
      role: user.role,
      jabatanId: jabatanIdVal,
      unitId: unitIdVal,
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
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        const res = await fetch(`/api/users/${user._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: strings.deleteUserSuccess,
            color: "success",
          });
          mutate();
        } else {
          const data = await res.json();
          notifications.show({
            title: strings.error,
            message: data.error || strings.serverError,
            color: "danger",
          });
        }
      },
    });
  };

  const handleResetPassword = (user: UserRecord) => {
    resetForm.reset();
    setResetTarget(user);
  };

  const handleResetSubmit = async (values: typeof resetForm.values) => {
    if (!resetTarget) return;
    setResetLoading(true);

    try {
      const res = await fetch(`/api/users/${resetTarget._id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      const data = await res.json();

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.resetPasswordSuccess,
          color: "success",
        });
        setResetTarget(null);
        mutate();
      } else {
        notifications.show({
          title: strings.error,
          message: data.error || strings.serverError,
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
      setResetLoading(false);
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const url = editingUser
        ? `/api/users/${editingUser._id}`
        : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      // Don't send an empty password on edit (Partial so it can be dropped)
      const body: Partial<typeof values> = { ...values };
      if (editingUser && !body.password) {
        delete body.password;
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
          color: "success",
        });
        setModalOpened(false);
        mutate();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.userSaveError,
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

  if (!session?.user) return <LoadingScreen />;

  // Only roles this actor may assign: an admin has no users:manage_admin,
  // so offering "admin" in the dropdown always ended in a 403.
  const availableRoles = ROLES.filter((role) => {
    if (session.user.role === "admin") {
      return role !== "superadmin" && role !== "admin";
    }
    return true;
  });

  // Rows this actor may actually edit / reset / delete — mirrors the API
  // rules, so unreachable buttons are never rendered.
  const canManage = (target: UserRecord) =>
    session.user.role === "superadmin" ||
    (target.role !== "admin" && target.role !== "superadmin");

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.userManagement}
        actions={
          <>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => mutate()}
              loading={isLoading}
            >
              {strings.refresh}
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
              {strings.addUser}
            </Button>
          </>
        }
      />

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

      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!users?.length}
        empty={strings.noDataAvailable}
        minWidth={800}
      >
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
                {visibleUsers.map((user) => (
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
                      {canManage(user) ? (
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
                            color="warning"
                            onClick={() => handleResetPassword(user)}
                            title={strings.resetPassword}
                          >
                            <IconKey size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="danger"
                            onClick={() => handleDelete(user)}
                            title={strings.delete}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      ) : (
                        <Text size="sm" c="var(--app-text-secondary)">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
      </DataTable>

      {users && users.length > 0 && (
        <Group justify="space-between" gap="sm">
          <Text size="xs" c="var(--app-text-secondary)">
            {strings.showingRange(
              pageStart + 1,
              Math.min(pageStart + ROWS_PER_PAGE, totalUsers),
              totalUsers
            )}
          </Text>
          {pageCount > 1 && (
            <Pagination
              total={pageCount}
              value={currentPage}
              onChange={setPage}
              size="sm"
            />
          )}
        </Group>
      )}

      {/* The API caps this list (USER_LIST_LIMIT) — say so instead of
          letting a truncated directory look complete */}
      {users && users.length >= USER_LIST_LIMIT && (
        <Text size="xs" c="var(--app-text-secondary)">
          {strings.usersTruncated(USER_LIST_LIMIT)}
        </Text>
      )}

      {/* Create/Edit modal */}
      <FormModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingUser ? strings.editUser : strings.addUser}
        size="lg"
        onSubmit={form.onSubmit(handleSubmit)}
        loading={loading}
      >
            <TextInput
              label={strings.name}
              required
              placeholder={strings.namePlaceholder}
              {...form.getInputProps("name")}
              onBlur={(e) => {
                const titleCaseValue = toTitleCase(e.target.value);
                form.setFieldValue("name", titleCaseValue);
              }}
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
              placeholder={strings.phone}
              {...form.getInputProps("phone")}
            />
            <TextInput
              label={strings.jawatanInfo}
              placeholder={strings.jawatanInfoPlaceholder}
              {...form.getInputProps("jawatanInfo")}
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
                  : strings.noJabatanAvailable
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
                  : strings.noUnitAvailable
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
      </FormModal>

      {/* Reset password modal */}
      <Modal
        opened={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={
          <Group gap="xs">
            <IconKey size={18} />
            <span>{strings.resetPassword}</span>
          </Group>
        }
        size="sm"
      >
        <form onSubmit={resetForm.onSubmit(handleResetSubmit)}>
          <Stack gap="md">
            <Text size="sm" fw={500}>
              {resetTarget?.name} (@{resetTarget?.username})
            </Text>
            <Text size="xs" c="var(--app-text-secondary)">
              {strings.resetPasswordConfirm}
            </Text>
            <PasswordInput
              label={strings.newPassword}
              required
              autoFocus
              {...resetForm.getInputProps("password")}
            />
            <PasswordInput
              label={strings.confirmNewPassword}
              required
              {...resetForm.getInputProps("confirmPassword")}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setResetTarget(null)}>
                {strings.cancel}
              </Button>
              <Button
                type="submit"
                color="warning"
                loading={resetLoading}
                leftSection={<IconKey size={16} />}
              >
                {strings.resetPassword}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}