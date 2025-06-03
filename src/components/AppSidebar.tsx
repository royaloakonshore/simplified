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
    Building2, // For placeholder team switcher
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
// import { TeamSwitcher } from './team-switcher'; // TeamSwitcher not used in current layout
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
            { title: 'Add New Item', url: '/inventory/add' }
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
            <SidebarHeader className="p-2 justify-center"> {/* Removed border-b */}
                <Link href="/dashboard" className="flex items-center gap-2 ">
                    <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src="/logo.png" alt="App Logo" />
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">ERP</AvatarFallback>
                    </Avatar>
                    <span 
                        className={cn(
                            "font-semibold text-lg whitespace-nowrap transition-opacity duration-300 ease-in-out",
                            isIconMode 
                                ? "opacity-0 w-0 pointer-events-none"
                                : "opacity-100 w-auto ml-2"
                        )}
                    >
                        SimplifiedERP
                    </span>
                </Link>
            </SidebarHeader>
            <SidebarContent className="p-0 flex flex-col justify-between">
                <div>
                    <NavMain items={processedDashboardItem} isIconMode={isIconMode} />
                    
                    {/* Customers Section */}
                    {!isIconMode && <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customers</div>}
                    <NavMain items={processedCustomerItems} isIconMode={isIconMode} />

                    {/* Production Section */}
                    {!isIconMode && <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Production</div>}
                    <NavMain items={processedProductionItems} isIconMode={isIconMode} />
                    
                    <NavMain items={processedScanItem} isIconMode={isIconMode} />
                </div>
                
                {/* Settings link at the bottom */}
                <div>
                    <NavMain items={processedSettingsItem} isIconMode={isIconMode} />
                </div>
            </SidebarContent>
            <SidebarFooter className="p-2 border-t">
                <NavUser user={sessionUser} />
            </SidebarFooter>
        </Sidebar>
    );
} 