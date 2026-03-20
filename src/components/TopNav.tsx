"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/ingest", label: "Ingest", icon: "download" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/architect", label: "Architect", icon: "architect" },
  { href: "/dashboard/ai-runs", label: "AI Runs", icon: "activity" },
];

const ADMIN_ITEM = { href: "/admiral", label: "Admiral", icon: "admin" };

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const cn = className || "w-3.5 h-3.5";
  switch (icon) {
    case "grid":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case "download":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    case "folder":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case "activity":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "architect":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25-4.179 2.25m0 0L12 17.25l-5.571-3m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />
        </svg>
      );
    case "admin":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
      );
    default:
      return null;
  }
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function TopNav({ userName, userEmail, userRole, isAdmin }: { userName?: string; userEmail?: string; userRole?: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  const navItems = [...NAV_ITEMS, ...(isAdmin ? [ADMIN_ITEM] : [])];

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "rgba(6, 8, 15, 0.8)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-shadow duration-300 group-hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  boxShadow: "0 0 16px rgba(34, 197, 94, 0.2)",
                }}
              >
                <span className="text-white text-xs font-bold">CL</span>
              </div>
              <span className="font-semibold text-sm hidden sm:inline" style={{ color: "var(--foreground)" }}>
                CortexLab
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`topnav-link flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? "topnav-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <NavIcon icon={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Hamburger for mobile */}
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ color: "var(--foreground-dim)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 hover:ring-2 hover:ring-white/10"
                style={{ background: userName ? nameToColor(userName) : "#475569", color: "#fff" }}
                aria-label="User menu"
              >
                {userName ? getInitials(userName) : "?"}
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-50"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-bright)",
                    boxShadow: "0 0 40px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{userName || "User"}</p>
                    {userEmail && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--foreground-dim)" }}>{userEmail}</p>}
                    {userRole && (
                      <span
                        className="inline-block text-[9px] uppercase tracking-wider font-semibold mt-1.5 px-1.5 py-0.5 rounded"
                        style={{
                          background: (userRole === "ADMIRAL" || userRole === "ADMIN") ? "rgba(201,162,39,0.1)" : "rgba(6,214,214,0.08)",
                          color: (userRole === "ADMIRAL" || userRole === "ADMIN") ? "#c9a227" : "var(--accent-cyan)",
                          border: `1px solid ${(userRole === "ADMIRAL" || userRole === "ADMIN") ? "rgba(201,162,39,0.2)" : "rgba(6,214,214,0.15)"}`,
                        }}
                      >
                        {userRole}
                      </span>
                    )}
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--foreground)" }}
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </Link>
                    <Link
                      href="/dashboard/ai-runs"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--foreground)" }}
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI Runs
                    </Link>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors"
                        style={{ color: "var(--accent-red, #f87171)" }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Logout
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <nav
          className="md:hidden px-4 pb-3 space-y-1"
          style={{ borderTop: "1px solid var(--border)" }}
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${isActive ? "topnav-active" : "topnav-link"}`}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon icon={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
