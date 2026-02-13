"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

interface Project {
  id: string;
  name: string;
  primaryDomain: string | null;
  isPinned: boolean;
  updatedAt: string;
  discoveryVersion: number | null;
}

type SortKey = "name" | "updated" | "pinned";

export function ProjectList({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("pinned");
  const [filterDiscovery, setFilterDiscovery] = useState<"all" | "yes" | "no">("all");

  const filtered = useMemo(() => {
    let list = [...projects];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.primaryDomain?.toLowerCase().includes(q) ?? false)
      );
    }

    // Discovery filter
    if (filterDiscovery === "yes") list = list.filter((p) => p.discoveryVersion !== null);
    if (filterDiscovery === "no") list = list.filter((p) => p.discoveryVersion === null);

    // Sort
    list.sort((a, b) => {
      if (sort === "pinned") {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return list;
  }, [projects, search, sort, filterDiscovery]);

  return (
    <div>
      {/* Search & Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            fill="none" viewBox="0 0 24 24" stroke="var(--foreground-dim)" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field text-sm pl-9 w-full"
            aria-label="Search projects"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input-field text-xs w-auto"
          aria-label="Sort projects"
        >
          <option value="pinned">Pinned first</option>
          <option value="updated">Recently updated</option>
          <option value="name">Name A-Z</option>
        </select>
        <select
          value={filterDiscovery}
          onChange={(e) => setFilterDiscovery(e.target.value as "all" | "yes" | "no")}
          className="input-field text-xs w-auto"
          aria-label="Filter by discovery"
        >
          <option value="all">All projects</option>
          <option value="yes">Has discovery</option>
          <option value="no">No discovery</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--foreground-dim)" }}>
        {filtered.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
      </p>

      {/* List */}
      {projects.length === 0 ? (
        <div className="card text-center py-12">
          <p className="mb-4" style={{ color: "var(--foreground-muted)" }}>No projects yet</p>
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            Create your first project using the form &rarr;
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No projects match your search</p>
          <button
            onClick={() => { setSearch(""); setFilterDiscovery("all"); }}
            className="text-xs mt-2"
            style={{ color: "var(--accent-cyan)" }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="card-glow block transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {project.isPinned && (
                      <span className="text-[10px]" style={{ color: "var(--accent-yellow)" }} title="Pinned">⊛</span>
                    )}
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {project.name}
                    </h3>
                  </div>
                  {project.primaryDomain && (
                    <p className="text-sm mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                      {project.primaryDomain}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {project.discoveryVersion !== null ? (
                    <span className="badge-success">
                      Discovery v{project.discoveryVersion}
                    </span>
                  ) : (
                    <span className="badge-warning">No discovery</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
