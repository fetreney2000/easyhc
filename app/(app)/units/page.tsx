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
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconEdit, IconTrash, IconRefresh } from "@tabler/icons-react";
import useSWR from "swr";
import { strings } from "@/lib/i18n/strings";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface Unit {
  _id: string;
  name: string;
  jabatanId: { _id: string; name: string };
  homeFloorId?: { _id: string; name: string };
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function UnitsPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: units, isLoading, mutate } = useSWR<any[]>("/api/units", fetcher);
  const { data: jabatans } = useSWR<{ _id: string; name: string }[]>("/api/jabatans", fetcher);
  const { data: floors } = useSWR<{ _id: string; name: string }[]>("/api/floors", fetcher);

  const form = useForm({
    initialValues: { name: "", jabatanId: "", homeFloorId: "" },
    validate: {
      name: (v) => (v.trim().length < 1 ? strings.required : null),
      jabatanId: (v) => (!v ? strings.required : null),
    },
  });

  const handleCreate = () => {
    setEditing(null);
    form.reset();
    setModalOpened(true);
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    form.setValues({
      name: item.name,
      jabatanId: typeof item.jabatanId === "object" ? item.jabatanId?._id || "" : item.jabatanId || "",
      homeFloorId: typeof item.homeFloorId === "object" ? item.homeFloorId?._id || "" : item.homeFloorId || "",
    });
    setModalOpened(true);
  };

  const handleDelete = (item: Unit) => {
    modals.openConfirmModal({
      title: "Padam Unit",
      children: <Text size="sm">Anda pasti mahu memadam unit "{item.name}"?</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const res = await fetch(`/api/units/${item._id}`, { method: "DELETE" });
        if (res.ok) {
          notifications.show({ title: strings.success, message: "Unit berjaya dipadam", color: "green" });
          mutate();
        }
      },
    });
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const url = editing ? `/api/units/${editing._id}` : "/api/units";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        notifications.show({ title: strings.success, message: "Unit berjaya disimpan", color: "green" });
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
        <Title order={2}>{strings.unit}</Title>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => mutate()}>
            {strings.refresh}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
            Tambah Unit
          </Button>
        </Group>
      </Group>

      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl"><Loader /></Center>
        ) : !units?.length ? (
          <Center py="xl"><Text c="dimmed">Tiada unit. Sila tambah unit baharu.</Text></Center>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nama Unit</Table.Th>
                <Table.Th>Jabatan</Table.Th>
                <Table.Th>Lantai Asal</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {units.map((item) => (
                <Table.Tr key={item._id}>
                  <Table.Td><Text fw={500}>{item.name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{typeof item.jabatanId === "object" ? item.jabatanId?.name : "—"}</Text></Table.Td>
                  <Table.Td><Text size="sm">{typeof item.homeFloorId === "object" ? item.homeFloorId?.name : "—"}</Text></Table.Td>
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
        title={editing ? "Sunting Unit" : "Tambah Unit"}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nama Unit"
              placeholder="Contoh: Unit Pembangunan Sistem"
              required
              {...form.getInputProps("name")}
            />
            <Select
              label={strings.jabatan}
              placeholder="Pilih jabatan"
              required
              data={jabatans?.map((j) => ({ value: j._id, label: j.name })) || []}
              {...form.getInputProps("jabatanId")}
              searchable
            />
            <Select
              label="Lantai Asal"
              placeholder="Pilih lantai (pilihan)"
              data={floors?.map((f) => ({ value: f._id, label: f.name })) || []}
              {...form.getInputProps("homeFloorId")}
              clearable
              searchable
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