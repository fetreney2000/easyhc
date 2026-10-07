"use client";

import { useEffect, useState } from "react";
import {
  AppShell,
  Burger,
  Group,
  Text,
  Avatar,
  Menu,
  UnstyledButton,
  ActionIcon,
  useMantineColorScheme,
  Indicator,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconDashboard,
  IconQrcode,
  IconReport,
  IconUsers,
  IconUsersGroup,
  IconBuilding,
  IconUser,
  IconLogout,
  IconSun,
  IconMoon,
  IconScan,
  IconClipboardCheck,
  IconMap,
  IconBuildingSkyscraper,
  IconCopyright,
} from "@tabler/icons-react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { strings } from "@/lib/i18n/strings";
import { Role } from "@/lib/db/types";
import { can } from "@/lib/auth/rbac";
import { NavbarLink } from "./NavbarLink";
import { FooterTab } from "./FooterTab";

interface AppShellLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    name: string;
    role: Role;
    username: string;
  };
}

interface NavLinkItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  action?: string;
}

/**
 * One colour per nav group (mirrors the GROUP comments below): the sidebar
 * icon is tinted in both states instead of every entry being grey, and the
 * active mobile tab takes the same colour so both bars tell the same story.
 * Unknown hrefs fall back to the brand colour.
 */
const NAV_COLORS: Record<string, string> = {
  // GROUP 1 — Kehadiran
  "/dashboard": "brandPrimary",
  "/scan": "brandPrimary",
  "/muster": "danger", // emergency display
  // GROUP 2 — Lantai & Lokasi
  "/floors": "teal",
  "/my-unit": "teal",
  "/all-staff": "teal",
  // GROUP 3 — Laporan
  "/reports": "violet",
  // GROUP 4 — Pentadbiran
  "/users": "orange",
  "/floors/manage": "orange",
  "/manual-checkin": "orange",
  "/jabatans": "orange",
  "/units": "orange",
  "/floors/qr": "orange",
  // GROUP 5 — Info
  "/hakcipta": "gray",
};

const colorFor = (href: string): string => NAV_COLORS[href] ?? "brandPrimary";

export function AppShellLayout({ children, user }: AppShellLayoutProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const router = useRouter();
  const pathname = usePathname();

  // The server revokes tokens when a user is deactivated/deleted or their
  // password/sessionVersion changes. When that happens mid-session the API
  // serves a session with no `user` — send the user back to the login screen
  // instead of leaving a shell with dead API calls behind it.
  const { data: liveSession, status } = useSession();
  useEffect(() => {
    if (status === "authenticated" && !liveSession?.user) {
      signOut({ callbackUrl: "/login" });
    }
  }, [status, liveSession]);

  // Navigation items based on role — logically grouped by function

  // GROUP 1: Kehadiran (Attendance) — always visible
  const navItems: NavLinkItem[] = [
    {
      label: strings.dashboard,
      icon: <IconDashboard size={20} stroke={1.5} />,
      href: "/dashboard",
    },
    {
      label: strings.scanQR,
      icon: <IconQrcode size={20} stroke={1.5} />,
      href: "/scan",
    },
    {
      // Emergency display — kept in the always-visible group so every role
      // can reach it during a drill (it respects their data scope anyway)
      label: strings.musterMode,
      icon: <IconUsersGroup size={20} stroke={1.5} />,
      href: "/muster",
    },
  ];

  // GROUP 2: Lantai & Lokasi (Floors & Location)
  if (can(user.role, "floors:view_all") || can(user.role, "floors:view_own_floor")) {
    navItems.push({
      // Only roles that actually see the whole building get "Semua Lantai";
      // scoped roles see a slice, so the neutral "Lantai" is honest for them
      label: ["superadmin", "admin", "safety_head"].includes(user.role)
        ? strings.allFloors
        : strings.floors,
      icon: <IconBuildingSkyscraper size={20} stroke={1.5} />,
      href: "/floors",
    });
  }

  if (
    can(user.role, "locations:track_own_unit") ||
    can(user.role, "locations:track_department") ||
    can(user.role, "locations:track_all")
  ) {
    navItems.push({
      label: user.role === "unit_head" ? strings.myUnit : strings.allStaffLocations,
      icon: <IconMap size={20} stroke={1.5} />,
      href: user.role === "unit_head" ? "/my-unit" : "/all-staff",
    });
  }

  // GROUP 3: Laporan (Reports)
  if (
    can(user.role, "reports:generate_all") ||
    can(user.role, "reports:generate_department") ||
    can(user.role, "reports:generate_own_unit") ||
    can(user.role, "reports:generate_own_floor") ||
    can(user.role, "reports:generate_own")
  ) {
    navItems.push({
      label: strings.reports,
      icon: <IconReport size={20} stroke={1.5} />,
      href: "/reports",
    });
  }

  // GROUP 4: Pentadbiran — ordered by frequency of usage
  if (can(user.role, "users:manage")) {
    navItems.push({
      label: strings.userManagement,
      icon: <IconUsers size={20} stroke={1.5} />,
      href: "/users",
    });
    navItems.push({
      label: strings.floorManagement,
      icon: <IconBuildingSkyscraper size={20} stroke={1.5} />,
      href: "/floors/manage",
    });
    navItems.push({
      label: strings.manualCheckIn,
      icon: <IconClipboardCheck size={20} stroke={1.5} />,
      href: "/manual-checkin",
    });
    navItems.push({
      label: strings.jabatan,
      icon: <IconBuilding size={20} stroke={1.5} />,
      href: "/jabatans",
    });
    navItems.push({
      label: strings.unit,
      icon: <IconBuilding size={20} stroke={1.5} />,
      href: "/units",
    });
    navItems.push({
      label: strings.qrCodes,
      icon: <IconQrcode size={20} stroke={1.5} />,
      href: "/floors/qr",
    });
  }

  // GROUP 5: Maklumat (Info) — least frequent
  navItems.push({
    label: strings.copyright,
    icon: <IconCopyright size={20} stroke={1.5} />,
    href: "/hakcipta",
  });

  // Footer tab items — MUST be odd count (3, 5, or 7) with Imbas Kod QR always centered
  // Left side and right side of center button must have equal item count
  const buildFooterItems = () => {
    const leftItems: { label: string; icon: React.ReactNode; href: string; isPrimary?: boolean }[] = [];
    const rightItems: { label: string; icon: React.ReactNode; href: string; isPrimary?: boolean }[] = [];

    // LEFT side: Dashboard always first
    leftItems.push({
      label: strings.dashboard,
      icon: <IconDashboard size={22} stroke={1.5} />,
      href: "/dashboard",
    });

    // LEFT side: second item based on role
    if (can(user.role, "users:manage")) {
      leftItems.push({
        label: strings.userManagement,
        icon: <IconUsers size={22} stroke={1.5} />,
        href: "/users",
      });
    } else if (
      can(user.role, "locations:track_all") ||
      can(user.role, "locations:track_department") ||
      can(user.role, "locations:track_own_unit")
    ) {
      leftItems.push({
        label: user.role === "unit_head" ? strings.myUnit : strings.allStaffLocations,
        icon: <IconMap size={22} stroke={1.5} />,
        href: user.role === "unit_head" ? "/my-unit" : "/all-staff",
      });
    } else if (can(user.role, "floors:view_all") || can(user.role, "floors:view_own_floor")) {
      leftItems.push({
        label: strings.floors,
        icon: <IconBuildingSkyscraper size={22} stroke={1.5} />,
        href: "/floors",
      });
    }

    // RIGHT side: first item based on role
    if (
      can(user.role, "reports:generate_all") ||
      can(user.role, "reports:generate_department") ||
      can(user.role, "reports:generate_own_unit") ||
      can(user.role, "reports:generate_own_floor") ||
      can(user.role, "reports:generate_own")
    ) {
      rightItems.push({
        label: strings.reports,
        icon: <IconReport size={22} stroke={1.5} />,
        href: "/reports",
      });
    } else if (can(user.role, "floors:view_all") || can(user.role, "floors:view_own_floor")) {
      rightItems.push({
        label: strings.floors,
        icon: <IconBuildingSkyscraper size={22} stroke={1.5} />,
        href: "/floors",
      });
    }

    // RIGHT side: last item is always Profile
    rightItems.push({
      label: strings.profile,
      icon: <IconUser size={22} stroke={1.5} />,
      href: "/profile",
    });

    // Drop anything already on the left (e.g. /floors when the role has no
    // reports tab): duplicate hrefs meant duplicate React keys and two tabs
    // pointing at the same page.
    const leftHrefs = new Set(leftItems.map((item) => item.href));
    const uniqueRight = rightItems.filter((item) => !leftHrefs.has(item.href));

    // Balance: trim to make left and right equal length
    const sideCount = Math.min(leftItems.length, uniqueRight.length);
    const balancedLeft = leftItems.slice(0, sideCount);
    const balancedRight = uniqueRight.slice(0, sideCount);

    return [
      ...balancedLeft,
      {
        label: strings.scanQR,
        icon: <IconScan size={28} stroke={2} />,
        href: "/scan",
        isPrimary: true,
      },
      ...balancedRight,
    ];
  };

  const footerItems = buildFooterItems();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleNavClick = () => {
    // NavbarLink is a real <Link> now — it navigates on its own;
    // this only has to dismiss the mobile drawer.
    close();
  };

  return (
    <AppShell
      header={{ height: { base: 50, md: 60 } }}
      navbar={{
        width: { base: 0, md: 280 },
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      footer={{ height: { base: 50, md: 0 } }}
      padding="md"
    >
      {/* WCAG 2.4.1 — first focusable element, jumps past nav to the content */}
      <a className="skip-link" href="#main-content">
        {strings.skipToContent}
      </a>

      {/* Header */}
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
              aria-label={strings.menu}
            />
            <Group gap="xs">
              <Image
                src="/icons/icon.svg"
                alt={strings.appName}
                width={32}
                height={32}
                priority
              />
              <Text fw={700} size="lg">
                {strings.appName}
              </Text>
            </Group>
          </Group>
          <Group gap="xs">
            {/* Scan button - always visible on desktop */}
            <ActionIcon
              variant="filled"
              color="brandPrimary"
              size="lg"
              radius="xl"
              onClick={() => router.push("/scan")}
              visibleFrom="md"
              title={strings.scanQR}
              aria-label={strings.scanQR}
            >
              <IconQrcode size={20} />
            </ActionIcon>

            {/* Dark mode toggle */}
            <ActionIcon
              variant="subtle"
              onClick={() => toggleColorScheme()}
              title={colorScheme === "dark" ? strings.lightMode : strings.darkMode}
              aria-label={colorScheme === "dark" ? strings.lightMode : strings.darkMode}
            >
              {colorScheme === "dark" ? (
                <IconSun size={20} />
              ) : (
                <IconMoon size={20} />
              )}
            </ActionIcon>

            {/* User menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton aria-label={`${user.name} — ${strings.profile}`}>
                  <Group gap="xs">
                    <Avatar size="sm" radius="xl" color="brandPrimary" aria-hidden>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Text size="sm" fw={500} visibleFrom="sm">
                      {user.name}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.name}</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  onClick={() => router.push("/profile")}
                >
                  {strings.profile}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="danger"
                  leftSection={<IconLogout size={16} />}
                  onClick={handleLogout}
                >
                  {strings.logout}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Navbar (Desktop sidebar) */}
      <AppShell.Navbar p="md" hiddenFrom="md" className="no-print" style={{ overflowY: "auto" }}>
        {navItems.map((item) => (
          <NavbarLink
            key={item.href}
            {...item}
            color={colorFor(item.href)}
            // EXACT match on purpose: /floors and /floors/manage are
            // siblings in this list, so prefix matching lit up both when
            // "Pengurusan Lantai" was opened (reported bug).
            active={pathname === item.href}
            onClick={handleNavClick}
          />
        ))}
      </AppShell.Navbar>

      {/* Navbar (Desktop persistent) */}
      <AppShell.Navbar p="md" visibleFrom="md" className="no-print" style={{ overflowY: "auto" }}>
        {navItems.map((item) => (
          <NavbarLink
            key={item.href}
            {...item}
            color={colorFor(item.href)}
            // EXACT match on purpose: /floors and /floors/manage are
            // siblings in this list, so prefix matching lit up both when
            // "Pengurusan Lantai" was opened (reported bug).
            active={pathname === item.href}
            onClick={handleNavClick}
          />
        ))}
      </AppShell.Navbar>

      {/* Main content */}
      <AppShell.Main id="main-content" tabIndex={-1}>
        {children}
      </AppShell.Main>

      {/* Footer (Mobile tab bar) */}
      <AppShell.Footer hiddenFrom="md" className="no-print" p={0} style={{ 
        background: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-default-border)",
        boxShadow: "var(--app-shadow-footer)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <Group
          grow
          gap={0}
          h="100%"
        >
          {footerItems.map((item) => (
            <FooterTab
              key={item.href}
              label={item.label}
              icon={item.icon}
              href={item.href}
              color={colorFor(item.href)}
              active={pathname === item.href}
              isPrimary={item.isPrimary}
            />
          ))}
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}