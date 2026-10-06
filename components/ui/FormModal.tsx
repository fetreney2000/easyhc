import { Modal, Button, Group, Stack } from "@mantine/core";
import { strings } from "@/lib/i18n/strings";

interface FormModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  /** Pass `form.onSubmit(handleSubmit)` from the calling page. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading?: boolean;
  size?: string;
  /** Form fields. The footer (cancel/save) is provided by this component. */
  children: React.ReactNode;
}

/**
 * The shared CRUD modal shell.
 *
 * Four pages (jabatans, units, floors/manage, users) each hand-rolled the
 * same Modal + form + cancel/save footer — this keeps the field definitions
 * local to each page while making the shell, spacing and button behaviour
 * identical everywhere.
 */
export function FormModal({
  opened,
  onClose,
  title,
  onSubmit,
  loading,
  size = "lg",
  children,
}: FormModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size={size}>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {children}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              {strings.cancel}
            </Button>
            <Button type="submit" loading={loading}>
              {strings.save}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
