import { GameForm } from "@/components/forms/GameForm";

export default function NewGamePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New game</h1>
      <GameForm mode="create" />
    </div>
  );
}
