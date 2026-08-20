import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, Screen } from "@/components/ui";
import { AddShoppingButton, ShoppingList } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const repo = getRepo();
  const [items, users, me] = await Promise.all([repo.listShopping(), repo.listUsers(), getCurrentUser()]);
  if (!me) return null;

  return (
    <Screen title="Shopping 🛒" action={<AddShoppingButton me={me} users={users} />}>
      {items.length === 0 ? (
        <EmptyState emoji="😎" title="Shopping list is empty" hint="Looks like we're stocked up." />
      ) : (
        <ShoppingList items={items} meId={me.id} users={users} />
      )}
    </Screen>
  );
}
