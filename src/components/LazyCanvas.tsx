"use client";
import { useRef, useState, useEffect, ReactNode } from "react";

interface LazyCanvasProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
}

export function LazyCanvas({ children, fallback, rootMargin = "200px" }: LazyCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {visible ? children : (fallback || (
        <div style={{
          height: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          color: "var(--foreground-dim)",
          fontSize: 14,
        }}>
          Scroll to load visualization...
        </div>
      ))}
    </div>
  );
}
