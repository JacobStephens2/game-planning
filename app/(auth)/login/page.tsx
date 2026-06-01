import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/forms/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/games");

  const { registered } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to GamePlan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {registered && (
            <p className="text-sm text-green-600 dark:text-green-500">
              Account created — please log in.
            </p>
          )}
          <LoginForm />
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Need an account?{" "}
            <Link href="/sign-up" className="underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
