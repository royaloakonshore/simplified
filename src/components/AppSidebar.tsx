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
    Building2,
    ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Session } from 'next-auth'; // For typing the user prop

// Define navigation items with icons
const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Production', href: '/production', icon: Truck }, // Matched to import
    // { name: 'Settings', href: '/settings', icon: Settings }, // Settings will be in user dropdown
];

// Placeholder org data - replace with actual org data from context/session when multi-tenancy is implemented
const CurrentOrg = {
  name: "User's Organization",
};

interface AppSidebarProps {
  isCollapsed: boolean;
  user: Session['user'] | null | undefined; // Accept user from session
}

export function AppSidebar({ isCollapsed, user }: AppSidebarProps) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    };

    const userName = user?.name ?? "Guest";
    const userEmail = user?.email ?? "";
    const userAvatar = user?.image ?? undefined;
    const avatarFallback = userName.substring(0, 2).toUpperCase();

    return (
        <div
            data-collapsed={isCollapsed}
            className={cn(
                "group flex flex-col gap-4 py-2 border-r h-full bg-background transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64"
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

            {/* Footer: User Profile / Settings Button */}
            <div className={cn("mt-auto p-4 border-t", isCollapsed ? "px-2" : "px-4")}>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn("w-full justify-start items-center", isCollapsed ? "justify-center px-0" : "")}>
                            <Avatar className={cn("h-8 w-8", isCollapsed ? "" : "mr-2")}>
                                {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                                <AvatarFallback>{avatarFallback}</AvatarFallback>
                            </Avatar>
                            <span className={cn(isCollapsed ? "hidden" : "block")}>{userName}</span>
                             {!isCollapsed && <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuItem asChild>
                            <Link href="/settings">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </Link>
                        </DropdownMenuItem>
                        {/* Actual Sign Out button should be implemented here or use the one in the header */}
                        <DropdownMenuItem asChild>
                             <Link href="/auth/logout">
                                <Settings className="mr-2 h-4 w-4" /> {/* Replace with Logout icon */}
                                <span>Sign Out</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
} 