"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
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
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add category"}
      </Button>
    </form>
  );
}

/** Retire a category, or bring a retired one back. */
export function CategoryActiveToggle({
  categoryId,
  categoryName,
  isActive,
}: {
  categoryId: string;
  categoryName: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(
    setCategoryActive,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={categoryId} />
      <Button
        type="submit"
        name="intent"
        value={isActive ? "retire" : "restore"}
        variant={isActive ? "danger" : "secondary"}
        size="sm"
        disabled={pending}
        className="self-start"
        aria-label={`${isActive ? "Retire" : "Restore"} ${categoryName}`}
      >
        {isActive ? "Retire this category" : "Restore this category"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
