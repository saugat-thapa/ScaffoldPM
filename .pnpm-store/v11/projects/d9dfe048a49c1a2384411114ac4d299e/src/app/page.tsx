import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center bg-slate-50 text-slate-900 overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full " />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-[120px]" />

      <div className="z-10 text-center px-4 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
        <div className="inline-block px-4 py-1.5 rounded-full border border-slate-200 bg-white/50 backdrop-blur-md text-sm font-medium text-slate-600 mb-4 shadow-sm">
          ✨ Welcome to ScaffoldPM
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600">
          AI-Driven Project Planning <br className="hidden md:block" /> &
          Optimization
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl text-center leading-relaxed">
          Generate comprehensive Work Breakdown Structures, match team members
          to tasks, and automatically analyze critical paths to optimize your
          next project instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-8 w-full justify-center">
          <Link
            href="/projects/new"
            className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all duration-200 bg-blue-600 font-pj rounded-xl hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
          >
            Generate Project Plan
            <svg
              className="w-5 h-5 ml-2 -mr-1 transition-transform group-hover:translate-x-1"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-slate-700 transition-all duration-200 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
          >
            View Projects Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
