"use client";

import {
  Title,
  Paper,
  Text,
  Stack,
  Group,
  Avatar,
  Divider,
  Badge,
  SimpleGrid,
  Card,
  Center,
} from "@mantine/core";
import {
  IconCode,
  IconMail,
  IconPhone,
  IconCalendar,
  IconBuilding,
  IconShield,
  IconHeart,
} from "@tabler/icons-react";

export default function HakciptaPage() {
  const currentYear = new Date().getFullYear();

  return (
    <Center py="xl">
      <Stack align="center" gap="xl" maw={700} w="100%">
        {/* Main Card */}
        <Paper
          p="xl"
          radius="lg"
          withBorder
          w="100%"
          shadow="sm"
          style={{ textAlign: "center" }}
        >
          <Stack align="center" gap="md">
            {/* App Logo/Brand */}
            <Avatar
              size={80}
              radius="xl"
              variant="filled"
              color="brandPrimary"
              style={{ fontSize: "2rem", fontWeight: 700 }}
            >
              EH
            </Avatar>

            <div>
              <Title order={2} c="brandPrimary" mb={4}>
                EasyHC
              </Title>
              <Text size="sm" c="dimmed">
                Sistem Kehadiran Lantai
              </Text>
            </div>

            <Badge variant="light" color="brandPrimary" size="lg">
              Versi 1.0
            </Badge>

            <Divider w="60%" my="sm" />

            {/* Developer Info */}
            <Stack align="center" gap="md" w="100%">
              <Text size="lg" fw={700} ta="center">
                Hak Cipta Terpelihara
              </Text>

              <Text size="sm" c="dimmed" ta="center" maw={500}>
                Aplikasi ini adalah hak milik pembangun. Sebarang penggunaan, pengeluaran semula,
                atau pengagihan semula tanpa kebenaran bertulis adalah dilarang.
              </Text>

              <Paper
                p="md"
                radius="md"
                withBorder
                w="100%"
                maw={400}
                bg="var(--mantine-color-default-bg)"
              >
                <Stack align="center" gap="sm">
                  <Text size="sm" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.1em" }}>
                    Pembangun Aplikasi
                  </Text>
                  <Text size="lg" fw={700} ta="center">
                    Ahmad Fetre Bin Mohammad Zime
                  </Text>
                </Stack>
              </Paper>

              <SimpleGrid cols={1} spacing="xs" w="100%" maw={400}>
                <Group justify="center" gap="sm">
                  <IconMail size={16} color="var(--mantine-color-blue-6)" />
                  <Text
                    size="sm"
                    component="a"
                    href="mailto:fetreney2000@gmail.com"
                    c="blue"
                    style={{ textDecoration: "none" }}
                  >
                    fetreney2000@gmail.com
                  </Text>
                </Group>

                <Group justify="center" gap="sm">
                  <IconPhone size={16} color="var(--mantine-color-green-6)" />
                  <Text
                    size="sm"
                    component="a"
                    href="tel:+60168813920"
                    c="green"
                    style={{ textDecoration: "none" }}
                  >
                    016-881 3920
                  </Text>
                </Group>
              </SimpleGrid>
            </Stack>
          </Stack>
        </Paper>

        {/* Footer */}
        <Text size="xs" c="dimmed" ta="center">
          &copy; {currentYear} EasyHC. Semua hak cipta terpelihara.
        </Text>
      </Stack>
    </Center>
  );
}