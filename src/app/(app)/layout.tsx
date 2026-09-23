import { BottomNav, SideNav } from "@/components/app/app-nav";
import { isMockAI } from "@/lib/ai/provider";
import { requireOnboardedUser } from "@/lib/auth/guards";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireOnboardedUser();
  const demo = isMockAI();
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        {demo ? (
          <p className="px-4 pt-3 text-center text-[11px] text-muted-foreground">
            Demo mode · guidance comes from built-in rules, not a live AI model
          </p>
        ) : null}
        <main className="flex-1 pb-24 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
