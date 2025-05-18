import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from 'next/navigation';
import { AppSidebar } from "@/components/AppSidebar";
// Removing SidebarProvider and SidebarTrigger as they are no longer used in this file.
// import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"; 
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { Separator } from "@/components/ui/separator";

export default async function ERPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
      redirect('/api/auth/signin');
  }
  const user = session.user;

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4 z-10">
          {/* SidebarTrigger was removed as SessionNavBar handles its own collapse */}
          <Separator orientation="vertical" className="mr-2 h-6" />
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