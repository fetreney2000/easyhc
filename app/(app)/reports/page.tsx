"use client";

import { useState } from "react";
import {
  Title,
  Paper,
  Table,
  Group,
  Button,
  Select,
  Stack,
  Text,
  Loader,
  Center,
  Badge,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { strings } from "@/lib/i18n/strings";

interface ReportRecord {
  _id: string;
  type: "employee" | "visitor";
  userId?: { name: string; staffId: string; role: string };
  visitorName?: string;
  visitorDept?: string;
  floorId?: { name: string };
  checkedInAt: string;
  checkedOutAt?: string;
  method: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ReportsPage() {
  const { data: session } = useSession();
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (fromDate) queryParams.set("fromDate", fromDate.toISOString());
  if (toDate) queryParams.set("toDate", toDate.toISOString());
  if (floorFilter) queryParams.set("floorId", floorFilter);
  if (typeFilter) queryParams.set("type", typeFilter);

  const { data, isLoading, mutate } = useSWR<{ records: ReportRecord[] }>(
    `/api/reports?${queryParams.toString()}`,
    fetcher
  );

  const { data: floors } = useSWR<{ _id: string; name: string }[]>(
    "/api/floors",
    fetcher
  );

  const handleExportCSV = () => {
    if (!data?.records?.length) return;

    const headers = [
      "Nama",
      "No. Pekerja",
      "Jenis",
      "Lantai",
      "Daftar Masuk",
      "Daftar Keluar",
      "Kaedah",
    ];

    const rows = data.records.map((r) => [
      r.type === "employee" ? r.userId?.name : r.visitorName,
      r.type === "employee" ? r.userId?.staffId : "-",
      r.type === "employee" ? "Kakitangan" : "Pelawat",
      r.floorId?.name || "-",
      new Date(r.checkedInAt).toLocaleString("ms-MY"),
      r.checkedOutAt
        ? new Date(r.checkedOutAt).toLocaleString("ms-MY")
        : "Masih aktif",
      r.method === "qr" ? "QR" : "Manual",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-kehadiran-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return null;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{strings.reports}</Title>
        <Group>
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={handleExportCSV}
            disabled={!data?.records?.length}
          >
            {strings.exportCSV}
          </Button>
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
          >
            {strings.printReport}
          </Button>
        </Group>
      </Group>

      {/* Filters */}
      <Paper p="md" radius="md" withBorder className="no-print">
        <Group>
          <DateInput
            label={strings.fromDate}
            value={fromDate}
            onChange={setFromDate}
            clearable
            w={160}
          />
          <DateInput
            label={strings.toDate}
            value={toDate}
            onChange={setToDate}
            clearable
            w={160}
          />
          <Select
            label="Lantai"
            data={[
              { value: "", label: "Semua" },
              ...(floors?.map((f) => ({
                value: f._id,
                label: f.name,
              })) || []),
            ]}
            value={floorFilter}
            onChange={setFloorFilter}
            clearable
            w={160}
          />
          <Select
            label="Jenis"
            data={[
              { value: "employee", label: "Kakitangan" },
              { value: "visitor", label: "Pelawat" },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
            w={140}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={() => mutate()}
            mt="auto"
          >
            {strings.refresh}
          </Button>
        </Group>
      </Paper>

      {/* Report table */}
      <Paper p="md" radius="md" withBorder>
        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : !data?.records?.length ? (
          <Center py="xl">
            <Text c="dimmed">{strings.noReportData}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{strings.name}</Table.Th>
                  <Table.Th>{strings.staffId}</Table.Th>
                  <Table.Th>Jenis</Table.Th>
                  <Table.Th>{strings.floors}</Table.Th>
                  <Table.Th>{strings.checkIn}</Table.Th>
                  <Table.Th>{strings.checkOut}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.records.map((record) => (
                  <Table.Tr key={record._id}>
                    <Table.Td>
                      {record.type === "employee"
                        ? record.userId?.name
                        : record.visitorName}
                    </Table.Td>
                    <Table.Td>
                      {record.type === "employee"
                        ? record.userId?.staffId
                        : "-"}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={record.type === "employee" ? "blue" : "orange"}
                      >
                        {record.type === "employee"
                          ? "Kakitangan"
                          : "Pelawat"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{record.floorId?.name}</Table.Td>
                    <Table.Td>
                      {new Date(record.checkedInAt).toLocaleString("ms-MY", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Table.Td>
                    <Table.Td>
                      {record.checkedOutAt
                        ? new Date(record.checkedOutAt).toLocaleString(
                            "ms-MY",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Text size="xs" c="dimmed" ta="right">
        {data?.records?.length || 0} rekod
      </Text>
    </Stack>
  );
}