"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteEvent } from "@/actions/events";
import { Button, buttonVariants } from "@/components/ui/button";

export function DeleteEventForm({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteEvent(id);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="destructive" onClick={onDelete} disabled={isPending}>
          {isPending ? "Deleting…" : "Delete event"}
        </Button>
        <Link href={`/events/${id}`} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
