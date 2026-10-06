import Link from "next/link";
import { Group, Stack, Title, Text, Breadcrumbs, Anchor } from "@mantine/core";

export interface Crumb {
  label: string;
  /** Omit for the current (last) page. */
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Optional subtitle rendered under the title. */
  description?: string;
  /** Page-level actions (refresh, export…). Hidden when printing. */
  actions?: React.ReactNode;
  /** Breadcrumb trail, parents first. Shows location (WCAG 2.4.8, AAA). */
  breadcrumbs?: Crumb[];
}

/**
 * The one page header.
 *
 * Every page used to hand-roll `<Group justify="space-between"><Title…>` or a
 * bare `<Title>` — 16 variants, none of them an `<h1>`. This renders a single
 * `<h1>` (keeping the previous h2 visual size), marks the action buttons
 * `.no-print` so exports/printouts only contain content, and offers the
 * breadcrumb trail for nested routes.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <Stack gap={description ? 2 : 0}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs mb="xs" separator="/">
          {breadcrumbs.map((crumb, index) =>
            crumb.href && index < breadcrumbs.length - 1 ? (
              <Anchor key={crumb.label} component={Link} href={crumb.href} size="sm">
                {crumb.label}
              </Anchor>
            ) : (
              <Text
                key={crumb.label}
                size="sm"
                c="var(--app-text-secondary)"
                aria-current="page"
              >
                {crumb.label}
              </Text>
            )
          )}
        </Breadcrumbs>
      )}
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
