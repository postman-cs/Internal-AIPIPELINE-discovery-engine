import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="text-center max-w-2xl px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#ff6c37] flex items-center justify-center mx-auto mb-8">
          <span className="text-white text-2xl font-bold">AI</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-4">
          AI Pipeline
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          Postman CSE Discovery & Intelligence Workflow
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-8 max-w-md mx-auto">
          Ingest signals, build customer intelligence, and generate structured
          discovery briefs to accelerate your CSE engagements.
        </p>
        <Link
          href="/login"
          className="btn-primary inline-block text-base px-8 py-3"
        >
          Log In
        </Link>
      </div>
      <footer className="absolute bottom-6 text-xs text-gray-400 dark:text-gray-600">
        Internal tool &middot; Postman CSE Team
      </footer>
    </div>
  );
}
