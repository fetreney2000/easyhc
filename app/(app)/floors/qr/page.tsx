"use client";

import { useEffect, useState } from "react";
import {
  Title,
  Paper,
  SimpleGrid,
  Group,
  Button,
  Stack,
  Text,
  Skeleton,
  Center,
  Image,
  Badge,
  Divider,
} from "@mantine/core";
import { IconPrinter, IconRefresh, IconQrcode, IconUsers, IconUserStar } from "@tabler/icons-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api/fetcher";
import { useAccess } from "@/components/shell/useAccess";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { floorColor } from "@/lib/format";
import { BRAND_BLUE, openPoster } from "@/lib/print";
import { PageHeader } from "@/components/ui/PageHeader";

interface Floor {
  _id: string;
  name: string;
  hue?: number;
}

export default function QRCodesPage() {
  const { data: floors, error, isLoading, mutate } = useSWR<Floor[]>(
    "/api/floors",
    fetcher
  );

  // Set after mount: SSR must not guess a host it doesn't have (hydration
  // mismatch), and the printed text must show EXACTLY what the QR encodes
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handlePrintSingle = (floor: Floor, type: "employee" | "visitor") => {
    const isVisitor = type === "visitor";
    const label = isVisitor ? strings.qrPrintVisitorLabel : strings.qrPrintStaffLabel;
    const desc = isVisitor
      ? strings.qrPrintVisitorDesc
      : strings.qrPrintStaffDesc;

    // The floor's identity colour — the same hue as the dashboard strip,
    // the floors page and the evacuation display (visual refresh stage 3)
    const poster = openPoster(
      `Kod QR ${isVisitor ? strings.visitor : strings.employee} - ${floor.name}`,
      floorColor(floor.hue ?? floor._id)
    );
    if (!poster) return;
    const { doc, main, printWhenReady } = poster;

    const heading = doc.createElement("h1");
    heading.textContent = floor.name;
    heading.style.cssText = "font-size:32px;font-weight:800;margin:0;";

    const typeLabel = doc.createElement("p");
    typeLabel.textContent = label;
    typeLabel.style.cssText = `font-size:18px;font-weight:700;color:${
      isVisitor ? "#ab3000" : "#1d4ed8"
    };margin:6px 0 0;`;

    const img = doc.createElement("img");
    img.src = `/api/qr/${encodeURIComponent(floor._id)}?type=${encodeURIComponent(type)}`;
    img.alt = `Kod QR ${floor.name}`;
    img.style.cssText =
      "display:block;width:300px;height:300px;margin:20px auto 0;";

    const note = doc.createElement("p");
    note.textContent = desc;
    note.style.cssText = "margin-top:16px;color:#666;";

    main.append(heading, typeLabel, img, note);
    printWhenReady(img);
  };

  /** Notice-board poster: big QR + the address + the three steps that turn
   *  a scan into a lasting home-screen shortcut (the fix for "no bookmark").
   *  The issuing organisation now lives in the shared poster footer. */
  const handlePrintAppQr = () => {
    const poster = openPoster(strings.qrAppPrintTitle, BRAND_BLUE);
    if (!poster) return;
    const { doc, main, printWhenReady } = poster;

    const heading = doc.createElement("h1");
    heading.textContent = strings.qrAppPrintTitle;
    heading.style.cssText = "font-size:28px;font-weight:800;margin:0;";

    const img = doc.createElement("img");
    img.src = "/api/qr/app";
    img.alt = strings.qrAppAlt;
    img.style.cssText =
      "display:block;width:300px;height:300px;margin:20px auto 0;";

    const url = doc.createElement("p");
    url.textContent = window.location.origin;
    url.style.cssText = "font-size:16px;font-weight:bold;margin-top:12px;";

    const steps = doc.createElement("ol");
    steps.style.cssText =
      "text-align:left;display:inline-block;margin-top:20px;font-size:15px;line-height:1.9;";
    for (const step of [
      strings.qrAppStep1,
      strings.qrAppStep2,
      strings.qrAppStep3,
    ]) {
      const item = doc.createElement("li");
      item.textContent = step;
      steps.appendChild(item);
    }

    main.append(heading, img, url, steps);
    printWhenReady(img);
  };

  const access = useAccess(["floors:manage"]);
  if (access) return access;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.qrCodes}
        breadcrumbs={[
          { label: strings.floors, href: "/floors" },
          { label: strings.qrCodes },
        ]}
        actions={
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => mutate()}
            loading={isLoading}
          >
            {strings.refresh}
          </Button>
        }
      />

      <Text size="sm" c="var(--app-text-secondary)">
        {strings.qrIntro}
      </Text>

      {/* Staff access QR — the app's own address, for notice boards. Shown
          even while the floor list loads or errors: it needs no floor data */}
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" gap="md" mb="md" wrap="wrap">
          <div>
            <Title order={2} size="h3">
              {strings.qrAppLabel}
            </Title>
            <Text size="sm" c="var(--app-text-secondary)" maw="62ch">
              {strings.qrAppHint}
            </Text>
          </div>
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrintAppQr}
          >
            {strings.printQR}
          </Button>
        </Group>
        <Group gap="lg" align="center">
          <Image
            src="/api/qr/app"
            alt={strings.qrAppAlt}
            width={200}
            height={200}
            fit="contain"
          />
          <Stack gap={4}>
            <Text fw={700} style={{ wordBreak: "break-all" }}>
              {origin}
            </Text>
            <Text size="sm" c="var(--app-text-secondary)">
              {strings.qrAppStep1} · {strings.qrAppStep2} ·{" "}
              {strings.qrAppStep3}
            </Text>
          </Stack>
        </Group>
      </Paper>

      {isLoading ? (
        <Stack gap="xl">
          {[0, 1].map((card) => (
            <Skeleton key={card} height={300} radius="md" />
          ))}
        </Stack>
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
                    alt={`${strings.qrEmployeeAlt} — ${floor.name}`}
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
                  <Badge color="warning" size="lg" leftSection={<IconUserStar size={14} />}>
                    {strings.qrVisitorLabel}
                  </Badge>
                  <Image
                    src={`/api/qr/${floor._id}?type=visitor`}
                    alt={`${strings.qrVisitorAlt} — ${floor.name}`}
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
                    color="warning"
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