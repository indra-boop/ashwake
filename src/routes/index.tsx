import { createFileRoute } from "@tanstack/react-router";
import { Ashwake } from "@/components/game/Ashwake";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Ashwake />;
}
