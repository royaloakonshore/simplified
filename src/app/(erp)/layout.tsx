import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from 'next/navigation';
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

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
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <AppSidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="p-4 border-b border-border bg-card flex justify-between items-center shrink-0">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4 lg:hidden" />
              <h2 className="text-lg font-medium">Welcome, {user.email}</h2>
            </div>
            <div className="flex items-center space-x-4">
              <form action="/api/auth/signout" method="post">
                <Button variant="outline" size="sm" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
} 