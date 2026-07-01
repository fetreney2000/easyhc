"use client";

import { useState } from "react";
import {
  Center,
  Paper,
  TextInput,
  Button,
  Title,
  Text,
  Stack,
  Alert,
  Group,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconCheck, IconLogin } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";
import { notifications } from "@mantine/notifications";

export default function VisitorCheckInPage({
  params,
}: {
  params: { floorId: string };
}) {
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      visitorName: "",
      visitorDept: "",
      visitorPhone: "",
    },
    validate: {
      visitorName: (value) =>
        value.trim().length < 1 ? strings.required : null,
      visitorDept: (value) =>
        value.trim().length < 1 ? strings.required : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/visitor/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          floorId: params.floorId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCheckedIn(true);
        setAttendanceId(data.attendance?._id);
        notifications.show({
          title: strings.success,
          message: strings.visitorCheckInSuccess,
          color: "green",
        });
      } else {
        setError(data.error || strings.checkInError);
      }
    } catch {
      setError(strings.serverError);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!attendanceId) return;
    setCheckoutLoading(true);

    try {
      const res = await fetch("/api/visitor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.visitorCheckOutSuccess,
          color: "green",
        });
        setCheckedIn(false);
        setAttendanceId(null);
        form.reset();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.checkOutError,
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
      setCheckoutLoading(false);
    }
  };

  return (
    <Center mih="100vh" bg="var(--mantine-color-default-bg)">
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        w={{ base: "100%", xs: 400 }}
        maw={400}
        mx="md"
      >
        <Title order={3} ta="center" mb="lg">
          {strings.visitorCheckInTitle}
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        {checkedIn ? (
          <Stack gap="md">
            <Alert icon={<IconCheck size={16} />} color="green">
              {strings.visitorCheckInSuccess}
            </Alert>
            <Text size="sm" c="dimmed" ta="center">
              {form.values.visitorName}
            </Text>
            <Button
              fullWidth
              color="red"
              variant="light"
              loading={checkoutLoading}
              onClick={handleCheckOut}
            >
              {strings.checkOut}
            </Button>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label={strings.visitorName}
                placeholder={strings.visitorName}
                required
                {...form.getInputProps("visitorName")}
              />
              <TextInput
                label={strings.visitorDept}
                placeholder={strings.visitorDept}
                required
                {...form.getInputProps("visitorDept")}
              />
              <TextInput
                label={strings.visitorPhone}
                placeholder={strings.visitorPhonePlaceholder}
                {...form.getInputProps("visitorPhone")}
              />
              <Button
                type="submit"
                fullWidth
                loading={loading}
                leftSection={<IconLogin size={18} />}
                mt="sm"
              >
                {strings.checkIn}
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}