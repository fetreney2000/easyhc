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
  Image,
  SimpleGrid,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconQrcode,
  IconPrinter,
} from "@tabler/icons-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormModal } from "@/components/ui/FormModal";
import { DataTable } from "@/components/ui/DataTable";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface Floor {
  _id: string;
  name: string;
  qrToken: string;
  createdAt: string;
}

export default function FloorManagementPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [qrModalFloor, setQrModalFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: floors, error, isLoading, mutate } = useSWR<Floor[]>(
    "/api/floors",
    fetcher
  );

  const form = useForm({
    initialValues: { name: "" },
    validate: {
      name: (value) =>
        value.trim().length < 1 ? strings.required : null,
    },
  });

  const handleCreate = () => {
    setEditingFloor(null);
    form.reset();
    setModalOpened(true);
  };

  const handleEdit = (floor: Floor) => {
    setEditingFloor(floor);
    form.setValues({ name: floor.name });
    setModalOpened(true);
  };

  const handleDelete = (floor: Floor) => {
    modals.openConfirmModal({
      title: strings.deleteFloor,
      children: <Text size="sm">{strings.deleteFloorConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        const res = await fetch(`/api/floors/${floor._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: strings.floorDeleted,
            color: "success",
          });
          mutate();
        } else {
          // The API blocks deleting a floor that still has attendance
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

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const url = editingFloor
        ? `/api/floors/${editingFloor._id}`
        : "/api/floors";
      const method = editingFloor ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.floorSaved,
          color: "success",
        });
        setModalOpened(false);
        mutate();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.floorSaveError,
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

  const handleRegenerateQR = (floor: Floor) => {
    modals.openConfirmModal({
      title: strings.regenerateQR,
      children: <Text size="sm">{strings.regenerateQRConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "warning" },
      onConfirm: async () => {
        const res = await fetch(`/api/floors/${floor._id}`, {
          method: "PATCH",
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: strings.qrRegenerated,
            color: "success",
          });
          mutate();
        }
      },
    });
  };

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.floorManagement}
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
              {strings.addFloor}
            </Button>
          </>
        }
      />

      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!floors?.length}
        empty={strings.noDataAvailable}
        minWidth={700}
      >
        <Table.Thead>
              <Table.Tr>
                <Table.Th>{strings.floorName}</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(floors ?? []).map((floor) => (
                <Table.Tr key={floor._id}>
                  <Table.Td>
                    <Text fw={500}>{floor.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => handleEdit(floor)}
                        title={strings.edit}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => setQrModalFloor(floor)}
                        title={strings.qrCodes}
                      >
                        <IconQrcode size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="warning"
                        onClick={() => handleRegenerateQR(floor)}
                        title={strings.regenerateQR}
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="danger"
                        onClick={() => handleDelete(floor)}
                        title={strings.delete}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
      </DataTable>

      {/* Create/Edit modal */}
      <FormModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingFloor ? strings.editFloor : strings.addFloor}
        onSubmit={form.onSubmit(handleSubmit)}
        loading={loading}
      >
        <TextInput
          label={strings.floorName}
          placeholder={strings.floorName}
          required
          {...form.getInputProps("name")}
        />
      </FormModal>

      {/* QR Code modal */}
      <Modal
        opened={!!qrModalFloor}
        onClose={() => setQrModalFloor(null)}
        title={`${strings.qrCodeFor} ${qrModalFloor?.name}`}
        size="md"
      >
        {qrModalFloor && (
          <SimpleGrid cols={2} spacing="md">
            <Stack align="center" gap="xs">
              <Badge color="blue" size="sm">{strings.employee}</Badge>
              <Image
                src={`/api/qr/${qrModalFloor._id}?type=employee`}
                alt={strings.qrEmployeeAlt}
                width={150}
                height={150}
                fit="contain"
              />
              <Button size="xs" variant="light" color="blue" leftSection={<IconPrinter size={14} />}
                onClick={() => window.open(`/api/qr/${qrModalFloor._id}?type=employee`, "_blank")}>
                {strings.printQR}
              </Button>
            </Stack>
            <Stack align="center" gap="xs">
              <Badge color="warning" size="sm">{strings.visitor}</Badge>
              <Image
                src={`/api/qr/${qrModalFloor._id}?type=visitor`}
                alt={strings.qrVisitorAlt}
                width={150}
                height={150}
                fit="contain"
              />
              <Button size="xs" variant="light" color="warning" leftSection={<IconPrinter size={14} />}
                onClick={() => window.open(`/api/qr/${qrModalFloor._id}?type=visitor`, "_blank")}>
                {strings.printQR}
              </Button>
            </Stack>
          </SimpleGrid>
        )}
      </Modal>
    </Stack>
  );
}