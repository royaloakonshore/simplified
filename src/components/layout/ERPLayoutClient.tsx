"use client";

import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Session } from 'next-auth';
import {
  SidebarProvider,
  useSidebar,
  SidebarInset
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface ERPLayoutClientProps {
  children: React.ReactNode;
  user: Session['user'] | null | undefined;
}

function LayoutContent({ children, user }: ERPLayoutClientProps) {
  const { open, toggleSidebar, isMobile, openMobile, state: sidebarState } = useSidebar();
  const isSidebarEffectivelyOpen = isMobile ? openMobile : open;

  return (
    <div className={cn("flex h-screen bg-background", isMobile && openMobile ? "overflow-hidden" : "")}>
      <AppSidebar user={user} />

      <SidebarInset className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4 z-10">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2">
            {(!isMobile && sidebarState === 'collapsed') || (isMobile && !openMobile) ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          <Breadcrumbs />
          
          <div className="ml-auto flex items-center space-x-4">
            <ModeToggle />
            <Link href="/auth/logout" passHref legacyBehavior>
              <Button asChild variant="outline" size="sm">
                <a>Sign Out</a>
              </Button>
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6 w-full">
          {children}
        </div>
      </SidebarInset>
    </div>
  );
}

export function ERPLayoutClient({ children, user }: ERPLayoutClientProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <LayoutContent user={user}>{children}</LayoutContent>
    </SidebarProvider>
  );
} 