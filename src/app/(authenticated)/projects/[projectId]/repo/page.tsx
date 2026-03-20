import { getProject } from "@/lib/actions/projects";
import { getRepoStatus, getRepoTree } from "@/lib/actions/repo";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { RepoHub } from "./RepoHub";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const status = await getRepoStatus(projectId);
  let tree: Awaited<ReturnType<typeof getRepoTree>>["tree"] | undefined;
  if (status.configured && !status.error) {
    const treeResult = await getRepoTree(projectId).catch(() => ({ tree: undefined }));
    tree = treeResult.tree;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Repo: {project.name}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          {status.configured
            ? `Connected to ${project.gitProvider}/${project.gitRepoOwner}/${project.gitRepoName}`
            : "Initialize or connect a repo to deliver the engagement package"}
        </p>
      </div>

      <RepoHub
        projectId={projectId}
        projectName={project.name}
        configured={status.configured}
        repoUrl={status.repoUrl}
        lastPushAt={status.lastPushAt?.toISOString() ?? null}
        lastPrUrl={status.lastPrUrl ?? null}
        prStatus={status.prStatus ?? null}
        tree={tree ?? null}
        gitProvider={project.gitProvider}
        gitRepoOwner={project.gitRepoOwner}
        gitRepoName={project.gitRepoName}
        hasGitToken={!!project.gitToken}
      />
    </div>
  );
}
