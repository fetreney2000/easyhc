import Link from "next/link";
import { Center, Stack, Text, Button, Paper } from "@mantine/core";
import { strings } from "@/lib/i18n/strings";

/** 404 route — Next renders this for any unmatched path. */
export default function NotFound() {
  return (
    <Center mih="100vh" bg="var(--mantine-color-default-bg)">
      <Paper shadow="md" p="xl" radius="md" w={{ base: "100%", xs: 420 }} maw={420} mx="md">
        <Stack align="center" gap="md">
          <Text fw={700} size="xl" ta="center">
            404
          </Text>
          <Text size="sm" c="var(--app-text-secondary)" ta="center">
            {strings.pageNotFound}
          </Text>
          <Button component={Link} href="/dashboard" variant="light">
            {strings.dashboard}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
