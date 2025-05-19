'use client'; // Needs client hooks for path checking

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    FileText,
    Truck,
    Settings as SettingsIcon, // Renamed to avoid conflict
    Building2, // For placeholder team switcher
    type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from 'next-auth';

// Import the new navigation components
import { NavMain } from './nav-main'; // Assuming nav-main.tsx is in the same directory
import { NavUser } from './nav-user';   // Assuming nav-user.tsx is in the same directory
import { TeamSwitcher } from './team-switcher'; // Assuming team-switcher.tsx is in the same directory
// Import Sidebar component and useSidebar hook
import { Sidebar, useSidebar } from "@/components/ui/sidebar";

// Define types for navigation items
interface SubNavItem {
  title: string;
  url: string;
}

interface NavItemDefinition {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: SubNavItem[]; // Sub-items are optional and typed
}

// Placeholder data for TeamSwitcher, adapt as needed
const placeholderTeams = [
  { name: 'My Company', logo: Building2, plan: 'Free Plan' },
  // Add more teams if multi-tenancy is implemented
];

// Adapt existing navItems to the format expected by NavMain
const mainNavItemsData: NavItemDefinition[] = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, items: [] }, // items: [] is valid for SubNavItem[]
    { title: 'Customers', url: '/customers', icon: Users, items: [] },
    { title: 'Inventory', url: '/inventory', icon: Package, items: [] },
    { title: 'Orders', url: '/orders', icon: ShoppingCart, items: [] },
    { title: 'Invoices', url: '/invoices', icon: FileText, items: [] },
    { title: 'Production', url: '/production', icon: Truck, items: [] },
];

interface AppSidebarProps {
  // isCollapsed: boolean; // No longer needed as prop, will use useSidebar hook
  user: Session['user'] | null | undefined;
}

export function AppSidebar({ user }: AppSidebarProps) { // Removed isCollapsed from props
    const pathname = usePathname();
    const { open: isSidebarOpen, isMobile } = useSidebar(); // Get state from context
    // For components that need to react to collapsed state but don't use useSidebar directly:
    // const isEffectivelyCollapsed = isMobile ? false : !isSidebarOpen; // On mobile, sidebar is an overlay, not collapsed

    const processedMainNavItems = mainNavItemsData.map(item => ({
        title: item.title,
        url: item.url,
        icon: item.icon,
        isActive: pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url)),
        items: (item.items && item.items.length > 0) 
               ? item.items.map(subItem => ({ title: subItem.title, url: subItem.url })) 
               : undefined
    }));
    
    const sessionUser = {
        name: user?.name ?? "Guest User",
        email: user?.email ?? "",
        avatar: user?.image ?? "", // NavUser expects avatar prop
    };

    return (
        <Sidebar className="border-r fixed top-0 left-0 z-30 h-full">
            {/* Sidebar component from ui/sidebar.tsx will handle its own width and collapsed state styling */}
            {/* The `p-2` and `border-b/t` might need to be inside SidebarHeader/SidebarFooter if available */}
            <div className="flex flex-col justify-between h-full">
              <div> {/* Top section */}
                <div className={cn("p-2 border-b")}>
                  <TeamSwitcher teams={placeholderTeams} />
                </div>
                <NavMain items={processedMainNavItems} />
              </div>

              <div> {/* Bottom section */}
                <div className={cn("p-2 border-t")}>
                  <NavUser user={sessionUser} />
                </div>
              </div>
            </div>
        </Sidebar>
    );
} 