"use client";

import { useState } from "react";
import {
  Center,
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Stack,
  Alert,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconLogin } from "@tabler/icons-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { strings } from "@/lib/i18n/strings";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm({
    initialValues: {
      username: "",
      password: "",
    },
    validate: {
      username: (value) =>
        value.trim().length < 1 ? strings.required : null,
      password: (value) =>
        value.length < 1 ? strings.required : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        username: values.username.toLowerCase().trim(),
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setError(strings.loginError);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError(strings.serverError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center h="100vh" bg="var(--mantine-color-default-bg)">
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        w={{ base: "100%", xs: 400 }}
        maw={400}
        mx="md"
      >
        <Title order={2} ta="center" mb="lg">
          {strings.appName}
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          {strings.loginTitle}
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            mb="md"
            radius="md"
          >
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label={strings.username}
              placeholder={strings.username}
              required
              {...form.getInputProps("username")}
              autoComplete="username"
            />

            <PasswordInput
              label={strings.password}
              placeholder={strings.password}
              required
              {...form.getInputProps("password")}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              leftSection={<IconLogin size={18} />}
              mt="sm"
            >
              {strings.loginButton}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}