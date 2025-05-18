"use client";

import Link from "next/link";
import { useState } from 'react';
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Session } from 'next-auth';

interface ERPLayoutClientProps {
  children: React.ReactNode;
  user: Session['user'] | null | undefined;
}

export function ERPLayoutClient({ children, user }: ERPLayoutClientProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} user={user} />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4 z-10">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2">
            {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
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
        <div className="flex-1 overflow-auto p-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
} 