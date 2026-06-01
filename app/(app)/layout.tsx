import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Nav email={session.user.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
      <Footer />
    </div>
  );
}
