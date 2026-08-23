"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FolderOpen, Loader2 } from "lucide-react";

import { getProjects, type ProjectSummary } from "@/lib/api";

export function ProjectsDashboardClient() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setState("loading");

      try {
        const response = await getProjects();
        if (!active) {
          return;
        }

        setProjects(response);
        setState("success");
      } catch (error) {
        console.error("Failed to load projects:", error);
        if (!active) {
          return;
        }

        setState("error");
      }
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex-1 w-full bg-[#F6F6F6] text-slate-900 p-8 md:p-16">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Projects Dashboard
            </h1>
            <p className="mt-2 text-slate-600">
              Manage your AI-generated project plans
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary-muted px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-slate-50"
          >
            + New Project
          </Link>
        </header>

        {state === "loading" ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-slate-300 bg-white text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <h3 className="mt-4 text-lg font-medium text-slate-800">
              Loading projects
            </h3>
            <p className="mt-1 text-slate-500">
              Fetching all saved project plans from the database.
            </p>
          </div>
        ) : null}

        {state === "error" ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-red-100 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-slate-800">
              Unable to load projects
            </h3>
            <p className="mt-1 max-w-md text-slate-500">
              The dashboard couldn&apos;t fetch the saved project list even
              though projects may already exist in the database.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Retry
            </button>
          </div>
        ) : null}

        {state === "success" ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.length === 0 ? (
              <div className="col-span-full rounded-xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-slate-700">
                  No projects found
                </h3>
                <p className="mt-1 text-slate-500">
                  Get started by generating your first project plan.
                </p>
              </div>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group rounded-xl border border-slate-300 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
                      {project.name}
                    </h3>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-slate-500">
                    <svg
                      className="mr-1.5 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
