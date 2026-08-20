import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, Screen } from "@/components/ui";
import { PhotoGallery } from "@/components/photo-gallery";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const repo = getRepo();
  const [photos, me] = await Promise.all([repo.listPhotos(), getCurrentUser()]);
  if (!me) return null;

  return (
    <Screen title="Photos 📷" sub={photos.length ? `${photos.length} shared` : undefined}>
      <PhotoGallery photos={photos} meId={me.id} isAdmin={me.is_admin} />
      {photos.length === 0 && (
        <div className="mt-4">
          <EmptyState emoji="📸" title="No photos yet" hint="Add the first one — everyone in the family can see and download them." />
        </div>
      )}
    </Screen>
  );
}
