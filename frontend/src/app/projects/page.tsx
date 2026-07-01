import Link from "next/link";
import { getProjects, type ProjectSummary } from "@/lib/api";

export const dynamic = "force-dynamic";


export default async function ProjectsPage() {
  let projects: ProjectSummary[] = [];
  try {
    projects = await getProjects();
  } catch (error) {
    console.error("Failed to load projects:", error);
  }


  return (
    <main className="flex-1 w-full bg-slate-50 text-slate-900 p-8 md:p-16">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Projects Dashboard</h1>
            <p className="text-slate-600 mt-2">Manage your AI-generated project plans</p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white transition-all bg-primary-muted rounded-lg hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 focus:ring-offset-slate-50"
          >
            + New Project
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-300 rounded-xl bg-white">
              <h3 className="text-lg font-medium text-slate-700">No projects found</h3>
              <p className="mt-1 text-slate-500">Get started by generating your first project plan.</p>
            </div>
          ) : (
            projects.map((project) => (
              <Link 
                key={project.id} 
                href={`/projects/${project.id}`}
                className="group p-6 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-xl font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                </div>
                <div className="mt-4 flex items-center text-sm text-slate-500">
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
