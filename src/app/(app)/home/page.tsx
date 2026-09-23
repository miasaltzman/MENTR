import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { requireOnboardedUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Home" };

// Placeholder until the dashboard lands; proves the auth guard end to end.
export default async function HomePage() {
  const user = await requireOnboardedUser();
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-2xl font-semibold">You’re signed in</h1>
      <p className="mt-2 text-muted-foreground">{user.email}</p>
      <form action={signOut} className="mt-6">
        <Button variant="outline">Sign out</Button>
      </form>
    </main>
  );
}
