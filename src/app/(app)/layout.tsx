import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/session";
import { getCatalog } from "@/lib/services/catalog";
import { unreadCount } from "@/lib/services/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [unread, catalog] = await Promise.all([unreadCount(user.id), getCatalog()]);
  return (
    <>
      <Nav user={user} unread={unread} teamLabel={catalog.teamLabel(user.team)} />
      {!user.isActive && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Your account is deactivated. You can view tickets but can&apos;t act on them.
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
