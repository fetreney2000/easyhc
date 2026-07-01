"use client";

import {
  Title,
  Paper,
  SimpleGrid,
  Group,
  Button,
  Stack,
  Text,
  Loader,
  Center,
  Image,
  ActionIcon,
} from "@mantine/core";
import {
  IconPrinter,
  IconRefresh,
  IconQrcode,
} from "@tabler/icons-react";
import useSWR from "swr";
import { strings } from "@/lib/i18n/strings";

interface Floor {
  _id: string;
  name: string;
  qrToken: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function QRCodesPage() {
  const { data: floors, isLoading, mutate } = useSWR<Floor[]>(
    "/api/floors",
    fetcher
  );

  const handlePrintAll = () => {
    if (!floors?.length) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Kod QR Semua Lantai</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
            .card { text-align: center; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; page-break-inside: avoid; }
            .card h3 { margin-bottom: 12px; }
            .card img { width: 200px; height: 200px; }
            @media print { .grid { grid-template-columns: repeat(2, 1fr); } }
          </style>
        </head>
        <body>
          <h1 style="text-align:center;">Kod QR Lantai</h1>
          <div class="grid">
            ${floors.map((f) => `
              <div class="card">
                <h3>${f.name}</h3>
                <img src="/api/qr/${f._id}" alt="QR ${f.name}" />
              </div>
            `).join("")}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintSingle = (floor: Floor) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>Kod QR - ${floor.name}</title></head>
        <body style="text-align:center; padding:40px; font-family:'Inter',sans-serif;">
          <h1>${floor.name}</h1>
          <img src="/api/qr/${floor._id}" style="width:300px;height:300px;" />
          <p style="margin-top:16px;color:#666;">Imbas kod QR ini untuk daftar masuk</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.qrCodes}</Title>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => mutate()}
          >
            {strings.refresh}
          </Button>
          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrintAll}
            disabled={!floors?.length}
          >
            {strings.printQR} Semua
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : !floors?.length ? (
        <Center py="xl">
          <Text c="dimmed">Tiada lantai dikonfigurasi. Sila tambah lantai dahulu.</Text>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {floors.map((floor) => (
            <Paper key={floor._id} p="lg" radius="md" withBorder>
              <Stack align="center" gap="md">
                <Text fw={700} size="lg">
                  {floor.name}
                </Text>
                <Image
                  src={`/api/qr/${floor._id}`}
                  alt={`QR Code for ${floor.name}`}
                  width={200}
                  height={200}
                  fit="contain"
                />
                <Group>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPrinter size={14} />}
                    onClick={() => handlePrintSingle(floor)}
                  >
                    {strings.printQR}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}