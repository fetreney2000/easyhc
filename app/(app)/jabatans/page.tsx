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
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconEdit, IconTrash, IconRefresh } from "@tabler/icons-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormModal } from "@/components/ui/FormModal";
import { DataTable } from "@/components/ui/DataTable";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface Jabatan {
  _id: string;
  name: string;
  createdAt: string;
}

export default function JabatansPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<Jabatan | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: jabatans, error, isLoading, mutate } = useSWR<Jabatan[]>(
    "/api/jabatans",
    fetcher
  );

  const form = useForm({
    initialValues: { name: "" },
    validate: { name: (v) => (v.trim().length < 1 ? strings.required : null) },
  });

  const handleCreate = () => {
    setEditing(null);
    form.reset();
    setModalOpened(true);
  };

  const handleEdit = (item: Jabatan) => {
    setEditing(item);
    form.setValues({ name: item.name });
    setModalOpened(true);
  };

  const handleDelete = (item: Jabatan) => {
    modals.openConfirmModal({
      title: strings.deleteJabatan,
      children: <Text size="sm">{strings.deleteJabatanConfirm(item.name)}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        const res = await fetch(`/api/jabatans/${item._id}`, { method: "DELETE" });
        if (res.ok) {
          notifications.show({ title: strings.success, message: strings.jabatanDeleted, color: "success" });
          mutate();
        } else {
          // The API blocks deleting a jabatan that is still referenced
          const data = await res.json();
          notifications.show({ title: strings.error, message: data.error || strings.serverError, color: "danger" });
        }
      },
    });
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const url = editing ? `/api/jabatans/${editing._id}` : "/api/jabatans";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        notifications.show({ title: strings.success, message: strings.jabatanSaved, color: "success" });
        setModalOpened(false);
        mutate();
      } else {
        const data = await res.json();
        notifications.show({ title: strings.error, message: data.error || strings.serverError, color: "danger" });
      }
    } catch {
      notifications.show({ title: strings.error, message: strings.serverError, color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.jabatan}
        actions={
          <>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => mutate()} loading={isLoading}>
              {strings.refresh}
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
              {strings.addJabatan}
            </Button>
          </>
        }
      />

      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!jabatans?.length}
        empty={strings.noJabatansYet}
        minWidth={700}
      >
        <Table.Thead>
              <Table.Tr>
                <Table.Th>{strings.jabatanName}</Table.Th>
                <Table.Th>{strings.createdAt}</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(jabatans ?? []).map((item) => (
                <Table.Tr key={item._id}>
                  <Table.Td><Text fw={500}>{item.name}</Text></Table.Td>
                  <Table.Td>
                    <Text size="sm" c="var(--app-text-secondary)">
                      {new Date(item.createdAt).toLocaleDateString("ms-MY")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" onClick={() => handleEdit(item)} title={strings.edit}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="danger" onClick={() => handleDelete(item)} title={strings.delete}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
      </DataTable>

      <FormModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? strings.editJabatan : strings.addJabatan}
        onSubmit={form.onSubmit(handleSubmit)}
        loading={loading}
      >
        <TextInput
          label={strings.jabatanName}
          placeholder={strings.jabatanPlaceholder}
          required
          {...form.getInputProps("name")}
        />
      </FormModal>
    </Stack>
  );
}