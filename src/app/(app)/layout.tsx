import { Nav } from "@/components/nav";
import { apiGet, fetchCatalog, fetchCurrentUser } from "@/lib/server-api";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await fetchCurrentUser();
  const [{ unread }, catalog] = await Promise.all([apiGet<{ unread: number }>("/api/notifications/unread"), fetchCatalog()]);
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
