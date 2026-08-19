import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, List, Screen } from "@/components/ui";
import { ShoppingItemRow } from "@/components/interactive";

export const dynamic = "force-dynamic";

const CATS = ["Groceries", "Wedding", "House", "Other"];

export default async function ShoppingPage() {
  const [items, me] = await Promise.all([getRepo().listShopping(), getCurrentUser()]);
  if (!me) return null;

  return (
    <Screen title="Shopping 🛒">
      {items.length === 0 && <EmptyState emoji="😎" title="Shopping list is empty" hint="Looks like we're stocked up." />}
      <div className="flex flex-col gap-4">
        {CATS.map((cat) => {
          const group = items.filter((s) => s.category === cat);
          if (!group.length) return null;
          return (
            <div key={cat}>
              <div className="disp mb-2 text-[15px] font-extrabold">{cat}</div>
              <List>{group.map((it) => <ShoppingItemRow key={it.id} item={it} meId={me.id} />)}</List>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
