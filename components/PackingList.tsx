"use client";

import { useState, useTransition } from "react";
import { setPacked } from "@/actions/events";

type Item = { gameId: string; title: string; packed: boolean };

export function PackingList({ eventId, items }: { eventId: string; items: Item[] }) {
  return (
    <ul className="space-y-2 rounded-md border p-3">
      {items.map((item) => (
        <PackingRow key={item.gameId} eventId={eventId} item={item} />
      ))}
    </ul>
  );
}

function PackingRow({ eventId, item }: { eventId: string; item: Item }) {
  const [packed, setPackedState] = useState(item.packed);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !packed;
    setPackedState(next); // optimistic
    startTransition(async () => {
      const res = await setPacked(eventId, item.gameId, next);
      if (res?.error) setPackedState(!next); // revert on failure
    });
  }

  return (
    <li className="flex items-center gap-2">
      <input
        id={`pack-${item.gameId}`}
        type="checkbox"
        checked={packed}
        onChange={toggle}
        disabled={isPending}
        className="size-4 accent-primary"
      />
      <label
        htmlFor={`pack-${item.gameId}`}
        className={packed ? "text-muted-foreground line-through" : ""}
      >
        {item.title}
      </label>
    </li>
  );
}
