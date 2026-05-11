import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  MouseSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { BoardModel, WorkItem } from "../api/types";

const priorityLabel: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
};

function TaskCard({ task }: { task: WorkItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: String(task.id) });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.55 : 1,
      }
    : undefined;

  const typeRu: Record<string, string> = {
    task: "Задача",
    bug: "Баг",
    feature: "Фича",
    epic: "Эпик",
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style ?? undefined}
      className="k-task"
    >
      <div className="k-task-title">{task.title}</div>
      <div className="k-task-meta">
        <span
          className={`chip chip--pri chip--pri-${task.priority}`}
          style={{ textTransform: "none", letterSpacing: "0", fontWeight: 600 }}
        >
          {priorityLabel[task.priority] ?? task.priority}
        </span>
        <span className="chip chip--pri-low" style={{ fontWeight: 500 }}>
          {typeRu[task.item_type] ?? task.item_type}
        </span>
        <span className="muted" style={{ marginLeft: "auto", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
          #{task.id}
        </span>
      </div>
    </div>
  );
}

function Column({
  sid,
  name,
  tasks,
}: {
  sid: number;
  name: string;
  tasks: WorkItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${sid}` });
  return (
    <div
      ref={setNodeRef}
      className={`k-col${isOver ? " k-col-dragover" : ""}`}
    >
      <div className="k-col-header">
        <span>{name}</span>
        <span className="k-count">{tasks.length}</span>
      </div>
      <div className="k-task-list">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const qc = useQueryClient();

  const { data: boards } = useQuery({
    queryKey: ["boards", pid],
    enabled: !!pid,
    queryFn: async () =>
      apiFetch<BoardModel[]>(`/projects/${pid}/boards/`),
  });

  const { data: items } = useQuery({
    queryKey: ["work-items", pid],
    enabled: !!pid,
    queryFn: () => apiFetch<WorkItem[]>(`/projects/${pid}/work-items/`),
  });

  const primaryBoard =
    boards?.find((b) => b.is_default) ?? boards?.[0] ?? undefined;
  const columns = [...(primaryBoard?.columns ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  const grouped = useMemo(() => {
    const g = new Map<number, WorkItem[]>();
    columns.forEach((c) => {
      g.set(
        c.status,
        [...(items ?? [])]
          .filter((wi) => wi.status === c.status)
          .sort(
            (a, b) => a.position - b.position || a.id - b.id,
          ),
      );
    });
    return g;
  }, [columns, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
  );

  function resolveStatusId(over: DragEndEvent["over"]): number | null {
    if (!over) return null;
    const mCol = /^col-(\d+)$/.exec(String(over.id));
    if (mCol) return Number(mCol[1]);
    const overTaskId = Number(over.id);
    if (!Number.isNaN(overTaskId)) {
      const t = (items ?? []).find((w) => w.id === overTaskId);
      if (t) return t.status;
    }
    return null;
  }

  async function onDragEnd(ev: DragEndEvent) {
    const over = ev.over;
    const activeId = Number(ev.active.id);
    if (!over || Number.isNaN(activeId)) return;
    const newStatus = resolveStatusId(over);
    if (newStatus == null) return;
    const inCol = [...(items ?? [])].filter(
      (w) => w.status === newStatus && w.id !== activeId,
    );
    const nextPos =
      inCol.reduce((mx, w) => Math.max(mx, w.position), -1) + 1;
    await apiFetch(
      `/projects/${pid}/work-items/${activeId}/reorder/`,
      {
        method: "PATCH",
        json: { status: newStatus, position: nextPos },
      },
    );
    qc.invalidateQueries({ queryKey: ["work-items", pid] });
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Канбан</h2>
        <p className="section-subtitle">
          Колонки привязаны к статусам проекта — перетаскивайте карточки между этапами.
        </p>
      </div>
      {!columns.length ? (
        <div className="empty-state">Нет доски колонок для этого проекта.</div>
      ) : (
        <DndContext
          collisionDetection={closestCorners}
          sensors={sensors}
          onDragEnd={onDragEnd}
        >
          <div className="kanban">
            {columns.map((c) => (
              <Column
                key={c.id}
                sid={c.status}
                name={c.status_detail.name}
                tasks={grouped.get(c.status) ?? []}
              />
            ))}
          </div>
        </DndContext>
      )}
      <div className="hint-banner">
        <span aria-hidden style={{ opacity: 0.75 }}>
          ◆
        </span>
        Совет: отпускайте карточку над колонкой — подсветка покажет активную зону дропа.
      </div>
    </div>
  );
}
