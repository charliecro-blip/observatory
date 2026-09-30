import Action from "@/components/Action";
import React from "react";
import { useQuery } from "@tanstack/react-query";

type Item = {
  id: number;
  title: string;
  duration?: number;
  kind: "Task" | "Habit";
};
export default function TimingSources({
  testerId,
  onSelect,
}: {
  testerId: string;
  onSelect: (text: string) => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery<Item[]>({
    queryKey: ["timing-workspace-sources", testerId],
    queryFn: async () => {
      const headers = { "x-tester-id": testerId };
      const results = await Promise.all([
        fetch("/api/tasks", { headers }),
        fetch("/api/habits", { headers }),
      ]);
      if (results.some((r) => !r.ok)) throw new Error("Workspace unavailable");
      const [tasks, habits] = await Promise.all(results.map((r) => r.json()));
      if (!Array.isArray(tasks) || !Array.isArray(habits))
        throw new Error("Workspace unavailable");
      return [
        ...tasks
          .filter((t) => t.done !== "true")
          .map((t) => ({
            id: t.id,
            title: t.title,
            duration: t.estMinutes,
            kind: "Task" as const,
          })),
        ...habits.map((h) => ({
          id: h.id,
          title: h.name,
          kind: "Habit" as const,
        })),
      ];
    },
  });
  return (
    <section
      className="timing-source-list"
      aria-label="Time something from your workspace"
    >
      <h2>Find a time for something you already keep here</h2>
      <p>
        Select one task or habit to use its wording in a timing search. Review
        it before searching.
      </p>
      {isLoading && <p role="status">Loading your workspace…</p>}
      {isError && (
        <p role="alert">
          Your workspace items could not load.{" "}
          <Action onClick={() => void refetch()}>Try again</Action>
        </p>
      )}
      {!isLoading && !isError && !data?.length && (
        <p>
          No tasks or habits yet. You can use Find a time without adding any.
        </p>
      )}
      {data?.map((item) => (
        <article key={`${item.kind}-${item.id}`}>
          <div>
            <small>{item.kind}</small>
            <strong>{item.title}</strong>
          </div>
          <Action
            onClick={() =>
              onSelect(
                `${item.title}${item.duration ? ` for ${item.duration} minutes` : ""}`,
              )
            }
          >
            Use in a search
          </Action>
        </article>
      ))}
    </section>
  );
}
