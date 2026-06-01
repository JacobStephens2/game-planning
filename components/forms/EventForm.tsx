"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventCreateSchema, type EventCreateInput } from "@/lib/validations/event";
import { createEvent, updateEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GameOption = { id: string; title: string };

type Props =
  | { mode: "create"; games: GameOption[]; event?: undefined }
  | {
      mode: "edit";
      games: GameOption[];
      event: {
        id: string;
        name: string;
        eventDate: string | null; // yyyy-mm-dd
        notes: string | null;
        gameIds: string[];
      };
    };

export function EventForm(props: Props) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EventCreateInput>({
    resolver: zodResolver(eventCreateSchema),
    defaultValues: {
      name: props.event?.name ?? "",
      eventDate: props.event?.eventDate ?? "",
      notes: props.event?.notes ?? "",
      gameIds: props.event?.gameIds ?? [],
    },
  });

  function onSubmit(values: EventCreateInput) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", values.name);
      fd.set("eventDate", values.eventDate ?? "");
      fd.set("notes", values.notes ?? "");
      (values.gameIds ?? []).forEach((id) => fd.append("gameIds", id));
      const res =
        props.mode === "edit" ? await updateEvent(props.event.id, fd) : await createEvent(fd);
      if (res?.fieldErrors?.name) setError("name", { message: res.fieldErrors.name[0] });
      if (res?.error) setError("root", { message: res.error });
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Event name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="eventDate">Date</Label>
        <Input id="eventDate" type="date" {...register("eventDate")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Games to bring</legend>
        {props.games.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no games yet.{" "}
            <Link href="/games/new" className="underline underline-offset-4">
              Add some
            </Link>{" "}
            to include them here.
          </p>
        ) : (
          <ul className="space-y-2 rounded-md border p-3">
            {props.games.map((game) => (
              <li key={game.id} className="flex items-center gap-2">
                <input
                  id={`game-${game.id}`}
                  type="checkbox"
                  value={game.id}
                  className="size-4 accent-primary"
                  {...register("gameIds")}
                />
                <Label htmlFor={`game-${game.id}`} className="font-normal">
                  {game.title}
                </Label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : props.mode === "edit" ? "Save changes" : "Create event"}
      </Button>
    </form>
  );
}
