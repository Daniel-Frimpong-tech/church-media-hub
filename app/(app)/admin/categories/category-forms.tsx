"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import type { Category } from "@/lib/supabase/database.types";
import { createCategory, setCategoryActive } from "./actions";

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState(
    createCategory,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        label="Category name"
        name="name"
        placeholder="Worship"
        maxLength={40}
        required
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="tablet:self-start">
        {pending ? "Adding…" : "Add category"}
      </Button>
    </form>
  );
}

export function CategoryRow({ category }: { category: Category }) {
  const [state, action, pending] = useActionState(
    setCategoryActive,
    EMPTY_FORM_STATE,
  );

  return (
    <li className="flex flex-col gap-2 py-3">
      <form action={action} className="flex items-center justify-between gap-3">
        <input type="hidden" name="id" value={category.id} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink">{category.name}</span>
          {category.is_active ? null : <Badge>Retired</Badge>}
        </div>
        <Button
          type="submit"
          name="intent"
          value={category.is_active ? "retire" : "restore"}
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={`${category.is_active ? "Retire" : "Restore"} ${category.name}`}
        >
          {category.is_active ? "Retire" : "Restore"}
        </Button>
      </form>
      <FormMessage state={state} />
    </li>
  );
}
