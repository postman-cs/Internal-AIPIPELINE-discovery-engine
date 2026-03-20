"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getNotifications, getUnreadCount, markAllRead, markRead } from "@/lib/actions/notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: Date;
}

function groupByDay(items: Notification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayItems: Notification[] = [];
  const earlierItems: Notification[] = [];
  for (const item of items) {
    const d = new Date(item.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) todayItems.push(item);
    else earlierItems.push(item);
  }
  return { todayItems, earlierItems };
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  cascade: { icon: "↻", color: "var(--accent-cyan)" },
  blocker: { icon: "⚠", color: "var(--accent-yellow)" },
  assumption: { icon: "✓", color: "var(--accent-green)" },
  project: { icon: "◨", color: "var(--accent-cyan)" },
  system: { icon: "ℹ", color: "var(--foreground-dim)" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  const loadNotifications = useCallback(() => {
    if (loaded) return;
    getNotifications(30).then((items) => {
      setNotifications(items as Notification[]);
      setLoaded(true);
    }).catch(() => {});
  }, [loaded]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    });
  }

  function handleClick(n: Notification) {
    if (!n.read) {
      startTransition(async () => {
        await markRead(n.id);
        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }
    if (n.linkUrl) {
      setOpen(false);
      router.push(n.linkUrl);
    }
  }

  const { todayItems, earlierItems } = groupByDay(notifications);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
        style={{ color: "var(--foreground-dim)", background: open ? "rgba(255,255,255,0.06)" : "transparent" }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl shadow-2xl overflow-hidden z-50"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-bright)",
            boxShadow: "0 0 40px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium transition-colors"
                style={{ color: "var(--accent-cyan)" }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && loaded && (
              <p className="text-sm text-center py-10" style={{ color: "var(--foreground-dim)" }}>
                No notifications yet
              </p>
            )}

            {todayItems.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold px-4 pt-3 pb-1" style={{ color: "var(--foreground-dim)" }}>
                  Today
                </p>
                {todayItems.map((n) => <NotificationRow key={n.id} notification={n} onClick={() => handleClick(n)} />)}
              </div>
            )}

            {earlierItems.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold px-4 pt-3 pb-1" style={{ color: "var(--foreground-dim)" }}>
                  Earlier
                </p>
                {earlierItems.map((n) => <NotificationRow key={n.id} notification={n} onClick={() => handleClick(n)} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification: n, onClick }: { notification: Notification; onClick: () => void }) {
  const typeInfo = TYPE_ICONS[n.type] ?? TYPE_ICONS.system;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
      style={{
        background: n.read ? "transparent" : "rgba(6, 214, 214, 0.03)",
      }}
    >
      <span
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 mt-0.5"
        style={{ background: "rgba(255,255,255,0.04)", color: typeInfo.color }}
      >
        {typeInfo.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: n.read ? "var(--foreground-muted)" : "var(--foreground)" }}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--foreground-dim)" }}>
            {n.body}
          </p>
        )}
        <p className="text-[10px] mt-1" style={{ color: "var(--foreground-dim)" }}>
          {new Date(n.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      {!n.read && (
        <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: "var(--accent-cyan)" }} />
      )}
    </button>
  );
}
