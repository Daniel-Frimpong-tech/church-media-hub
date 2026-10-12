"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/domain/time";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";
const GENERIC_ERROR = "Could not save. Check your connection and try again.";

export async function createCategory(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { error: "Give the category a name." };
  if (name.length > 40) return { error: "Keep the name under 40 characters." };

  const slug = slugify(name);
  if (!slug) return { error: "Use letters or numbers in the name." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .insert({ name, slug, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `There is already a category called ${name}.` };
    }
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/admin/categories");
  return {
    success: `${name} added. Services created from now on get a ${name} folder.`,
  };
}

export async function setCategoryActive(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = formData.get("id");
  const intent = formData.get("intent");
  if (typeof id !== "string" || !id) return { error: "Category not found." };
  if (intent !== "retire" && intent !== "restore") {
    return { error: "Unknown action." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: intent === "restore" })
    .eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/admin/categories");
  return {};
}
