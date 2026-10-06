import { Group, Stack, Title, Text } from "@mantine/core";

interface PageHeaderProps {
  title: string;
  /** Optional subtitle rendered under the title. */
  description?: string;
  /** Page-level actions (refresh, export…). Hidden when printing. */
  actions?: React.ReactNode;
}

/**
 * The one page header.
 *
 * Every page used to hand-roll `<Group justify="space-between"><Title…>` or a
 * bare `<Title>` — 16 variants, none of them an `<h1>`. This renders a single
 * `<h1>` (keeping the previous h2 visual size) and marks the action buttons
 * `.no-print` so exports/printouts only contain content.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack gap={description ? 2 : 0}>
      <Group justify="space-between" align="flex-start" gap="md">
        <Title order={1} size="h2">
          {title}
        </Title>
        {actions && (
          <Group gap="xs" className="no-print">
            {actions}
          </Group>
        )}
      </Group>
      {description && (
        <Text size="sm" c="var(--app-text-secondary)">
          {description}
        </Text>
      )}
    </Stack>
  );
}
