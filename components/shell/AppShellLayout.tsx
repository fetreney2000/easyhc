"use client";

import { useState } from "react";
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
  IconBuilding,
  IconUser,
  IconLogout,
  IconSun,
  IconMoon,
  IconScan,
  IconClipboardCheck,
  IconMap,
  IconBuildingSkyscraper,
} from "@tabler/icons-react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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

export function AppShellLayout({ children, user }: AppShellLayoutProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const router = useRouter();
  const pathname = usePathname();

  // Navigation items based on role (Section 9.2)
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
  ];

  // Role-specific navigation
  if (can(user.role, "reports:generate_all") || can(user.role, "reports:generate_own_floor")) {
    navItems.push({
      label: strings.reports,
      icon: <IconReport size={20} stroke={1.5} />,
      href: "/reports",
    });
  }

  if (can(user.role, "locations:track_own_unit") || can(user.role, "locations:track_all")) {
    navItems.push({
      label: user.role === "dept_head" || user.role === "superadmin" || user.role === "admin"
        ? strings.allStaffLocations
        : strings.myUnit,
      icon: <IconMap size={20} stroke={1.5} />,
      href: user.role === "unit_head" ? "/my-unit" : "/all-staff",
    });
  }

  if (can(user.role, "floors:view_all") || can(user.role, "floors:view_own_floor")) {
    navItems.push({
      label: user.role === "floor_head" || user.role === "safety_head"
        ? strings.floors
        : strings.allFloors,
      icon: <IconBuildingSkyscraper size={20} stroke={1.5} />,
      href: "/floors",
    });
  }

  // Admin-only items
  if (can(user.role, "users:manage")) {
    navItems.push({
      label: strings.userManagement,
      icon: <IconUsers size={20} stroke={1.5} />,
      href: "/users",
    });
    navItems.push({
      label: strings.floorManagement,
      icon: <IconBuilding size={20} stroke={1.5} />,
      href: "/floors/manage",
    });
    navItems.push({
      label: strings.qrCodes,
      icon: <IconQrcode size={20} stroke={1.5} />,
      href: "/floors/qr",
    });
    navItems.push({
      label: strings.manualCheckIn,
      icon: <IconClipboardCheck size={20} stroke={1.5} />,
      href: "/manual-checkin",
    });
  }

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
    } else if (can(user.role, "locations:track_all") || can(user.role, "locations:track_own_unit")) {
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
    if (can(user.role, "reports:generate_all") || can(user.role, "reports:generate_own_floor")) {
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

    // Balance: trim to make left and right equal length
    const sideCount = Math.min(leftItems.length, rightItems.length);
    const balancedLeft = leftItems.slice(0, sideCount);
    const balancedRight = rightItems.slice(0, sideCount);

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

  const handleNavClick = (href: string) => {
    router.push(href);
    close();
  };

  return (
    <AppShell
      header={{ height: { base: 50, md: 60 } }}
      navbar={{
        width: { base: 0, md: 240 },
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      footer={{ height: { base: 60, md: 0 } }}
      padding="md"
    >
      {/* Header */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
            />
            <Text fw={700} size="lg">
              {strings.appName}
            </Text>
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
            >
              <IconQrcode size={20} />
            </ActionIcon>

            {/* Dark mode toggle */}
            <ActionIcon
              variant="subtle"
              onClick={() => toggleColorScheme()}
              title={colorScheme === "dark" ? "Mod Siang" : "Mod Gelap"}
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
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar size="sm" radius="xl" color="brandPrimary">
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
                  color="red"
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
      <AppShell.Navbar p="md" hiddenFrom="md" style={{ overflowY: "auto" }}>
        {navItems.map((item) => (
          <NavbarLink
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            onClick={() => handleNavClick(item.href)}
          />
        ))}
      </AppShell.Navbar>

      {/* Navbar (Desktop persistent) */}
      <AppShell.Navbar p="md" visibleFrom="md" style={{ overflowY: "auto" }}>
        {navItems.map((item) => (
          <NavbarLink
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            onClick={() => handleNavClick(item.href)}
          />
        ))}
      </AppShell.Navbar>

      {/* Main content */}
      <AppShell.Main>{children}</AppShell.Main>

      {/* Footer (Mobile tab bar) */}
      <AppShell.Footer hiddenFrom="md" p={0} style={{ 
        background: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-default-border)",
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.05)",
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
              active={pathname === item.href}
              isPrimary={item.isPrimary}
              onClick={() => router.push(item.href)}
            />
          ))}
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}