import { Center, Loader } from "@mantine/core";

/**
 * Placeholder while the session is still being resolved.
 * Pages use it instead of `return null`, which flashed a blank screen on
 * every hard refresh.
 */
export function LoadingScreen() {
  return (
    <Center mih="60vh">
      <Loader />
    </Center>
  );
}
