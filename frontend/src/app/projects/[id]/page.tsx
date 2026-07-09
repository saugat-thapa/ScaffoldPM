"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LayoutGrid,
  List,
  Search,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getProject,
  updateTaskStatus,
  updateTaskAssignment,
  type WBSResponse,
} from "@/lib/api";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  // States
  const [projectData, setProjectData] = useState<WBSResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [criticalFilter, setCriticalFilter] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  // Collapsible Phases State
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(
    {},
  );

  // Kanban Drag States
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isDragOverColumn, setIsDragOverColumn] = useState<
    Record<string, boolean>
  >({});

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProject(id);
      setProjectData(data);

      // Expand all phases by default
      if (data.project.phases) {
        const expanded: Record<string, boolean> = {};
        data.project.phases.forEach((phase: any) => {
          expanded[phase.id] = true;
        });
        setExpandedPhases(expanded);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load project details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  // Collapsible Toggle
  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  // Inline Status Change API Handler
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Optimistic UI update
    setProjectData((prev) => {
      if (!prev) return prev;
      const updatedPhases = prev.project.phases.map((phase: any) => ({
        ...phase,
        activities: phase.activities.map((activity: any) => ({
          ...activity,
          tasks: activity.tasks.map((task: any) =>
            task.id === taskId ? { ...task, status: newStatus } : task,
          ),
        })),
      }));
      return {
        ...prev,
        project: {
          ...prev.project,
          phases: updatedPhases,
        },
      };
    });

    try {
      const updatedTask = await updateTaskStatus(taskId, newStatus);
      // Sync local state with actual backend response
      setProjectData((prev) => {
        if (!prev) return prev;
        const updatedPhases = prev.project.phases.map((phase: any) => ({
          ...phase,
          activities: phase.activities.map((activity: any) => ({
            ...activity,
            tasks: activity.tasks.map((task: any) =>
              task.id === taskId ? { ...task, ...updatedTask } : task,
            ),
          })),
        }));
        return {
          ...prev,
          project: {
            ...prev.project,
            phases: updatedPhases,
          },
        };
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      // Revert state
      fetchProjectDetails();
    }
  };

  // Inline Assignee Change API Handler
  const handleAssigneeChange = async (taskId: string, memberId: string) => {
    const selectedMember = projectData?.project.team.find(
      (m: any) => m.id === memberId,
    );

    // Optimistic UI update
    setProjectData((prev) => {
      if (!prev) return prev;
      const updatedPhases = prev.project.phases.map((phase: any) => ({
        ...phase,
        activities: phase.activities.map((activity: any) => ({
          ...activity,
          tasks: activity.tasks.map((task: any) =>
            task.id === taskId
              ? {
                  ...task,
                  assigned_to: memberId || null,
                  assigned_name: selectedMember
                    ? selectedMember.name
                    : memberId
                      ? "Assigned"
                      : "Unassigned",
                }
              : task,
          ),
        })),
      }));
      return {
        ...prev,
        project: {
          ...prev.project,
          phases: updatedPhases,
        },
      };
    });

    try {
      const updatedTask = await updateTaskAssignment(taskId, memberId);
      // Sync local state
      setProjectData((prev) => {
        if (!prev) return prev;
        const updatedPhases = prev.project.phases.map((phase: any) => ({
          ...phase,
          activities: phase.activities.map((activity: any) => ({
            ...activity,
            tasks: activity.tasks.map((task: any) =>
              task.id === taskId ? { ...task, ...updatedTask } : task,
            ),
          })),
        }));
        return {
          ...prev,
          project: {
            ...prev.project,
            phases: updatedPhases,
          },
        };
      });
    } catch (err) {
      console.error("Failed to update task assignment:", err);
      fetchProjectDetails();
    }
  };

  // Native HTML5 Drag and Drop Handlers for Kanban
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setIsDragOverColumn({});
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!isDragOverColumn[columnId]) {
      setIsDragOverColumn((prev) => ({
        ...prev,
        [columnId]: true,
      }));
    }
  };

  const handleDragLeave = (columnId: string) => {
    setIsDragOverColumn((prev) => ({
      ...prev,
      [columnId]: false,
    }));
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
    setIsDragOverColumn((prev) => ({
      ...prev,
      [targetStatus]: false,
    }));
    if (taskId) {
      handleStatusChange(taskId, targetStatus);
    }
  };

  // Gather all tasks in a flat list for calculations and Kanban
  const allTasks = useMemo(() => {
    if (!projectData?.project.phases) return [];
    const tasks: any[] = [];
    projectData.project.phases.forEach((phase: any) => {
      phase.activities.forEach((activity: any) => {
        activity.tasks.forEach((task: any) => {
          tasks.push({
            ...task,
            phaseTitle: phase.title,
            activityTitle: activity.title,
          });
        });
      });
    });
    return tasks;
  }, [projectData]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description &&
          task.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === "all" || task.task_type === typeFilter;
      const matchesCritical = !criticalFilter || task.is_critical;
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "unassigned" && !task.assigned_to) ||
        task.assigned_to === assigneeFilter;

      return matchesSearch && matchesType && matchesCritical && matchesAssignee;
    });
  }, [allTasks, searchQuery, typeFilter, criticalFilter, assigneeFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (allTasks.length === 0) {
      return { completion: 0, totalHours: 0, criticalCount: 0, doneCount: 0 };
    }
    const doneCount = allTasks.filter((t) => t.status === "done").length;
    const totalHours = allTasks.reduce(
      (sum, t) => sum + (t.estimated_hours || 0),
      0,
    );
    const criticalCount = allTasks.filter((t) => t.is_critical).length;
    const completion = Math.round((doneCount / allTasks.length) * 100);

    return { completion, totalHours, criticalCount, doneCount };
  }, [allTasks]);

  // Avatar helper
  const getInitials = (name: string) => {
    if (!name) return "UN";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    if (!name) return "bg-slate-100 text-slate-500";
    const colors = [
      "bg-red-50 text-red-600 border-red-200",
      "bg-orange-50 text-orange-600 border-orange-200",
      "bg-amber-50 text-amber-600 border-amber-200",
      "bg-emerald-50 text-emerald-600 border-emerald-200",
      "bg-blue-50 text-blue-600 border-blue-200",
      "bg-indigo-50 text-indigo-600 border-indigo-200",
      "bg-purple-50 text-purple-600 border-purple-200",
      "bg-pink-50 text-pink-600 border-pink-200",
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  if (loading) {
    return (
      <div className="flex-1 w-full bg-slate-50 p-8 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-slate-500 font-medium">
          Loading project WBS details...
        </p>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="flex-1 w-full bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto bg-white border border-red-200 rounded-2xl p-8 text-center shadow-xs">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Error Loading Project
          </h2>
          <p className="text-slate-600 mb-6">
            {error || "Project data could not be found."}
          </p>
          <Button
            onClick={() => router.push("/projects")}
            className="bg-primary hover:bg-primary-muted text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { project } = projectData;

  return (
    <main className="flex-1 w-full text-[#505050] p-6 md:p-10 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Back and Breadcrumbs */}
        <div className="flex items-center space-x-3">
          <Link
            href="/projects"
            className="flex items-center text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Project Header Banner */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden">
          <div className="space-y-3 z-10">
            <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span>Project WBS Active</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="text-slate-600 max-w-3xl text-sm leading-relaxed">
              {project.description ||
                "Work breakdown structure generated by AI."}
            </p>

            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-500 font-medium">
              <span className="flex items-center bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                {new Date(project.start_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                -{" "}
                {new Date(project.end_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                {project.total_working_days} Working Days
              </span>
              <span className="flex items-center bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                <Users className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                {project.team.length} Members
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center bg-slate-100 p-1.5 rounded-2xl shrink-0 z-10">
            <button
              onClick={() => setView("table")}
              className={`flex items-center px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                view === "table"
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <List className="w-3.5 h-3.5 mr-2" />
              Table View
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                view === "kanban"
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-2" />
              Kanban View
            </button>
          </div>
        </header>

        {/* Statistics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Completion
                </p>
                <p className="text-3xl font-extrabold text-slate-900">
                  {stats.completion}%
                </p>
                <p className="text-xs text-slate-500">
                  {stats.doneCount} of {allTasks.length} tasks completed
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Workload
                </p>
                <p className="text-3xl font-extrabold text-slate-900">
                  {stats.totalHours} hrs
                </p>
                <p className="text-xs text-slate-500">Total estimated time</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Critical Path
                </p>
                <p className="text-3xl font-extrabold text-red-600">
                  {stats.criticalCount}
                </p>
                <p className="text-xs text-slate-500">
                  Tasks requiring priority focus
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shadow-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Assignees
                </p>
                <p className="text-3xl font-extrabold text-slate-900">
                  {project.team.length}
                </p>
                <p className="text-xs text-slate-500">
                  Active team members allocated
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Filter Toolbar */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search WBS tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FBFBFB] border  hover:border-slate-300 focus:border-primary pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors placeholder:text-slate-400"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-2 bg-[#FBFBFB] border  rounded-xl px-3 py-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[#FBFBFB] text-sm border-none focus:outline-none py-1.5 font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="feature">Feature</option>
                <option value="bugfix">Bugfix</option>
                <option value="documentation">Documentation</option>
                <option value="research">Research</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Assignee Filter */}
            <div className="flex items-center space-x-2 bg-[#FBFBFB]  border rounded-xl px-3 py-1 shrink-0">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="bg-transparent text-sm border-none focus:outline-none py-1.5 font-medium text-slate-700 cursor-pointer max-w-[150px]"
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {project.team.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Critical Path Toggle */}
          <button
            onClick={() => setCriticalFilter(!criticalFilter)}
            className={`inline-flex items-center px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shrink-0 ${
              criticalFilter
                ? "bg-red-50 border-red-200 text-red-700 shadow-xs"
                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 mr-2 ${criticalFilter ? "text-red-600" : "text-slate-400"}`}
            />
            Critical Path Only
          </button>
        </section>

        {/* View Toggle Rendering */}
        {view === "table" ? (
          <section className="space-y-6">
            {project.phases && project.phases.length > 0 ? (
              project.phases.map((phase: any, phaseIndex: number) => {
                const isExpanded = expandedPhases[phase.id] !== false;

                // Get activities matching current filter within this phase
                const filteredActivities = phase.activities
                  .map((activity: any) => {
                    const matchedTasks = activity.tasks.filter((task: any) => {
                      const inFiltered = filteredTasks.some(
                        (ft) => ft.id === task.id,
                      );
                      return inFiltered;
                    });
                    return { ...activity, tasks: matchedTasks };
                  })
                  .filter((activity: any) => activity.tasks.length > 0);

                // Skip phase if no matching tasks
                if (filteredActivities.length === 0) return null;

                // Local phase completion
                const phaseTasks = phase.activities.flatMap(
                  (a: any) => a.tasks,
                );
                const phaseDoneCount = phaseTasks.filter(
                  (t: any) => t.status === "done",
                ).length;
                const phasePercent = phaseTasks.length
                  ? Math.round((phaseDoneCount / phaseTasks.length) * 100)
                  : 0;

                return (
                  <div
                    key={phase.id}
                    className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs"
                  >
                    {/* Phase Header */}
                    <div
                      onClick={() => togglePhase(phase.id)}
                      className="bg-[#f6f6f6] border-b border-slate-200 px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[#f8f8f8] transition-all select-none delay-300"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-slate-800 truncate">
                            {phase.title}
                          </h3>
                          <p className="text-slate-500 text-xs truncate mt-0.5">
                            {phase.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 shrink-0">
                        {/* Progress Badge */}
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${phasePercent}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {phasePercent}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Phase Content (Activities & Tasks) */}
                    {isExpanded && (
                      <div className="p-6 space-y-8 animate-in fade-in duration-200">
                        {filteredActivities.map((activity: any) => (
                          <div key={activity.id} className="space-y-3">
                            {/* Activity Subheader */}
                            <div className="border-l-2 border-primary pl-3 py-0.5">
                              <h4 className="text-sm font-bold text-slate-800">
                                {activity.title}
                              </h4>
                              {activity.description && (
                                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                                  {activity.description}
                                </p>
                              )}
                            </div>

                            {/* Tasks Table */}
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-inner-sm">
                              <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                  <tr className="bg-[#f5f5f5] border-b  text-slate-500 font-semibold text-xs tracking-wider uppercase">
                                    <th className="py-3 px-4 font-semibold w-1/3">
                                      Task Title & Details
                                    </th>
                                    <th className="py-3 px-4 font-semibold">
                                      Type
                                    </th>
                                    <th className="py-3 px-4 font-semibold">
                                      Assignee
                                    </th>
                                    <th className="py-3 px-4 font-semibold">
                                      Status
                                    </th>
                                    <th className="py-3 px-4 font-semibold">
                                      Timeline
                                    </th>
                                    <th className="py-3 px-4 font-semibold text-center">
                                      Slack
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {activity.tasks.map((task: any) => {
                                    const isCritical = task.is_critical;

                                    return (
                                      <tr
                                        key={task.id}
                                        className={`hover:bg-slate-50/50 transition-colors group ${
                                          isCritical ? "bg-red-50/15" : ""
                                        }`}
                                      >
                                        {/* Task Title */}
                                        <td className="py-4 px-4 align-top">
                                          <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                              {isCritical && (
                                                // <span
                                                //   className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-300 text-red-700 shrink-0 shadow-xs"
                                                //   title="Critical Path Task"
                                                // >
                                                //   !
                                                // </span>
                                                <AlertTriangle
                                                  className={`w-6 h-6 mr-2 text-red-500 bg-red-200 rounded-full p-1 `}
                                                />
                                              )}
                                              <span
                                                className={`font-medium text-slate-800 text-[14px] ${isCritical ? "text-red-750" : ""}`}
                                              >
                                                {task.title}
                                              </span>
                                              {/* {isCritical && (
                                                <span className="text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                                  CRITICAL
                                                </span>
                                              )} */}
                                            </div>
                                            {task.description && (
                                              <p className="text-slate-500 text-xs max-w-md font-normal leading-relaxed">
                                                {task.description}
                                              </p>
                                            )}
                                            {task.skills_required &&
                                              task.skills_required.length >
                                                0 && (
                                                <div className="flex flex-wrap gap-1 pt-1.5">
                                                  {task.skills_required.map(
                                                    (
                                                      skill: string,
                                                      sIdx: number,
                                                    ) => (
                                                      <span
                                                        key={sIdx}
                                                        className="bg-slate-100 border border-slate-200 text-slate-650 text-[10px] font-semibold px-2 py-0.5 rounded"
                                                      >
                                                        {skill}
                                                      </span>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                          </div>
                                        </td>

                                        {/* Task Type */}
                                        <td className="py-4 px-4 align-top whitespace-nowrap">
                                          <span
                                            className={`inline-block text-[11px] font-normal uppercase px-2.5 py-1 rounded-lg tracking-wider ${
                                              task.task_type === "bugfix"
                                                ? "text-red-600"
                                                : task.task_type === "feature"
                                                  ? "text-blue-600"
                                                  : task.task_type ===
                                                      "documentation"
                                                    ? "text-emerald-600"
                                                    : task.task_type ===
                                                        "research"
                                                      ? "text-purple-600"
                                                      : "text-slate-600"
                                            }`}
                                          >
                                            {task.task_type}
                                          </span>
                                        </td>

                                        {/* Assignee */}
                                        <td className="py-4 px-4 align-top">
                                          <div className="flex items-center space-x-2">
                                            <div
                                              className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${getAvatarColor(
                                                task.assigned_name,
                                              )}`}
                                            >
                                              {getInitials(task.assigned_name)}
                                            </div>
                                            <select
                                              value={task.assigned_to || ""}
                                              onChange={(e) =>
                                                handleAssigneeChange(
                                                  task.id,
                                                  e.target.value,
                                                )
                                              }
                                              className="bg-transparent border border-slate-200 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-700 hover:border-slate-350 focus:border-primary focus:outline-none transition-colors cursor-pointer"
                                            >
                                              <option value="">
                                                Unassigned
                                              </option>
                                              {project.team.map(
                                                (member: any) => (
                                                  <option
                                                    key={member.id}
                                                    value={member.id}
                                                  >
                                                    {member.name}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                          </div>
                                        </td>

                                        {/* Status */}
                                        <td className="py-4 px-4 align-top">
                                          <select
                                            value={task.status}
                                            onChange={(e) =>
                                              handleStatusChange(
                                                task.id,
                                                e.target.value,
                                              )
                                            }
                                            className={`border rounded-xl text-xs font-bold px-3 py-1.5 focus:outline-none transition-colors cursor-pointer ${
                                              task.status === "done"
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                : task.status === "in_progress"
                                                  ? " border-blue-200 text-blue-700"
                                                  : "bg-slate-50 border-slate-200 text-slate-600"
                                            }`}
                                          >
                                            <option value="todo">To Do</option>
                                            <option value="in_progress">
                                              In Progress
                                            </option>
                                            <option value="done">Done</option>
                                          </select>
                                        </td>

                                        {/* Timeline */}
                                        <td className="py-4 px-4 align-top">
                                          <div className="space-y-1.5 text-xs">
                                            <span className="flex items-center text-slate-700 font-semibold whitespace-nowrap bg-slate-50 border border-slate-100 rounded px-2 py-0.5">
                                              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                                              {task.start_date
                                                ? new Date(
                                                    task.start_date,
                                                  ).toLocaleDateString(
                                                    "en-US",
                                                    {
                                                      month: "short",
                                                      day: "numeric",
                                                    },
                                                  )
                                                : "N/A"}{" "}
                                              -{" "}
                                              {task.end_date
                                                ? new Date(
                                                    task.end_date,
                                                  ).toLocaleDateString(
                                                    "en-US",
                                                    {
                                                      month: "short",
                                                      day: "numeric",
                                                    },
                                                  )
                                                : "N/A"}
                                            </span>
                                            {task.estimated_hours && (
                                              <span className="flex items-center text-slate-500 font-medium whitespace-nowrap px-1">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {task.estimated_hours} hrs est.
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* Slack */}
                                        <td className="py-4 px-4 align-top text-center whitespace-nowrap">
                                          <span
                                            className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${
                                              task.slack === 0
                                                ? "text-red-700 font-normal"
                                                : "text-slate-600 font-normal"
                                            }`}
                                          >
                                            {task.slack} day
                                            {task.slack !== 1 ? "s" : ""}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-slate-350 rounded-2xl bg-white shadow-xs">
                <p className="text-slate-600 font-medium">
                  No phases or tasks available.
                </p>
              </div>
            )}
          </section>
        ) : (
          /* Kanban Board View */
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-x-auto pb-6">
            {["todo", "in_progress", "done"].map((columnStatus) => {
              const columnTitle =
                columnStatus === "todo"
                  ? "To Do"
                  : columnStatus === "in_progress"
                    ? "In Progress"
                    : "Done";

              const columnTasks = filteredTasks.filter(
                (t) => t.status === columnStatus,
              );
              const isOver = isDragOverColumn[columnStatus] === true;

              return (
                <div
                  key={columnStatus}
                  onDragOver={(e) => handleDragOver(e, columnStatus)}
                  onDragLeave={() => handleDragLeave(columnStatus)}
                  onDrop={(e) => handleDrop(e, columnStatus)}
                  className={`flex flex-col bg-white border rounded-xl min-h-[550px] p-4 transition-all duration-300 ${
                    isOver
                      ? "bg-blue-50/50 border-primary ring-2 ring-primary/10 scale-[1.01]"
                      : "border-slate-200"
                  }`}
                  style={{
                    borderTop: `4px solid ${
                      columnStatus === "todo"
                        ? "#64748b"
                        : columnStatus === "in_progress"
                          ? "#2563eb"
                          : "#10b981"
                    }`,
                  }}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          columnStatus === "todo"
                            ? "bg-slate-500"
                            : columnStatus === "in_progress"
                              ? "bg-blue-600"
                              : "bg-emerald-500"
                        }`}
                      ></span>
                      <h3 className="font-bold text-slate-800 text-md">
                        {columnTitle}
                      </h3>
                    </div>
                    <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full shadow-xs">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Card list */}
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {columnTasks.length > 0 ? (
                      columnTasks.map((task) => {
                        const isCritical = task.is_critical;
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            className={`bg-[#FBFBFB] border rounded-lg p-4 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing hover:border-slate-350 transition-all space-y-3 relative group overflow-hidden ${
                              isCritical
                                ? "border-l-4 border-l-red-500"
                                : "border-slate-200"
                            }`}
                          >
                            {/* Card Header details */}
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-md tracking-wider border ${
                                  task.task_type === "bugfix"
                                    ? "bg-red-50 border-red-200 text-red-600"
                                    : task.task_type === "feature"
                                      ? "bg-blue-50 border-blue-200 text-blue-600"
                                      : task.task_type === "documentation"
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                        : task.task_type === "research"
                                          ? "bg-purple-50 border-purple-200 text-purple-600"
                                          : "bg-slate-50 border-slate-200 text-slate-600"
                                }`}
                              >
                                {task.task_type}
                              </span>

                              {isCritical && (
                                <span className="bg-red-100 text-red-700 border border-red-200 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                  CRITICAL
                                </span>
                              )}
                            </div>

                            {/* Card Title */}
                            <div>
                              <h4 className="font-medium text-black text-[13px] leading-snug line-clamp-2">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-505050 text-xs mt-1 line-clamp-2 leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Card metadata (Timeline, Hours) */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-medium border-t border-slate-100">
                              <span className="flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-450" />
                                {task.start_date
                                  ? new Date(
                                      task.start_date,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : ""}{" "}
                                -{" "}
                                {task.end_date
                                  ? new Date(task.end_date).toLocaleDateString(
                                      "en-US",
                                      { month: "short", day: "numeric" },
                                    )
                                  : ""}
                              </span>

                              {task.estimated_hours && (
                                <span className="flex items-center font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  <Clock className="w-3 h-3 mr-1 text-slate-400" />
                                  {task.estimated_hours}h
                                </span>
                              )}
                            </div>

                            {/* Card Footer (Assignee change dropdown & avatar) */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-150">
                              <div className="flex items-center space-x-1.5 w-full">
                                <div
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[9px] shrink-0 ${getAvatarColor(
                                    task.assigned_name,
                                  )}`}
                                >
                                  {getInitials(task.assigned_name)}
                                </div>
                                <select
                                  value={task.assigned_to || ""}
                                  onChange={(e) =>
                                    handleAssigneeChange(
                                      task.id,
                                      e.target.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full bg-transparent border border-slate-200 rounded-lg text-[11px] font-semibold px-2 py-1 text-slate-700 hover:border-slate-300 focus:border-primary focus:outline-none transition-colors cursor-pointer"
                                >
                                  <option value="">Unassigned</option>
                                  {project.team.map((member: any) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-2xl bg-white/70">
                        No tasks in this column.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
