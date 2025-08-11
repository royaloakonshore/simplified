import { getServerAuthSession } from "@/lib/auth";
import { redirect } from 'next/navigation';
import { ERPLayoutClient } from '@/components/layout/ERPLayoutClient';
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { SessionProvider } from "@/components/providers/SessionProvider";

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
    <SessionProvider session={session}>
      <BreadcrumbProvider>
        <ERPLayoutClient user={user}>
          {children}
        </ERPLayoutClient>
      </BreadcrumbProvider>
    </SessionProvider>
  );
} 