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
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    useSidebar
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'; // Added for NavUser default

// Define types for navigation items
interface SubNavItem {
  title: string;
  url: string;
  // icon is typically not used for sub-items in this design, but can be added
}

interface NavItemDefinition {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: SubNavItem[];
  isCollapsible?: boolean; // To indicate if it should have a chevron
}

// Placeholder data for TeamSwitcher, adapt as needed
const placeholderTeams = [
  { name: 'My Company', logo: Building2, plan: 'Free Plan' },
  // Add more teams if multi-tenancy is implemented
];

// Adapt existing navItems to the format expected by NavMain
const mainNavItemsData: NavItemDefinition[] = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, isCollapsible: false },
    {
        title: 'Customers',
        url: '/customers', // Main link to view all customers
        icon: Users,
        isCollapsible: true, // Make it collapsible to house sub-items
        items: [
            { title: 'View All Customers', url: '/customers' },
            { title: 'New Customer', url: '/customers/add' },
        ],
    },
    {
        title: 'Inventory',
        url: '/inventory',
        icon: Package,
        isCollapsible: true,
        items: [
            { title: 'View All', url: '/inventory' }, // Explicit "View All" or main link
            { title: 'New Item', url: '/inventory/add' },
            { title: 'Replenishment', url: '/inventory/replenishment' }, // Placeholder URL
            { title: 'Price List', url: '/inventory/price-list' },       // Placeholder URL
        ],
    },
    {
        title: 'Orders',
        url: '/orders',
        icon: ShoppingCart,
        isCollapsible: true,
        items: [
            { title: 'View All', url: '/orders' },
            { title: 'New Order', url: '/orders/add' },
        ],
    },
    {
        title: 'Invoices',
        url: '/invoices',
        icon: FileText,
        isCollapsible: true,
        items: [
            { title: 'View All', url: '/invoices' },
            { title: 'New Invoice', url: '/invoices/add' },
        ],
    },
    { title: 'Production', url: '/production', icon: Truck, isCollapsible: false },
    { title: 'Settings', url: '/settings', icon: SettingsIcon, isCollapsible: false },
];

interface AppSidebarProps {
  user: Session['user'] | null | undefined;
}

export function AppSidebar({ user }: AppSidebarProps) {
    const pathname = usePathname();
    const { open: isSidebarOpen, isMobile, state: sidebarState } = useSidebar();

    const processedMainNavItems = mainNavItemsData.map(item => ({
        ...item,
        isActive: pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url)),
        // Sub-items also need to be processed if we want to mark active parent based on active sub-item
        items: item.items?.map(subItem => ({
            ...subItem,
            isActive: pathname === subItem.url || pathname.startsWith(subItem.url)
        }))
    }));
    
    const sessionUser = {
        name: user?.name ?? "Guest User",
        email: user?.email ?? "",
        avatar: user?.image ?? "",
    };

    // Determine if the sidebar is in icon-only mode for NavMain tooltip conditional logic
    const isIconMode = !isMobile && sidebarState === 'collapsed';

    return (
        <Sidebar collapsible="icon" className="border-r fixed top-0 left-0 z-30 h-full group">
            <SidebarHeader className="p-2 justify-center border-b">
                <Link href="/dashboard" className="flex items-center gap-2 ">
                    <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src="/logo.png" alt="App Logo" />
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">ERP</AvatarFallback>
                    </Avatar>
                    <span 
                        className={cn(
                            "font-semibold text-lg whitespace-nowrap transition-opacity duration-200", 
                            isIconMode ? "opacity-0 w-0" : "opacity-100 w-auto",
                            "group-hover:opacity-100 group-hover:w-auto delay-150 group-hover:delay-0"
                        )}
                    >
                        SimplifiedERP
                    </span>
                </Link>
            </SidebarHeader>
            <SidebarContent className="p-0">
                <NavMain items={processedMainNavItems} isIconMode={isIconMode} />
            </SidebarContent>
            <SidebarFooter className="p-2 border-t">
                <NavUser user={sessionUser} />
            </SidebarFooter>
        </Sidebar>
    );
} 