import { requireUser } from "@/lib/auth";
import { getRecentSearches, getSavedProspects } from "@/lib/prospects";
import { Dashboard } from "@/components/dashboard";

export default async function DashboardPage() {
  const user = await requireUser();
  const [history, saved] = await Promise.all([getRecentSearches(user.id), getSavedProspects(user.id)]);
  return <Dashboard user={user} initialHistory={history} initialSaved={saved} />;
}
