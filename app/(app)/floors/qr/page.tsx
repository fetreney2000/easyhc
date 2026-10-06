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
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";

interface Floor {
  _id: string;
  name: string;
}

export default function QRCodesPage() {
  const { data: floors, error, isLoading, mutate } = useSWR<Floor[]>(
    "/api/floors",
    fetcher
  );

  const handlePrintSingle = (floor: Floor, type: "employee" | "visitor") => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const isVisitor = type === "visitor";
    const label = isVisitor ? strings.qrPrintVisitorLabel : strings.qrPrintStaffLabel;
    const desc = isVisitor
      ? strings.qrPrintVisitorDesc
      : strings.qrPrintStaffDesc;

    // Built with DOM APIs + textContent (never string-interpolated HTML):
    // a floor name containing markup must print as text, not execute.
    const doc = printWindow.document;
    doc.title = `Kod QR ${isVisitor ? strings.visitor : strings.employee} - ${floor.name}`;

    const heading = doc.createElement("h1");
    heading.textContent = floor.name;

    const typeLabel = doc.createElement("p");
    typeLabel.textContent = label;
    typeLabel.style.cssText = `font-size:18px;font-weight:bold;color:${
      isVisitor ? "#e65100" : "#1565c0"
    };`;

    const img = doc.createElement("img");
    img.src = `/api/qr/${encodeURIComponent(floor._id)}?type=${encodeURIComponent(type)}`;
    img.alt = `Kod QR ${floor.name}`;
    img.style.cssText = "width:300px;height:300px;";

    const note = doc.createElement("p");
    note.textContent = desc;
    note.style.cssText = "margin-top:16px;color:#666;";

    doc.body.style.cssText =
      "text-align:center; padding:40px; font-family:'Inter',sans-serif;";
    doc.body.append(heading, typeLabel, img, note);

    // Print once the QR image has actually loaded (with a fallback)
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      printWindow.print();
    };
    img.addEventListener("load", doPrint);
    img.addEventListener("error", doPrint);
    setTimeout(doPrint, 2500);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1} size="h2">{strings.qrCodes}</Title>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => mutate()}
        >
          {strings.refresh}
        </Button>
      </Group>

      <Text size="sm" c="var(--app-text-secondary)">
        {strings.qrIntro}
      </Text>

      {isLoading ? (
        <Center py="xl"><Loader /></Center>
      ) : error ? (
        <ErrorState error={error} onRetry={mutate} />
      ) : !floors?.length ? (
        <Center py="xl">
          <Text c="var(--app-text-secondary)">{strings.noFloorsYet}</Text>
        </Center>
      ) : (
        <Stack gap="xl">
          {floors.map((floor) => (
            <Paper key={floor._id} p="lg" radius="md" withBorder>
              <Title order={2} size="h3" mb="md">{floor.name}</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                {/* Employee QR */}
                <Stack align="center" gap="sm">
                  <Badge color="blue" size="lg" leftSection={<IconUsers size={14} />}>
                    {strings.qrStaffLabel}
                  </Badge>
                  <Image
                    src={`/api/qr/${floor._id}?type=employee`}
                    alt={`Employee QR for ${floor.name}`}
                    width={180}
                    height={180}
                    fit="contain"
                  />
                  <Text size="xs" c="var(--app-text-secondary)" ta="center">
                    {strings.qrStaffScanHint}
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
                    {strings.qrVisitorLabel}
                  </Badge>
                  <Image
                    src={`/api/qr/${floor._id}?type=visitor`}
                    alt={`Visitor QR for ${floor.name}`}
                    width={180}
                    height={180}
                    fit="contain"
                  />
                  <Text size="xs" c="var(--app-text-secondary)" ta="center">
                    {strings.qrVisitorScanHint}
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