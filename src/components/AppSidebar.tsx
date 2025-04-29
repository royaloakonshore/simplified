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
    Settings,
    Building2, // Placeholder icon for company name
} from 'lucide-react';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

// Define navigation items with icons
const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Fulfillment', href: '/fulfillment', icon: Truck },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        // Basic check: current path starts with the nav item's href
        // More specific checks might be needed for nested routes
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    };

    return (
        <Sidebar className="border-r">
            <SidebarHeader className="border-b flex items-center p-4">
                <Building2 className="h-6 w-6 mr-2" />
                <span className="font-semibold text-lg">Simplified ERP</span>
            </SidebarHeader>
            <SidebarContent className="flex-1 overflow-y-auto">
                <SidebarGroup>
                    {/* Optional Group Label if needed: <SidebarGroupLabel>Application</SidebarGroupLabel> */}
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton
                                        asChild
                                        // Use data attribute for active state styling
                                        data-active={isActive(item.href)}
                                        className={cn(
                                            'group w-full justify-start',
                                            // Custom active styles (can be themed via CSS variables)
                                            isActive(item.href) &&
                                                'bg-sidebar-accent text-sidebar-accent-foreground'
                                        )}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
                                            <span className="group-data-[collapsible=icon]:hidden">
                                                {item.name}
                                            </span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            {/* <SidebarFooter>
                 Add footer content if needed 
            </SidebarFooter> */}
        </Sidebar>
    );
} 