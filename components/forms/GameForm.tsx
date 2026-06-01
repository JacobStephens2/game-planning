"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { gameCreateSchema, type GameCreateInput } from "@/lib/validations/game";
import { createGame, updateGame } from "@/actions/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props =
  | { mode: "create"; game?: undefined }
  | { mode: "edit"; game: { id: string; title: string; description: string | null } };

export function GameForm(props: Props) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<GameCreateInput>({
    resolver: zodResolver(gameCreateSchema),
    defaultValues: {
      title: props.game?.title ?? "",
      description: props.game?.description ?? "",
    },
  });

  function onSubmit(values: GameCreateInput) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", values.title);
      fd.set("description", values.description ?? "");
      const res =
        props.mode === "edit" ? await updateGame(props.game.id, fd) : await createGame(fd);
      // On success the action redirects; only errors come back here.
      if (res?.fieldErrors?.title) setError("title", { message: res.fieldErrors.title[0] });
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
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={5} {...register("description")} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : props.mode === "edit" ? "Save changes" : "Create game"}
      </Button>
    </form>
  );
}
