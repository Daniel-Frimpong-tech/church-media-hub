import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoryRow, CreateCategoryForm } from "./category-forms";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(`Could not load categories: ${error.message}`);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Categories</h1>
        <p className="text-body text-ink-soft">
          Each new service gets one Drive folder per active category.
        </p>
      </div>

      <section className="flex flex-col">
        <h2 className="text-title-lg text-ink">Current categories</h2>
        <ul className="divide-y divide-hairline-soft">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
        <p className="pt-2 text-body-sm text-muted">
          Retiring a category keeps its existing photos and folders. It only
          stops new services from getting that folder.
        </p>
      </section>

      <Card className="flex flex-col gap-4">
        <h2 className="text-title-lg text-ink">Add a category</h2>
        <CreateCategoryForm />
      </Card>
    </div>
  );
}
