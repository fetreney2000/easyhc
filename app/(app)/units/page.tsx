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
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormModal } from "@/components/ui/FormModal";
import { DataTable } from "@/components/ui/DataTable";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface Unit {
  _id: string;
  name: string;
  // The API returns raw ids; older list responses embedded populated docs
  jabatanId: string | { _id: string; name: string };
  homeFloorId?: string | { _id: string; name: string };
  jabatanName?: string | null;
  homeFloorName?: string | null;
  createdAt?: string;
}

export default function UnitsPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: units, error, isLoading, mutate } = useSWR<Unit[]>("/api/units", fetcher);
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

  const handleEdit = (item: Unit) => {
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
      title: strings.deleteUnit,
      children: <Text size="sm">{strings.deleteUnitConfirm(item.name)}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        const res = await fetch(`/api/units/${item._id}`, { method: "DELETE" });
        if (res.ok) {
          notifications.show({ title: strings.success, message: strings.unitDeleted, color: "success" });
          mutate();
        } else {
          // The API blocks deleting a unit that still has members
          const data = await res.json();
          notifications.show({ title: strings.error, message: data.error || strings.serverError, color: "danger" });
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
        notifications.show({ title: strings.success, message: strings.unitSaved, color: "success" });
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
        title={strings.unit}
        actions={
          <>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => mutate()} loading={isLoading}>
              {strings.refresh}
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
              {strings.addUnit}
            </Button>
          </>
        }
      />

      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!units?.length}
        empty={strings.noUnitsYet}
        minWidth={700}
      >
        <Table.Thead>
              <Table.Tr>
                <Table.Th>{strings.unitName}</Table.Th>
                <Table.Th>{strings.jabatan}</Table.Th>
                <Table.Th>{strings.homeFloor}</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(units ?? []).map((item) => (
                <Table.Tr key={item._id}>
                  <Table.Td><Text fw={500}>{item.name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{item.jabatanName || "—"}</Text></Table.Td>
                  <Table.Td><Text size="sm">{item.homeFloorName || "—"}</Text></Table.Td>
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
        title={editing ? strings.editUnit : strings.addUnit}
        onSubmit={form.onSubmit(handleSubmit)}
        loading={loading}
      >
        <TextInput
          label={strings.unitName}
          placeholder={strings.unitPlaceholder}
          required
          {...form.getInputProps("name")}
        />
        <Select
          label={strings.jabatan}
          placeholder={strings.pickJabatan}
          required
          data={jabatans?.map((j) => ({ value: j._id, label: j.name })) || []}
          {...form.getInputProps("jabatanId")}
          searchable
        />
        <Select
          label={strings.homeFloor}
          placeholder={strings.pickFloorOptional}
          data={floors?.map((f) => ({ value: f._id, label: f.name })) || []}
          {...form.getInputProps("homeFloorId")}
          clearable
          searchable
        />
      </FormModal>
    </Stack>
  );
}