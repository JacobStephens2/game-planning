import Link from "next/link";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function Nav({ email }: { email?: string | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between p-4">
        <div className="flex items-center gap-6">
          <Link href="/games" className="font-semibold">
            GamePlan
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/games" className="text-muted-foreground hover:text-foreground">
              Games
            </Link>
            <Link href="/events" className="text-muted-foreground hover:text-foreground">
              Events
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
