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
    Settings as SettingsIcon,
    QrCode as QrCodeIcon,
    ListChecks, // Icon for Bill of Materials
    type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Session } from 'next-auth';

// Import the new navigation components
import { NavMain } from './nav-main';
import type { NavItemProcessed } from './nav-main'; // Import NavItemProcessed type
import { NavUser } from './nav-user';
import { TeamSwitcher } from './team-switcher'; // Uncommented TeamSwitcher
// Import Sidebar component and useSidebar hook
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    useSidebar
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

// Define types for navigation items
interface NavItemDefinition {
  title: string;
  url: string; // Main URL for the collapsible trigger or direct link
  icon?: LucideIcon;
  subItems?: Array<{ title: string; url: string; isActive?: boolean }>; // Renamed from items to subItems for clarity
  isCollapsible?: boolean;
  isActive?: boolean; // Added for processing
}

// Placeholder data for TeamSwitcher, adapt as needed
// const placeholderTeams = [
//   { name: 'My Company', logo: Building2, plan: 'Free Plan' },
// ];

// New navigation structure
const dashboardNavItem: NavItemDefinition[] = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
];

const customerNavItems: NavItemDefinition[] = [
    { 
        title: 'Customers', 
        url: '/customers', // Main link for the "Customers" item itself
        icon: Users,
        isCollapsible: true,
        subItems: [
            { title: 'View All Customers', url: '/customers' },
            { title: 'Add New Customer', url: '/customers/add' }
        ]
    },
    { 
        title: 'Orders', 
        url: '/orders', 
        icon: ShoppingCart,
        isCollapsible: true,
        subItems: [
            { title: 'View All Orders', url: '/orders' },
            { title: 'Create New Order', url: '/orders/add' } // Assuming /add for consistency
        ]
    },
    { 
        title: 'Invoices', 
        url: '/invoices', 
        icon: FileText,
        isCollapsible: true,
        subItems: [
            { title: 'View All Invoices', url: '/invoices' },
            { title: 'Create New Invoice', url: '/invoices/add' } // Assuming /add
        ]
    },
];

const productionNavItems: NavItemDefinition[] = [
    { 
        title: 'Inventory', 
        url: '/inventory', 
        icon: Package,
        isCollapsible: true,
        subItems: [
            { title: 'View All Items', url: '/inventory' },
            { title: 'Add New Item', url: '/inventory/add' },
            { title: 'Price List', url: '/inventory/pricelist' },
            { title: 'Replenishment', url: '/inventory/replenishment' }
        ]
    },
    { 
        title: 'Bill of Materials', 
        url: '/boms', 
        icon: ListChecks,
        isCollapsible: true,
        subItems: [
            { title: 'View All BOMs', url: '/boms' },
            { title: 'Create New BOM', url: '/boms/add' }
        ]
    },
    { title: 'Production', url: '/production', icon: Truck }, // Assuming not collapsible for now, can be adjusted
];

const scanNavItem: NavItemDefinition[] = [ // Scan page remains separate for now
    { title: 'Scan', url: '/scan', icon: QrCodeIcon },
];

const settingsNavItem: NavItemDefinition[] = [
    { title: 'Settings', url: '/settings', icon: SettingsIcon },
];


interface AppSidebarProps {
  user: Session['user'] | null | undefined;
}

export function AppSidebar({ user }: AppSidebarProps) {
    const pathname = usePathname();
    const { isMobile, state: sidebarState } = useSidebar();

    const processNavItems = (items: NavItemDefinition[]): NavItemProcessed[] => { // Output type matches NavMain input
        return items.map(item => {
            const baseIsActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url) && !item.subItems);
            let subItemsActive = false;
            const processedSubItems = item.subItems?.map(sub => {
                const isActive = pathname === sub.url || (pathname.startsWith(sub.url) && sub.url !== item.url); // More precise sub-item active check
                if (isActive) subItemsActive = true;
                return { ...sub, isActive };
            });

            return {
                ...item,
                isActive: baseIsActive || (item.isCollapsible && subItemsActive) || false,
                items: processedSubItems, // This maps to NavItemProcessed['items']
            };
        });
    };
    
    const processedDashboardItem = processNavItems(dashboardNavItem);
    const processedCustomerItems = processNavItems(customerNavItems);
    const processedProductionItems = processNavItems(productionNavItems);
    const processedScanItem = processNavItems(scanNavItem);
    const processedSettingsItem = processNavItems(settingsNavItem);
    
    const sessionUser = {
        name: user?.name ?? "Guest User",
        email: user?.email ?? "",
        avatar: user?.image ?? "",
    };

    const isIconMode = !isMobile && sidebarState === 'collapsed';

    return (
        <Sidebar collapsible="icon" className="border-r fixed top-0 left-0 z-30 h-full group">
            <SidebarHeader className="p-4 justify-center border-b border-sidebar-border">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="relative">
                        <Avatar className="h-10 w-10 rounded-lg ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-300">
                            <AvatarImage src="/logo.png" alt="Simplified ERP Logo" className="object-contain" />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-sm">
                                ERP
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                    </div>
                    <div 
                        className={cn(
                            "flex flex-col transition-all duration-300 ease-in-out",
                            isIconMode 
                                ? "opacity-0 w-0 pointer-events-none overflow-hidden"
                                : "opacity-100 w-auto"
                        )}
                    >
                        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent whitespace-nowrap">
                            Simplified
                        </span>
                        <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase whitespace-nowrap">
                            Manufacturing ERP
                        </span>
                    </div>
                </Link>
            </SidebarHeader>
            <SidebarHeader className="p-2">
                <TeamSwitcher />
            </SidebarHeader>
            <SidebarContent className="p-0 flex flex-col justify-between">
                <div>
                    <NavMain items={processedDashboardItem} />
                    
                    {/* Customers Section */}
                    {!isIconMode && <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customers</div>}
                    <NavMain items={processedCustomerItems} />

                    {/* Production Section */}
                    {!isIconMode && <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Production</div>}
                    <NavMain items={processedProductionItems} />
                    
                    <NavMain items={processedScanItem} />
                </div>
                
                {/* Settings link at the bottom */}
                <div>
                    <NavMain items={processedSettingsItem} />
                </div>
            </SidebarContent>
            <SidebarFooter className="p-2 border-t">
                <NavUser user={sessionUser} />
            </SidebarFooter>
        </Sidebar>
    );
} 