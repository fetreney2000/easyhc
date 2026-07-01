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
import { strings } from "@/lib/i18n/strings";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface Jabatan {
  _id: string;
  name: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function JabatansPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<Jabatan | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: jabatans, isLoading, mutate } = useSWR<Jabatan[]>(
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
      title: "Padam Jabatan",
      children: <Text size="sm">Anda pasti mahu memadam jabatan "{item.name}"?</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const res = await fetch(`/api/jabatans/${item._id}`, { method: "DELETE" });
        if (res.ok) {
          notifications.show({ title: strings.success, message: "Jabatan berjaya dipadam", color: "green" });
          mutate();
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
        notifications.show({ title: strings.success, message: "Jabatan berjaya disimpan", color: "green" });
        setModalOpened(false);
        mutate();
      } else {
        const data = await res.json();
        notifications.show({ title: strings.error, message: data.error || strings.serverError, color: "red" });
      }
    } catch {
      notifications.show({ title: strings.error, message: strings.serverError, color: "red" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.jabatan}</Title>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => mutate()}>
            {strings.refresh}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
            Tambah Jabatan
          </Button>
        </Group>
      </Group>

      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl"><Loader /></Center>
        ) : !jabatans?.length ? (
          <Center py="xl"><Text c="dimmed">Tiada jabatan. Sila tambah jabatan baharu.</Text></Center>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nama Jabatan</Table.Th>
                <Table.Th>Tarikh Dicipta</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jabatans.map((item) => (
                <Table.Tr key={item._id}>
                  <Table.Td><Text fw={500}>{item.name}</Text></Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {new Date(item.createdAt).toLocaleDateString("ms-MY")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" onClick={() => handleEdit(item)} title={strings.edit}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)} title={strings.delete}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? "Sunting Jabatan" : "Tambah Jabatan"}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nama Jabatan"
              placeholder="Contoh: Jabatan Teknologi Maklumat"
              required
              {...form.getInputProps("name")}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>{strings.cancel}</Button>
              <Button type="submit" loading={loading}>{strings.save}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}