"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-lg text-ink">That did not work</h1>
        <p className="text-body text-ink-soft">
          Something went wrong on our side. Your data has not been changed.
        </p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
