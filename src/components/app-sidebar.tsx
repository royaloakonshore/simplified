"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileText,
  Factory,
  Settings,
  // Lucide Icons for nav items - example, replace as needed
  // AudioWaveform,
  // BookOpen,
  // Bot,
  // Command,
  // Frame,
  // GalleryVerticalEnd,
  // Map,
  // PieChart,
  // Settings2,
  // SquareTerminal,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
// import { NavProjects } from "@/components/nav-projects" // Removed
import { NavUser } from "@/components/nav-user"
// import { TeamSwitcher } from "@/components/team-switcher" // Removed
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  // SidebarTrigger, // Not directly used here, but part of the system
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar" // Added for NavUser default

// This is sample data.
// const data = { ... } // Sample data removed

// Explicitly import LucideIcon type
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const user = session?.user
    ? {
        name: session.user.name ?? "User",
        email: session.user.email ?? "",
        avatar: session.user.image ?? "", // Assuming 'image' is the avatar URL from session
      }
    : {
        name: "Guest User",
        email: "",
        avatar: "", // Provide a default or leave empty
      }

  const navMainItems: NavItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
    },
    {
      title: "Customers",
      url: "/customers",
      icon: Users,
      isActive: pathname.startsWith("/customers"),
    },
    {
      title: "Inventory",
      url: "/inventory",
      icon: Package,
      isActive: pathname.startsWith("/inventory"),
    },
    {
      title: "Orders",
      url: "/orders",
      icon: ShoppingCart,
      isActive: pathname.startsWith("/orders"),
    },
    {
      title: "Invoices",
      url: "/invoices",
      icon: FileText,
      isActive: pathname.startsWith("/invoices"),
    },
    {
      title: "Production",
      url: "/production",
      icon: Factory,
      isActive: pathname.startsWith("/production"),
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      isActive: pathname.startsWith("/settings"),
    },
  ]

  // Placeholder for projects if needed later
  // const projects = [ ... ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4 justify-center">
        {/* <TeamSwitcher teams={data.teams} /> */}
        {/* Replace TeamSwitcher with a simple logo or title */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src="/logo.png" alt="App Logo" />
            <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">ERP</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-lg">SimplifiedERP</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        {/* <NavProjects projects={projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
