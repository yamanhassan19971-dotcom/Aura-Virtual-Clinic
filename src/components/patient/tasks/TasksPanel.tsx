"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PatientTask, TaskStatus } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";
import { createTaskAction, updateTaskStatusAction } from "@/lib/actions/patient-record-actions";

type TaskRow = PatientTask & { assignedTo: { name: string } | null; createdBy: { name: string } | null };
type UserOption = { id: string; name: string };

const STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function TaskRowItem({ task, canManage, onChange }: { task: TaskRow; canManage: boolean; onChange: (t: TaskRow) => void }) {
  const t = useTranslations("tasks");
  const locale = useLocale();
  const toast = useToast();
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(status: TaskStatus) {
    setUpdating(true);
    const result = await updateTaskStatusAction({ taskId: task.id, status });
    setUpdating(false);
    if (result.ok) {
      // The service returns the bare row without relations — merge onto the
      // existing row so the assignee/creator names displayed don't vanish.
      const updated = result.data as PatientTask;
      onChange({ ...task, status: updated.status, completedAt: updated.completedAt });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  const isDone = task.status === "COMPLETED" || task.status === "CANCELLED";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-white p-3">
      <div>
        <p className={`text-sm font-medium ${isDone ? "text-gray-400 line-through" : "text-[var(--color-text)]"}`}>{task.title}</p>
        <p className="text-xs text-gray-500">
          {t("assignedTo")}: {task.assignedTo?.name ?? t("unassigned")}
          {task.dueAt && ` · ${t("dueDate")}: ${formatLongDate(task.dueAt, locale)}`}
        </p>
      </div>
      {canManage ? (
        <select
          value={task.status}
          disabled={updating}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs font-medium text-gray-500">{t(`status.${task.status}`)}</span>
      )}
    </li>
  );
}

export function TasksPanel({
  patientId,
  tasks: initialTasks,
  users,
  canManage,
}: {
  patientId: string;
  tasks: TaskRow[];
  users: UserOption[];
  canManage: boolean;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [tasks, setTasks] = useState(initialTasks);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createTaskAction({
      patientId,
      title,
      assignedToUserId: assignedToUserId || null,
      dueAt: dueAt || null,
    });
    setSubmitting(false);
    if (result.ok) {
      // The service returns the bare row without relations — attach display
      // names from what we already have client-side.
      const created = result.data as PatientTask;
      const assignedTo = users.find((u) => u.id === created.assignedToUserId) ?? null;
      setTasks((prev) => [{ ...created, assignedTo, createdBy: null }, ...prev]);
      setTitle("");
      setAssignedToUserId("");
      setDueAt("");
      setAdding(false);
      toast.show(tCommon("save"), { tone: "success" });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  const open = tasks.filter((task) => task.status === "OPEN" || task.status === "IN_PROGRESS");
  const closed = tasks.filter((task) => task.status === "COMPLETED" || task.status === "CANCELLED");

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>
        {canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("addTask")}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4 sm:flex-row sm:items-end sm:flex-wrap">
          <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm font-medium text-gray-700">
            {t("taskTitle")}
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("assignedTo")}
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">{t("unassigned")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("dueDate")}
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {t("addTask")}
            </button>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {open.map((task) => (
              <TaskRowItem key={task.id} task={task} canManage={canManage} onChange={(u) => setTasks((prev) => prev.map((p) => (p.id === u.id ? u : p)))} />
            ))}
          </ul>
          {closed.length > 0 && (
            <ul className="flex flex-col gap-2 opacity-70">
              {closed.map((task) => (
                <TaskRowItem key={task.id} task={task} canManage={canManage} onChange={(u) => setTasks((prev) => prev.map((p) => (p.id === u.id ? u : p)))} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
