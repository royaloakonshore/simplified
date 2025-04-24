import Link from "next/link";
import { requireSession } from "@/lib/supabase/auth";

// Sidebar navigation items
const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Customers", href: "/customers" },
  { name: "Inventory", href: "/inventory" },
  { name: "Orders", href: "/orders" },
  { name: "Invoices", href: "/invoices" },
  { name: "Fulfillment", href: "/fulfillment" },
  { name: "Settings", href: "/settings" },
];

export default async function ERPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated using Supabase
  const session = await requireSession();
  const user = session.user;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-semibold">Simplified ERP</h1>
        </div>
        <nav className="p-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="block px-3 py-2 rounded-md hover:bg-secondary text-foreground hover:text-foreground-foreground transition-colors"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="p-4 border-b border-border bg-card">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Welcome, {user.email}</h2>
            <div className="flex items-center space-x-4">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
} 