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
  Badge,
  Divider,
} from "@mantine/core";
import { IconPrinter, IconRefresh, IconQrcode, IconUsers, IconUserStar } from "@tabler/icons-react";
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

  const handlePrintSingle = (floor: Floor, type: "employee" | "visitor") => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const label = type === "visitor" ? "PELAWAT / VISITOR" : "KAKITANGAN / STAFF";
    const desc = type === "visitor"
      ? "Imbas menggunakan kamera telefon anda untuk daftar masuk sebagai pelawat"
      : "Imbas menggunakan aplikasi EasyHC untuk daftar masuk";

    printWindow.document.write(`
      <html>
        <head><title>Kod QR ${type === "visitor" ? "Pelawat" : "Kakitangan"} - ${floor.name}</title></head>
        <body style="text-align:center; padding:40px; font-family:'Inter',sans-serif;">
          <h1>${floor.name}</h1>
          <p style="font-size:18px;font-weight:bold;color:${type === "visitor" ? "#e65100" : "#1565c0"};">${label}</p>
          <img src="/api/qr/${floor._id}?type=${type}" style="width:300px;height:300px;" />
          <p style="margin-top:16px;color:#666;">${desc}</p>
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
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => mutate()}
        >
          {strings.refresh}
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Setiap lantai mempunyai 2 jenis kod QR: satu untuk kakitangan (imbas dalam aplikasi) dan satu untuk pelawat (imbas dengan kamera telefon).
      </Text>

      {isLoading ? (
        <Center py="xl"><Loader /></Center>
      ) : !floors?.length ? (
        <Center py="xl">
          <Text c="dimmed">Tiada lantai dikonfigurasi. Sila tambah lantai dahulu.</Text>
        </Center>
      ) : (
        <Stack gap="xl">
          {floors.map((floor) => (
            <Paper key={floor._id} p="lg" radius="md" withBorder>
              <Title order={3} mb="md">{floor.name}</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                {/* Employee QR */}
                <Stack align="center" gap="sm">
                  <Badge color="blue" size="lg" leftSection={<IconUsers size={14} />}>
                    Kakitangan / Staff
                  </Badge>
                  <Image
                    src={`/api/qr/${floor._id}?type=employee`}
                    alt={`Employee QR for ${floor.name}`}
                    width={180}
                    height={180}
                    fit="contain"
                  />
                  <Text size="xs" c="dimmed" ta="center">
                    Imbas dalam aplikasi EasyHC
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    leftSection={<IconPrinter size={14} />}
                    onClick={() => handlePrintSingle(floor, "employee")}
                  >
                    {strings.printQR}
                  </Button>
                </Stack>

                {/* Visitor QR */}
                <Stack align="center" gap="sm">
                  <Badge color="orange" size="lg" leftSection={<IconUserStar size={14} />}>
                    Pelawat / Visitor
                  </Badge>
                  <Image
                    src={`/api/qr/${floor._id}?type=visitor`}
                    alt={`Visitor QR for ${floor.name}`}
                    width={180}
                    height={180}
                    fit="contain"
                  />
                  <Text size="xs" c="dimmed" ta="center">
                    Imbas dengan kamera telefon (URL pelawat)
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    leftSection={<IconPrinter size={14} />}
                    onClick={() => handlePrintSingle(floor, "visitor")}
                  >
                    {strings.printQR}
                  </Button>
                </Stack>
              </SimpleGrid>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}