"use client";

import { useEffect, useState } from "react";
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
  Pagination,
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
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/i18n/strings";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingScreen } from "@/components/shell/LoadingScreen";

interface ReportRecord {
  _id: string;
  type: "employee" | "visitor";
  userId?: { name: string; role: string };
  visitorName?: string;
  visitorDept?: string;
  floorId?: { name: string };
  checkedInAt: string;
  checkedOutAt?: string;
  method: string;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  // Send absolute instants for the whole picked day in the USER's timezone;
  // the server compares them as-is (it used to re-apply setHours() in UTC,
  // which cut an MYT end date at 07:59 local).
  if (fromDate) {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    queryParams.set("fromDate", start.toISOString());
  }
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    queryParams.set("toDate", end.toISOString());
  }
  if (floorFilter) queryParams.set("floorId", floorFilter);
  if (typeFilter) queryParams.set("type", typeFilter);

  const { data, error, isLoading, mutate } = useSWR<{
    records: ReportRecord[];
    rowCount: number;
    pageSize: number;
  }>(`/api/reports?${queryParams.toString()}`, fetcher);

  const { data: floors } = useSWR<{ _id: string; name: string }[]>(
    "/api/floors",
    fetcher
  );

  // Client-side pagination: the API returns the full (capped) result set so
  // the CSV export stays complete, but the table renders one page at a time —
  // mapping 1000 rows is a measurable INP cost on a mid-range phone.
  const ROWS_PER_PAGE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, floorFilter, typeFilter]);

  const totalRecords = data?.records.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRecords / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * ROWS_PER_PAGE;
  const visibleRecords = data
    ? data.records.slice(pageStart, pageStart + ROWS_PER_PAGE)
    : [];

  const handleExportCSV = () => {
    if (!data?.records?.length) return;

    const headers = [
      "Nama",
      "Jenis",
      "Lantai",
      "Daftar Masuk",
      "Daftar Keluar",
      "Kaedah",
    ];

    const rows = data.records.map((r) => [
      r.type === "employee" ? r.userId?.name : r.visitorName,
      r.type === "employee" ? strings.employee : strings.visitor,
      r.floorId?.name || "-",
      new Date(r.checkedInAt).toLocaleString("ms-MY"),
      r.checkedOutAt
        ? new Date(r.checkedOutAt).toLocaleString("ms-MY")
        : "Masih aktif",
      r.method === "qr" ? "QR" : "Manual",
    ]);

    // RFC 4180 quoting, plus a guard against spreadsheet formula injection:
    // visitor names are attacker-controlled, and a leading =, +, - or @
    // would otherwise execute as a formula when the CSV is opened.
    const csvCell = (value: unknown): string => {
      const raw = value == null ? "" : String(value);
      const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return /[",\r\n]/.test(guarded)
        ? `"${guarded.replace(/"/g, '""')}"`
        : guarded;
    };

    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((r) => r.map(csvCell).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-kehadiran-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    // The export is invisible otherwise (Nielsen #1: visibility of status)
    notifications.show({
      title: strings.success,
      message: strings.csvExported,
      color: "success",
    });
  };

  if (!session?.user) return <LoadingScreen />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.reports}
        actions={
          <>
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
          </>
        }
      />

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
            label={strings.floors}
            data={[
              { value: "", label: strings.all },
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
            label={strings.typeLabel}
            data={[
              { value: "employee", label: strings.employee },
              { value: "visitor", label: strings.visitor },
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
      <DataTable
        isLoading={isLoading}
        error={error}
        onRetry={mutate}
        isEmpty={!data?.records?.length}
        empty={strings.noReportData}
        minWidth={700}
      >
        <Table.Thead>
                <Table.Tr>
                  <Table.Th>{strings.name}</Table.Th>
                  <Table.Th>{strings.typeLabel}</Table.Th>
                  <Table.Th>{strings.floors}</Table.Th>
                  <Table.Th>{strings.checkIn}</Table.Th>
                  <Table.Th>{strings.checkOut}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleRecords.map((record) => (
                  <Table.Tr key={record._id}>
                    <Table.Td>
                      {record.type === "employee"
                        ? record.userId?.name
                        : record.visitorName}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={record.type === "employee" ? "blue" : "orange"}
                      >
                        {record.type === "employee"
                          ? strings.employee
                          : strings.visitor}
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
      </DataTable>

      {data && (
        <Group justify="space-between" gap="sm">
          <Text size="xs" c="var(--app-text-secondary)">
            {totalRecords === 0
              ? strings.recordsCount(0)
              : strings.showingRange(
                  pageStart + 1,
                  Math.min(pageStart + ROWS_PER_PAGE, totalRecords),
                  totalRecords
                )}
          </Text>
          {pageCount > 1 && (
            <Pagination
              total={pageCount}
              value={currentPage}
              onChange={setPage}
              size="sm"
            />
          )}
        </Group>
      )}
    </Stack>
  );
}