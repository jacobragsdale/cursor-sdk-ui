"use client";

import { useModelContext } from "@/components/chat/model-provider";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function ModelPicker() {
  const { models, selectedId, setSelectedId, loading, error } = useModelContext();
  const onSelect = setSelectedId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => models.find((m) => m.id === selectedId),
    [models, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => {
      const hay = `${m.id} ${m.displayName} ${m.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [models, query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = selected?.displayName ?? selectedId;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
          open && "border-[var(--color-border-strong)] text-[var(--color-fg)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[14rem] truncate font-medium">{label}</span>
        <ChevronDown className="size-3 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-[20rem] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-2.5 py-2">
            <Search className="size-3.5 text-[var(--color-fg-dim)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full border-0 bg-transparent text-[12px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-2 text-[11px] text-[var(--color-fg-dim)]">
                Loading models...
              </div>
            )}
            {error && !loading && (
              <div className="px-3 py-2 text-[11px] text-[var(--color-negative)]">
                {error}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-[var(--color-fg-dim)]">
                No models match &ldquo;{query}&rdquo;.
              </div>
            )}
            {!loading &&
              !error &&
              filtered.map((m) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelect(m.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition hover:bg-[var(--color-surface-2)]",
                      active && "bg-[var(--color-surface-2)]",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        active
                          ? "text-[var(--color-accent)]"
                          : "text-transparent",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-[var(--color-fg)]">
                        {m.displayName}
                      </div>
                      <div className="truncate text-[10px] text-[var(--color-fg-dim)]">
                        {m.id}
                      </div>
                      {m.description && (
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--color-fg-muted)]">
                          {m.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
