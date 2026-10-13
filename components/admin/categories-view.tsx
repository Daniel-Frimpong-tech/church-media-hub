import { Clock3, EyeOff, FolderClosed, FolderPlus, Settings2 } from "lucide-react";
import Link from "next/link";
import {
  CategoryActiveToggle,
  CreateCategoryForm,
} from "@/app/(app)/admin/categories/category-forms";
import {
  AddDeliveryForm,
  DeliveryRow,
} from "@/app/(app)/admin/categories/delivery-forms";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { ADD_TILE, AdminHeader } from "./page-header";

export type CategoryCard = {
  id: string;
  name: string;
  isActive: boolean;
  deliveries: { teamId: string; teamName: string; deadlineHours: number }[];
  /** Receiving teams this category is not delivered to yet. */
  availableTeams: { id: string; name: string }[];
};

export type CategoriesData = {
  categories: CategoryCard[];
  hasReceivingTeams: boolean;
  /** Used by preview pages: opens this category's panel. */
  openCategoryId?: string;
};

function deadlineLabel(hours: number): string {
  if (hours === 0) return "at once";
  if (hours % 24 === 0) return hours === 24 ? "1 day" : `${hours / 24} days`;
  return `${hours}h`;
}

/**
 * Categories are the folders every service gets, so each is drawn as a
 * folder: a tab, a name, and what happens to its contents. Tapping one opens
 * its settings.
 */
export function CategoriesView({ data }: { data: CategoriesData }) {
  return (
    <div className="stagger flex flex-col gap-6">
      <AdminHeader
        title="Categories"
        description="Every new service gets one Google Drive folder per category. Open a category to choose which teams receive it, and how soon."
      />

      {data.hasReceivingTeams ? null : (
        <p className="rounded-lg bg-warning-soft p-4 text-body-sm text-warning">
          There are no receiving teams yet.{" "}
          <Link href="/admin/teams" className="font-bold underline">
            Create one
          </Link>{" "}
          (for example Thumbnails) to start delivering categories to it.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 tablet:grid-cols-3 tablet:gap-x-4 desktop:grid-cols-4">
        {data.categories.map((category) => (
          <li key={category.id}>
            <Folder category={category} initiallyOpen={data.openCategoryId === category.id} />
          </li>
        ))}
        <li>
          <Modal
            title="New category"
            description="Services created from now on get a folder for it."
            triggerClassName={cn(ADD_TILE, "mt-3")}
            trigger={
              <>
                <FolderPlus aria-hidden size={24} />
                New category
              </>
            }
          >
            <CreateCategoryForm />
          </Modal>
        </li>
      </ul>
    </div>
  );
}

function Folder({
  category,
  initiallyOpen,
}: {
  category: CategoryCard;
  initiallyOpen: boolean;
}) {
  const tone = category.isActive ? "bg-surface" : "bg-surface/50";

  return (
    <Modal
      title={category.name}
      description={
        category.isActive
          ? "Which teams receive this category, and their deadlines."
          : "Retired: new services no longer get this folder."
      }
      initiallyOpen={initiallyOpen}
      triggerLabel={`Open ${category.name} settings`}
      triggerClassName="group flex h-full w-full flex-col text-left"
      trigger={
        <>
          {/* The folder's tab. */}
          <span
            aria-hidden
            className={cn(
              "h-4 w-2/5 rounded-t-lg transition-colors group-hover:bg-surface-soft",
              tone,
            )}
          />
          <span
            className={cn(
              "flex min-h-40 flex-1 flex-col gap-3 rounded-lg rounded-tl-none p-4 transition-colors group-hover:bg-surface-soft",
              tone,
              !category.isActive && "outline outline-1 -outline-offset-1 outline-dashed outline-hairline",
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <FolderClosed
                aria-hidden
                size={28}
                className={category.isActive ? "text-primary" : "text-muted-soft"}
                fill="currentColor"
                fillOpacity={0.18}
              />
              <Settings2
                aria-hidden
                size={16}
                className="text-muted-soft transition-colors group-hover:text-ink"
              />
            </span>
            <span className="flex flex-col gap-0.5">
              <span
                className={cn(
                  "truncate text-title",
                  category.isActive ? "text-ink" : "text-muted",
                )}
              >
                {category.name}
              </span>
              {category.isActive ? null : (
                <span className="text-caption text-muted-soft">Retired</span>
              )}
            </span>
            <span className="mt-auto flex flex-wrap gap-1.5">
              {category.deliveries.length === 0 ? (
                <Badge tone={category.isActive ? "warning" : "neutral"}>
                  <EyeOff aria-hidden size={11} className="mr-1" />
                  No team
                </Badge>
              ) : (
                category.deliveries.map((delivery) => (
                  <Badge key={delivery.teamId}>
                    {delivery.teamName}
                    <Clock3 aria-hidden size={11} className="mx-1 opacity-70" />
                    {deadlineLabel(delivery.deadlineHours)}
                  </Badge>
                ))
              )}
            </span>
          </span>
        </>
      }
    >
      <section className="flex flex-col gap-2">
        <h3 className="text-label text-muted uppercase">Delivered to</h3>
        {category.deliveries.length === 0 ? (
          <p className="rounded-md bg-warning-soft p-3 text-body-sm text-warning">
            Not delivered to any team, so viewers cannot see this category.
          </p>
        ) : (
          <ul className="divide-y divide-hairline-soft">
            {category.deliveries.map((delivery) => (
              <DeliveryRow
                key={delivery.teamId}
                categoryId={category.id}
                categoryName={category.name}
                teamId={delivery.teamId}
                teamName={delivery.teamName}
                deadlineHours={delivery.deadlineHours}
              />
            ))}
          </ul>
        )}
        {category.isActive && category.availableTeams.length > 0 ? (
          <AddDeliveryForm
            categoryId={category.id}
            categoryName={category.name}
            teams={category.availableTeams}
          />
        ) : null}
        <p className="text-caption text-muted">
          The deadline is counted from when the service starts. Changes apply
          to upcoming services and those from the last two weeks.
        </p>
      </section>

      <section className="flex flex-col gap-2 border-t border-hairline pt-4">
        <h3 className="text-label text-muted uppercase">
          {category.isActive ? "Retire" : "Restore"}
        </h3>
        <p className="text-caption text-muted">
          Retiring keeps existing photos and folders. It only stops new
          services from getting this folder.
        </p>
        <CategoryActiveToggle
          categoryId={category.id}
          categoryName={category.name}
          isActive={category.isActive}
        />
      </section>
    </Modal>
  );
}
