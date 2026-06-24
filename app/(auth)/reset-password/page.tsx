import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/games");

  const { token } = await searchParams;

  // No token in the link → nothing to redeem. Point the user back to step 1
  // rather than rendering a form that can only fail.
  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Reset link missing</CardTitle>
            <CardDescription>
              This password reset link is incomplete or invalid.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              <Link href="/forgot-password" className="underline underline-offset-4">
                Request a new reset link
              </Link>
            </p>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Enter a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="underline underline-offset-4">
              Back to log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
