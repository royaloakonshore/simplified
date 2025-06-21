"use client";

interface DashboardSiteHeaderProps {
  title: string;
  // children?: React.ReactNode; // For additional controls like date pickers
}

export function DashboardSiteHeader({ title }: DashboardSiteHeaderProps) {
  // const { toggleSidebar, state: sidebarState, isMobile, openMobile } = useSidebar();
  // This header is inside SidebarInset, so the main toggle is in ERPLayoutClient.
  // We might not need a toggle here unless it's a different one.

  return (
    <header className="w-full flex h-16 shrink-0 items-center gap-2 border-b px-4 md:px-6">
      {/* <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 lg:hidden">
        { (isMobile && !openMobile) ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        <span className="sr-only">Toggle sidebar</span>
      </Button>
      <Separator orientation="vertical" className="mr-2 h-6 lg:hidden" /> */}
      <h1 className="text-xl font-semibold">{title}</h1>
      {/* Optional: Placeholder for breadcrumbs or other actions if needed directly in this header */}
      {/* <div className="ml-auto flex items-center gap-2">
        {children}
      </div> */}
    </header>
  );
} 