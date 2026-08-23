"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Columns3,
  Flame,
  FolderKanban,
  Loader2,
  Rows3,
  SearchX,
  Users,
} from "lucide-react";

import {
  ApiError,
  getProject,
  type TaskStatus,
  type WBSResponse,
  updateTaskStatus as updateTaskStatusApi,
} from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusStyles: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800 line-clamp-1",
  done: "bg-emerald-100 text-emerald-800",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

function formatDate(dateString?: string | null) {
  if (!dateString) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function formatHours(hours?: number | null) {
  if (hours == null) {
    return "Unestimated";
  }

  return `${hours}h`;
}

function countTasks(phases: WBSResponse["project"]["phases"]) {
  return phases.reduce(
    (phaseTotal, phase) =>
      phaseTotal +
      phase.activities.reduce(
        (activityTotal, activity) => activityTotal + activity.tasks.length,
        0,
      ),
    0,
  );
}

function flattenTasks(phases: WBSResponse["project"]["phases"]) {
  return phases.flatMap((phase) =>
    phase.activities.flatMap((activity) =>
      activity.tasks.map((task) => ({
        phaseId: phase.id,
        phaseOrder: phase.order,
        phaseTitle: phase.title,
        activityId: activity.id,
        activityTitle: activity.title,
        task,
      })),
    ),
  );
}

const kanbanColumns: Array<{
  key: TaskStatus;
  title: string;
  subtitle: string;
}> = [
  { key: "todo", title: "To Do", subtitle: "Queued and ready to start" },
  {
    key: "in_progress",
    title: "In Progress",
    subtitle: "Actively being worked on",
  },
  { key: "done", title: "Done", subtitle: "Completed deliverables" },
];

function getEffectiveTeamMembers(data: WBSResponse) {
  if (data.project.team.length > 0) {
    return data.project.team;
  }

  const fallbackMembers = new Map<
    string,
    {
      id: string;
      name: string;
      role: string;
      experience: string;
      skills: string[];
    }
  >();

  for (const phase of data.project.phases) {
    for (const activity of phase.activities) {
      for (const task of activity.tasks) {
        if (!task.assigned_name) {
          continue;
        }

        const fallbackId = task.assigned_to || task.assigned_name;
        if (!fallbackMembers.has(fallbackId)) {
          fallbackMembers.set(fallbackId, {
            id: fallbackId,
            name: task.assigned_name,
            role: "Assigned team member",
            experience: "n/a",
            skills: [],
          });
        }
      }
    }
  }

  return [...fallbackMembers.values()];
}

export function ProjectDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<WBSResponse | null>(null);
  const [state, setState] = useState<
    "loading" | "success" | "not-found" | "error"
  >("loading");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [collapsedPhaseIds, setCollapsedPhaseIds] = useState<Set<string>>(
    new Set(),
  );

  // Drag-and-drop state
  const [taskStatusOverrides, setTaskStatusOverrides] = useState<
    Record<string, TaskStatus>
  >({});
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const draggingTaskId = useRef<string | null>(null);

  function handleDragStart(taskId: string) {
    draggingTaskId.current = taskId;
  }

  function handleDragEnd() {
    draggingTaskId.current = null;
    setDragOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, column: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(column);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(targetStatus: TaskStatus) {
    const taskId = draggingTaskId.current;
    if (!taskId) return;

    // Find current status (respecting overrides)
    const allRows = data ? flattenTasks(data.project.phases) : [];
    const row = allRows.find((r) => r.task.id === taskId);
    const currentStatus: TaskStatus =
      taskStatusOverrides[taskId] ?? row?.task.status ?? "todo";

    if (currentStatus === targetStatus) {
      setDragOverColumn(null);
      return;
    }

    // Optimistic update
    setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: targetStatus }));
    setDragOverColumn(null);

    try {
      await updateTaskStatusApi(taskId, targetStatus);
    } catch {
      // Rollback
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: currentStatus }));
    }
  }

  useEffect(() => {
    let active = true;

    async function loadProject() {
      setState("loading");

      try {
        const response = await getProject(id);
        if (!active) {
          return;
        }

        setData(response);
        setState("success");
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          setState("not-found");
          return;
        }

        setState("error");
      }
    }

    loadProject();

    return () => {
      active = false;
    };
  }, [id]);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <div className="max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-900">
            Loading project plan
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Fetching the generated work breakdown structure and schedule
            details.
          </p>
        </div>
      </main>
    );
  }

  if (state === "not-found") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <div className="max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <SearchX className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-slate-900">
            Project not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We couldn&apos;t find a project for this URL. It may have been
            removed, or the link may be incomplete.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Back to dashboard
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Generate a project
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <div className="max-w-lg rounded-[32px] border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-slate-900">
            Unable to load this project
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The project was created, but the frontend couldn&apos;t load its
            detail view. Please retry from the dashboard or generate the plan
            again.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Return to dashboard
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Generate another plan
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { project, total_duration_days } = data;
  const taskCount = countTasks(project.phases);
  const taskRows = flattenTasks(project.phases);
  const criticalTaskCount = taskRows.filter(
    ({ task }) => task.is_critical,
  ).length;
  const unassignedTaskCount = taskRows.filter(
    ({ task }) => !task.assigned_name,
  ).length;
  const effectiveTeamMembers = getEffectiveTeamMembers(data);
  const visibleTaskRows = criticalOnly
    ? taskRows.filter(({ task }) => task.is_critical)
    : taskRows;
  const visiblePhaseSections = project.phases
    .map((phase) => ({
      phase,
      rows: visibleTaskRows.filter(({ phaseId }) => phaseId === phase.id),
    }))
    .filter(({ rows }) => rows.length > 0);

  function togglePhase(phaseId: string) {
    setCollapsedPhaseIds((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#F6F6F6] text-slate-900 p-8 md:p-16">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                Project Plan
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                {project.name}
              </h1>
              <p className="mt-3  text-base leading-7 text-slate-600">
                {project.description || "No project description was provided."}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-sm p-2 px-3 bg-white border-[#dedede] border rounded-2xl">
                Created: {formatDate(project.created_at)}
              </span>
              <span className="text-sm p-2 px-3 bg-white border-[#dedede] border rounded-2xl">
                Tasks: {taskCount}
              </span>
              <span className="text-sm p-2 px-3 bg-white border-[#dedede] border rounded-2xl">
                Working Days: {project.total_working_days}
              </span>
              <span className="text-sm p-2 px-3 bg-white border-[#dedede] border rounded-2xl">
                Panned Duration: {project.total_working_days}
              </span>
              <span className="text-sm p-2 px-3 bg-white border-[#dedede] border rounded-2xl">
                Critical Tasks: {criticalTaskCount}
              </span>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center rounded-2xl border border-slate-300 bg-white p-6 ">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Project window</p>
                <p className="font-semibold text-slate-900">
                  {formatDate(project.start_date)} -{" "}
                  {formatDate(project.end_date)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center rounded-2xl border border-slate-300 bg-white p-6 ">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Phases</p>
                <p className="font-semibold text-slate-900">
                  {project.phases.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center rounded-2xl border border-slate-300 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Team members</p>
                <p className="font-semibold text-slate-900">
                  {effectiveTeamMembers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center rounded-2xl border border-slate-300 bg-white p-6 ">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Task estimates</p>
                <p className="font-semibold text-slate-900">
                  {project.phases.some((phase) =>
                    phase.activities.some((activity) =>
                      activity.tasks.some(
                        (task) => task.estimated_hours != null,
                      ),
                    ),
                  )
                    ? "Available"
                    : "Pending"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="sticky top-4 z-10 border-b border-slate-100 bg-white px-6 py-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Work Breakdown Structure
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                      Tasks by view
                    </h2>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="inline-flex rounded-2xl bg-[#F6F6F6] border border-[#DEDEDE] p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                          viewMode === "table"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <Rows3 className="h-4 w-4" />
                        Table view
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("kanban")}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                          viewMode === "kanban"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <Columns3 className="h-4 w-4" />
                        Kanban view
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCriticalOnly((value) => !value)}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        criticalOnly
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                    >
                      <Flame className="h-4 w-4" />
                      {criticalOnly
                        ? "Showing critical only"
                        : "Critical tasks only"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-[#DEDEDE] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      Visible tasks
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-blue-700">
                      {visibleTaskRows.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#DEDEDE] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      Critical tasks
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-red-700">
                      {criticalTaskCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#DEDEDE] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      Unassigned tasks
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-purple-700">
                      {unassignedTaskCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#DEDEDE] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      Selected team
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-green-700">
                      {effectiveTeamMembers.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {visibleTaskRows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Flame className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">
                  No tasks match this filter
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This project does not currently have tasks in the selected
                  view/filter combination.
                </p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className=" text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-6 py-4 font-semibold">Task</th>
                      <th className="px-6 py-4 font-semibold">Phase</th>
                      <th className="px-6 py-4 font-semibold">Activity</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Assignee</th>
                      <th className="px-6 py-4 font-semibold">Estimate</th>
                      <th className="px-6 py-4 font-semibold">Schedule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePhaseSections.map(({ phase, rows }) => {
                      const isCollapsed = collapsedPhaseIds.has(phase.id);

                      return (
                        <Fragment key={phase.id}>
                          <tr className="border-b border-slate-200 bg-white ">
                            <td colSpan={7} className="px-4 py-3 ">
                              <button
                                type="button"
                                onClick={() => togglePhase(phase.id)}
                                className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left transition-colors bg-white hover:bg-[#F1F1F1]"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-slate-500">
                                    {isCollapsed ? (
                                      <ChevronRight className="h-5 w-5" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5" />
                                    )}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      Phase {phase.order}: {phase.title}
                                    </p>
                                    {phase.description ? (
                                      <p className="mt-1 text-sm text-slate-500">
                                        {phase.description}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                                  {rows.length} tasks
                                </span>
                              </button>
                            </td>
                          </tr>
                          {!isCollapsed
                            ? rows.map(
                                ({
                                  phaseId,
                                  phaseOrder,
                                  phaseTitle,
                                  activityId,
                                  activityTitle,
                                  task,
                                }) => (
                                  <tr
                                    key={`${phaseId}-${activityId}-${task.id}`}
                                    className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50/60"
                                  >
                                    <td className="px-6 py-5">
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-semibold text-slate-900">
                                            {task.title}
                                          </p>
                                          {task.is_critical ? (
                                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                              Critical
                                            </span>
                                          ) : null}
                                        </div>
                                        {task.description ? (
                                          <p className="max-w-md text-sm leading-6 text-slate-600">
                                            {task.description}
                                          </p>
                                        ) : null}
                                        {task.skills_required.length > 0 ? (
                                          <div className="flex flex-wrap gap-2">
                                            {task.skills_required.map(
                                              (skill) => (
                                                <span
                                                  key={skill}
                                                  className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                                                >
                                                  {skill}
                                                </span>
                                              ),
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-700">
                                      <div className="min-w-[150px]">
                                        <p className="font-semibold text-slate-900">
                                          Phase {phaseOrder}
                                        </p>
                                        <p className="mt-1 text-slate-600">
                                          {phaseTitle}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-700">
                                      <div className="min-w-[150px]">
                                        <p className="font-medium text-slate-800">
                                          {activityTitle}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-6 py-5">
                                      <span
                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold  ${statusStyles[task.status]}`}
                                      >
                                        {statusLabels[task.status]}
                                      </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-medium text-slate-800">
                                      {task.assigned_name || "Unassigned"}
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-700">
                                      {formatHours(task.estimated_hours)}
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-700">
                                      <div>
                                        <p>{formatDate(task.start_date)}</p>
                                        <p className="mt-1 text-slate-500">
                                          to {formatDate(task.end_date)}
                                        </p>
                                      </div>
                                    </td>
                                  </tr>
                                ),
                              )
                            : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-5 px-6 py-6 xl:grid-cols-3">
                {kanbanColumns.map((column) => {
                  // Apply local status overrides for display
                  const columnTasks = visibleTaskRows.filter(({ task }) => {
                    const effectiveStatus =
                      taskStatusOverrides[task.id] ?? task.status;
                    return effectiveStatus === column.key;
                  });
                  const isOver = dragOverColumn === column.key;

                  return (
                    <section
                      key={column.key}
                      onDragOver={(e) => handleDragOver(e, column.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={() => handleDrop(column.key)}
                      className={`rounded-3xl border p-4 transition-colors duration-150 ${
                        column.key === "todo"
                          ? "border-slate-400 bg-slate-50"
                          : column.key === "in_progress"
                            ? "border-amber-400 bg-amber-50"
                            : "border-emerald-400 bg-emerald-50"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded-full border-2 ${
                                column.key === "todo"
                                  ? "bg-[#CCCCCC] border-[#A1A1A1]"
                                  : column.key === "in_progress"
                                    ? "bg-[#FFE3CE] border-[#FF8B32]"
                                    : "bg-[#EAFFDB] border-[#00640F]"
                              }`}
                            ></div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {column.title}
                            </h3>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {column.subtitle}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                            column.key === "todo"
                              ? "text-[#A1A1A1]"
                              : column.key === "in_progress"
                                ? "text-[#FF8B32]"
                                : "text-[#00640F]"
                          }`}
                        >
                          {columnTasks.length}
                        </span>
                      </div>

                      <div className="min-h-[60px] space-y-3">
                        {columnTasks.length === 0 ? (
                          <div
                            className={`rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition-colors ${
                              isOver
                                ? "border-slate-400 bg-white text-slate-600"
                                : "border-slate-200 bg-[#FBFBFB] text-slate-500"
                            }`}
                          >
                            {isOver ? "Drop here" : "No tasks in this column"}
                          </div>
                        ) : (
                          columnTasks.map(
                            ({
                              phaseId,
                              phaseOrder,
                              phaseTitle,
                              activityId,
                              activityTitle,
                              task,
                            }) => (
                              <Tooltip
                                key={`${phaseId}-${activityId}-${task.id}`}
                              >
                                <TooltipTrigger
                                  render={
                                    <article
                                      draggable
                                      onDragStart={() =>
                                        handleDragStart(task.id)
                                      }
                                      onDragEnd={handleDragEnd}
                                      className="cursor-grab select-none rounded-2xl border border-[#CCCCCC] bg-white px-4 py-3 transition-all hover:border-slate-400 hover:shadow-sm active:scale-[0.98] active:cursor-grabbing active:opacity-60"
                                    >
                                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                                        {task.title}
                                      </p>
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="line-clamp-1 text-xs text-slate-500">
                                          {task.assigned_name || "Unassigned"}
                                        </p>
                                        <span
                                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            task.is_critical
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-slate-100 text-slate-600"
                                          }`}
                                        >
                                          {task.is_critical
                                            ? "Critical"
                                            : "Non-critical"}
                                        </span>
                                      </div>
                                    </article>
                                  }
                                />
                                <TooltipContent
                                  side="top"
                                  align="start"
                                  sideOffset={10}
                                  className="max-w-sm flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl"
                                  arrowClassName="bg-primary fill-primary"
                                >
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {task.title}
                                      </p>
                                      {task.is_critical ? (
                                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                          Critical
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-900">
                                      Phase {phaseOrder} / {activityTitle}
                                    </p>
                                  </div>

                                  {task.description ? (
                                    <p className="text-sm leading-6 text-slate-600">
                                      {task.description}
                                    </p>
                                  ) : null}

                                  <div className="grid w-full grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                                        Phase
                                      </p>
                                      <p className="mt-1 text-slate-600">
                                        {phaseTitle}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                                        Activity
                                      </p>
                                      <p className="mt-1 text-slate-600">
                                        {activityTitle}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                                        Assignee
                                      </p>
                                      <p className="mt-1 text-slate-600">
                                        {task.assigned_name || "Unassigned"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                                        Estimate
                                      </p>
                                      <p className="mt-1 text-slate-600">
                                        {formatHours(task.estimated_hours)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="w-full">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                                      Schedule
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {formatDate(task.start_date)} -{" "}
                                      {formatDate(task.end_date)}
                                    </p>
                                  </div>

                                  {task.skills_required.length > 0 ? (
                                    <div className="flex w-full flex-wrap gap-2">
                                      {task.skills_required.map((skill) => (
                                        <span
                                          key={skill}
                                          className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </TooltipContent>
                              </Tooltip>
                            ),
                          )
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
