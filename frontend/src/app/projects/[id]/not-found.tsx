import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ProjectNotFound() {
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
          We couldn&apos;t find a project for this URL. It may have been removed, or the link
          may be incomplete.
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
