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
import Image from "next/image";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconLogin } from "@tabler/icons-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { strings } from "@/lib/i18n/strings";
import { InstallAppButton } from "@/components/InstallAppButton";

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
    /* Brand gradient (dark end top-left): white text keeps ≥5:1 against
       every stop, so the first screen staff ever see carries the identity
       instead of a grey box */
    <Center
      mih="100vh"
      style={{
        background:
          "linear-gradient(155deg, #1e3a8a 0%, #1d4ed8 45%, #2563eb 100%)",
      }}
    >
      <Stack align="center" gap="lg" w="100%" maw={420} mx="md" py="xl">
        {/* Brand block — name + organisation, white-on-blue */}
        <Stack align="center" gap={6}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 18,
              padding: 8,
              lineHeight: 0,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.28)",
            }}
          >
            <Image
              src="/icons/icon.svg"
              alt={strings.appName}
              width={48}
              height={48}
              priority
            />
          </div>
          <Title order={1} size="h2" ta="center" style={{ color: "#ffffff" }}>
            {strings.appName}
          </Title>
          <Text size="sm" ta="center" style={{ color: "#f1f5f9" }}>
            {strings.appOrg}
          </Text>
        </Stack>

        <Paper shadow="md" p="xl" radius="lg" w="100%">
          <Text fw={600} size="lg" ta="center" mb="lg">
            {strings.loginTitle}
          </Text>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="danger"
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

          {/* Android/Chrome: the real install dialog, as soon as the browser
              says the PWA is installable. iOS and anything else keeps the
              printed/manual "Add to Home Screen" instructions in the tip below. */}
          <InstallAppButton />

          {/* The exact moment someone WITHOUT a bookmark reaches the app:
              teach them how to never need this address again (the app is an
              installable PWA — see public/manifest.json) */}
          <Text size="xs" c="var(--app-text-secondary)" ta="center" mt="lg">
            {strings.loginAddToHomeTip}
          </Text>
        </Paper>
      </Stack>
    </Center>
  );
}