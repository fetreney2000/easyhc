"use client";

import { useEffect, useMemo, useState } from "react";
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
import { downloadCsv } from "@/lib/csv";
import { useAccess } from "@/components/shell/useAccess";
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

  // Memoised: this builds the SWR key, so it only needs rebuilding when a
  // filter actually changes.
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    // Send absolute instants for the whole picked day in the USER's timezone;
    // the server compares them as-is (it used to re-apply setHours() in UTC,
    // which cut an MYT end date at 07:59 local).
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      params.set("fromDate", start.toISOString());
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      params.set("toDate", end.toISOString());
    }
    if (floorFilter) params.set("floorId", floorFilter);
    if (typeFilter) params.set("type", typeFilter);
    return params;
  }, [fromDate, toDate, floorFilter, typeFilter]);

  // Both dates are required before ANY query runs: the page loads nothing
  // (report rows nor the floor lookup) until the range is fully chosen.
  const datesReady = fromDate !== null && toDate !== null;

  // Server-side pagination: one page of rows per request plus the full match
  // count, so the cap is lifted and the table never maps more than
  // ROWS_PER_PAGE rows (mapping 1000 rows was a measurable INP cost).
  const ROWS_PER_PAGE = 25;
  const MAX_EXPORT_ROWS = 5000;
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  // A new filter starts back at page 1
  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, floorFilter, typeFilter]);

  const { data, error, isLoading, mutate } = useSWR<{
    records: ReportRecord[];
    rowCount: number;
    pageSize: number;
    total: number;
    page: number;
  }>(
    datesReady
      ? `/api/reports?${queryParams.toString()}&page=${page}&pageSize=${ROWS_PER_PAGE}`
      : null, // null key = no request at all until both dates exist
    fetcher
  );

  const { data: floors } = useSWR<{ _id: string; name: string }[]>(
    datesReady ? "/api/floors" : null,
    fetcher
  );

  const { totalRecords, pageCount, currentPage, pageStart, visibleRecords } =
    useMemo(() => {
      const total = data?.total ?? 0;
      const count = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
      const current = Math.min(page, count);
      return {
        totalRecords: total,
        pageCount: count,
        currentPage: current,
        pageStart: (current - 1) * ROWS_PER_PAGE,
        visibleRecords: data?.records ?? [],
      };
    }, [data, page]);

  const handleExportCSV = async () => {
    if (!datesReady) return;
    setExporting(true);
    try {
      // The table view is paginated — ask the API for the whole result set
      const full = await fetcher<{ records: ReportRecord[]; total: number }>(
        `/api/reports?${queryParams.toString()}&page=1&pageSize=${MAX_EXPORT_ROWS}`
      );
      if (!full.records.length) return;

      const headers = [
        "Nama",
        "Jenis",
        "Lantai",
        "Daftar Masuk",
        "Daftar Keluar",
        "Kaedah",
      ];

      const rows = full.records.map((r) => [
        r.type === "employee" ? r.userId?.name : r.visitorName,
        r.type === "employee" ? strings.employee : strings.visitor,
        r.floorId?.name || "-",
        new Date(r.checkedInAt).toLocaleString("ms-MY"),
        r.checkedOutAt
          ? new Date(r.checkedOutAt).toLocaleString("ms-MY")
          : "Masih aktif",
        r.method === "qr" ? "QR" : "Manual",
      ]);

      // RFC 4180 quoting + formula-injection guard + BOM live in lib/csv.ts
      // (shared with the evacuation report export)
      downloadCsv(
        headers,
        rows,
        `laporan-kehadiran-${new Date().toISOString().split("T")[0]}.csv`
      );

      // The export is invisible otherwise (Nielsen #1: visibility of status),
      // and a capped export must say so instead of silently dropping rows.
      const truncated = full.total > full.records.length;
      notifications.show({
        title: truncated ? strings.warning : strings.success,
        message: truncated
          ? strings.csvLimited(MAX_EXPORT_ROWS)
          : strings.csvExported,
        color: truncated ? "warning" : "success",
      });
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setExporting(false);
    }
  };

  const access = useAccess([
    "reports:generate_all",
    "reports:generate_department",
    "reports:generate_own_unit",
    "reports:generate_own_floor",
    "reports:generate_own",
  ]);
  if (!session?.user) return <LoadingScreen />;
  if (access) return access;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.reports}
        // An employee's report is their own history — say so
        description={strings.attendanceHistory}
        actions={
          <>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={handleExportCSV}
              loading={exporting}
              disabled={
                !exporting && (!datesReady || !data?.records?.length)
              }
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
            disabled={!datesReady}
            mt="auto"
          >
            {strings.refresh}
          </Button>
        </Group>
      </Paper>

      {/* Report table — nothing renders (and nothing is fetched) until both
          dates are chosen */}
      {!datesReady ? (
        <Paper p="xl" radius="md" withBorder>
          <Center>
            <Text size="sm" c="var(--app-text-secondary)" ta="center">
              {strings.reportsPickDates}
            </Text>
          </Center>
        </Paper>
      ) : (
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
      )}

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