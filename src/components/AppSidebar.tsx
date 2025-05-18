'use client'; // Needs client hooks for path checking

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    FileText,
    Truck,
    Settings,
    Building2, // For Org
    UserCircle, // For User
    ChevronLeft, // For collapse button
    ChevronsUpDown, // For org switcher dropdown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define navigation items with icons
const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Production', href: '/production', icon: Truck },
    // { name: 'Settings', href: '/settings', icon: Settings }, // Settings will be in user dropdown
];

// Placeholder user and org data - replace with actual data fetching
const CurrentUser = {
  name: "User Name",
  email: "user@example.com",
  avatarFallback: "UN",
  // company: { name: "Current Org" } // Example for multi-tenancy
};

const CurrentOrg = {
  name: "User's Organization",
  // availableOrgs: [{id: "1", name: "Org 1"}, {id: "2", name: "Org 2"}], // For switcher
  // isAdmin: false // To control switcher visibility/functionality
};

export function AppSidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false); // Default to open, or true for default collapsed

    const isActive = (href: string) => {
        // Basic check: current path starts with the nav item's href
        // More specific checks might be needed for nested routes
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    };

    return (
        <div
            data-collapsed={isCollapsed}
            className={cn(
                "group flex flex-col gap-4 py-2 border-r h-full bg-background transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64" // Adjusted width, v0.dev usually uses specific rem values
            )}
        >
            {/* Organization Switcher Area */}
            <div className={cn("p-4 border-b", isCollapsed ? "px-2" : "px-4")}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start items-center", isCollapsed ? "justify-center px-0" : "")}>
                            <Building2 className={cn("h-5 w-5", isCollapsed ? "" : "mr-2")} />
                            <span className={cn(isCollapsed ? "hidden" : "block")}>{CurrentOrg.name}</span>
                            {!isCollapsed && <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuItem>Switch Org (Placeholder)</DropdownMenuItem>
                        {/* Add logic for org switching when multi-tenancy is ready */}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-2 space-y-1">
                {navItems.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-primary hover:bg-muted",
                            isActive(item.href) && "bg-muted text-primary font-medium",
                            isCollapsed ? "justify-center" : ""
                        )}
                    >
                        <item.icon className={cn("h-5 w-5", isCollapsed ? "" : "mr-3")} />
                        <span className={cn(isCollapsed ? "hidden" : "block")}>{item.name}</span>
                    </Link>
                ))}
            </nav>

            {/* Footer: User and Collapse Button */}
            <div className={cn("mt-auto p-4 border-t", isCollapsed ? "px-2" : "px-4")}>
                {/* User Profile / Settings Button */}
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn("w-full justify-start items-center", isCollapsed ? "justify-center px-0" : "")}>
                            <Avatar className={cn("h-8 w-8", isCollapsed ? "" : "mr-2")}>
                                <AvatarFallback>{CurrentUser.avatarFallback}</AvatarFallback>
                            </Avatar>
                            <span className={cn(isCollapsed ? "hidden" : "block")}>{CurrentUser.name}</span>
                             {!isCollapsed && <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuItem asChild>
                            <Link href="/settings"> {/* Link to main settings page */}
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Logout (Placeholder)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Collapse Button - Placed at the bottom of the sidebar */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="mt-4 h-10 w-full flex items-center justify-center"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <ChevronLeft className={cn("h-5 w-5 transition-transform duration-300", isCollapsed && "rotate-180")} />
                    <span className="sr-only">{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
                </Button>
            </div>
        </div>
    );
} 