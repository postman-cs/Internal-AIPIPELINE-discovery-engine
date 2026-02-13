"use client";

import { useState, useRef, type ReactNode, type DragEvent } from "react";

interface DragDropZoneProps {
  onFileDrop: (files: File[]) => void;
  onTextDrop?: (text: string) => void;
  accept?: string;  // e.g. "image/*,.txt,.md,.pdf"
  maxSizeMB?: number;
  children?: ReactNode;
  className?: string;
}

export function DragDropZone({
  onFileDrop,
  onTextDrop,
  accept,
  maxSizeMB = 10,
  children,
  className,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    // Check for files first (takes priority over text data)
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
      return;
    }

    // Fall back to text drop
    const text = e.dataTransfer.getData("text/plain");
    if (text && onTextDrop) {
      onTextDrop(text);
    }
  };

  /** Check if a file matches the accept filter (e.g. "image/*,.txt,.pdf") */
  const matchesAccept = (file: File): boolean => {
    if (!accept) return true;
    const rules = accept.split(",").map((r) => r.trim());
    return rules.some((rule) => {
      if (rule.endsWith("/*")) {
        return file.type.startsWith(rule.replace("/*", "/"));
      }
      if (rule.startsWith(".")) {
        return file.name.toLowerCase().endsWith(rule.toLowerCase());
      }
      return file.type === rule;
    });
  };

  const processFiles = (files: File[]) => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!matchesAccept(file)) {
        errors.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`${file.name}: exceeds ${maxSizeMB}MB limit`);
        continue;
      }
      valid.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join("; "));
    }

    if (valid.length > 0) {
      onFileDrop(valid);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      role="region"
      aria-label="File upload drop zone"
      className={`relative rounded-lg transition-all duration-200 ${className || ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? "var(--accent-cyan)" : "var(--border-bright)"}`,
        background: isDragging ? "rgba(6, 214, 214, 0.04)" : "transparent",
        boxShadow: isDragging ? "inset 0 0 20px rgba(6, 214, 214, 0.05)" : "none",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileInput}
        className="hidden"
        aria-label="Upload files"
      />

      {children || (
        <div
          className="flex flex-col items-center justify-center py-8 px-4 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg
            className="w-8 h-8 mb-2"
            style={{ color: isDragging ? "var(--accent-cyan)" : "var(--foreground-dim)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
            {isDragging ? "Drop files here" : "Drag & drop files, or click to browse"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>
            Images, text files, PDFs — up to {maxSizeMB}MB
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-center py-1" style={{ color: "var(--accent-red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
