import React from "react";
import { getServerAuthSession } from "@/lib/auth"; // Import session utility

export const metadata = {
  title: "Dashboard | ERP System",
  description: "ERP System Dashboard",
};

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  const userName = session?.user?.firstName ?? session?.user?.name ?? 'User'; // Get name

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Welcome, {userName}!</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard title="Customers" value="0" description="Total customers" />
        <DashboardCard title="Inventory" value="0" description="Items in stock" />
        <DashboardCard title="Orders" value="0" description="Active orders" />
        <DashboardCard title="Invoices" value="0" description="Unpaid invoices" />
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-muted-foreground">No recent activity to display.</p>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-3xl font-bold my-2">{value}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
} 