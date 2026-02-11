import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();

  const [recentProjects, latestRun] = await Promise.all([
    prisma.project.findMany({
      where: { ownerUserId: session.userId! },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        discoveryArtifacts: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    }),
    prisma.ingestRun.findFirst({
      where: { userId: session.userId! },
      orderBy: { startedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Welcome back, {session.name}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/ingest" className="btn-primary text-sm">
          Run Ingest
        </Link>
        <Link href="/projects" className="btn-secondary text-sm">
          Create Project
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Projects
            </h2>
            <Link
              href="/projects"
              className="text-sm text-[#ff6c37] hover:text-[#e5552a]"
            >
              View all &rarr;
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No projects yet.{" "}
              <Link href="/projects" className="text-[#ff6c37]">
                Create one
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project) => {
                const latestArtifact = project.discoveryArtifacts[0];
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {project.name}
                      </p>
                      {project.primaryDomain && (
                        <p className="text-xs text-gray-500">
                          {project.primaryDomain}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {latestArtifact ? (
                        <span className="badge-success">
                          Discovery v{latestArtifact.version}
                        </span>
                      ) : (
                        <span className="badge-warning">No discovery</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Latest Ingest Run */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Latest Ingest Run
          </h2>
          {latestRun ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span
                  className={
                    latestRun.status === "SUCCESS"
                      ? "badge-success"
                      : latestRun.status === "FAILED"
                      ? "badge-error"
                      : "badge-warning"
                  }
                >
                  {latestRun.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Trigger</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {latestRun.trigger}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Items</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {latestRun._count.items}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Time</span>
                <span className="text-xs text-gray-500">
                  {latestRun.startedAt.toLocaleString()}
                </span>
              </div>
              {latestRun.summary && (
                <p className="text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
                  {latestRun.summary}
                </p>
              )}
              <Link
                href="/ingest"
                className="text-sm text-[#ff6c37] hover:text-[#e5552a] block mt-2"
              >
                View all runs &rarr;
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">
              No ingest runs yet.{" "}
              <Link href="/ingest" className="text-[#ff6c37]">
                Run one
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
