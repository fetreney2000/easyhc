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
import { strings } from "@/lib/i18n/strings";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";

interface Floor {
  _id: string;
  name: string;
  qrToken: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function FloorManagementPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [qrModalFloor, setQrModalFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: floors, isLoading, mutate } = useSWR<Floor[]>(
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
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const res = await fetch(`/api/floors/${floor._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: strings.floorDeleted,
            color: "green",
          });
          mutate();
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
          color: "green",
        });
        setModalOpened(false);
        mutate();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.floorSaveError,
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

  const handleRegenerateQR = (floor: Floor) => {
    modals.openConfirmModal({
      title: strings.regenerateQR,
      children: <Text size="sm">{strings.regenerateQRConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "orange" },
      onConfirm: async () => {
        const res = await fetch(`/api/floors/${floor._id}`, {
          method: "PATCH",
        });
        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: "Kod QR berjaya dijana semula",
            color: "green",
          });
          mutate();
        }
      },
    });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.floorManagement}</Title>
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
            {strings.addFloor}
          </Button>
        </Group>
      </Group>

      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : !floors?.length ? (
          <Center py="xl">
            <Text c="dimmed">{strings.noDataAvailable}</Text>
          </Center>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{strings.floorName}</Table.Th>
                <Table.Th>{strings.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {floors.map((floor) => (
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
                        color="orange"
                        onClick={() => handleRegenerateQR(floor)}
                        title={strings.regenerateQR}
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
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
          </Table>
        )}
      </Paper>

      {/* Create/Edit modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingFloor ? strings.editFloor : strings.addFloor}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label={strings.floorName}
              placeholder={strings.floorName}
              required
              {...form.getInputProps("name")}
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

      {/* QR Code modal */}
      <Modal
        opened={!!qrModalFloor}
        onClose={() => setQrModalFloor(null)}
        title={`${strings.qrCodeFor} ${qrModalFloor?.name}`}
        size="sm"
      >
        {qrModalFloor && (
          <Stack align="center" gap="md">
            <Image
              src={`/api/qr/${qrModalFloor._id}`}
              alt={`QR Code for ${qrModalFloor.name}`}
              width={250}
              height={250}
            />
            <Group>
              <Button
                variant="light"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head><title>${strings.printQR} - ${qrModalFloor.name}</title></head>
                        <body style="text-align:center; padding:20px;">
                          <h2>${qrModalFloor.name}</h2>
                          <img src="/api/qr/${qrModalFloor._id}" style="width:300px;height:300px;" />
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
              >
                {strings.printQR}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}