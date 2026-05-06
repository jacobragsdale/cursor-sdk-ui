"use client";

import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  onSubmit: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  notice?: string;
}

export function PromptInput({ onSubmit, onStop, streaming, disabled, notice }: PromptInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || streaming || disabled) return;
    onSubmit(value);
    setValue("");
  };

  return (
    <div className="space-y-2">
      {notice && (
        <div className="rounded-md border border-[var(--color-negative)]/35 bg-[var(--color-negative)]/10 px-3 py-2 text-xs text-[var(--color-negative)]">
          {notice}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "relative flex items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 shadow-[0_16px_48px_rgba(0,0,0,0.18)] transition focus-within:border-[var(--color-border-strong)]",
          disabled && "opacity-70",
        )}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          placeholder="Ask for a chart of states, sectors, ratings, or yields..."
          rows={1}
          className="min-h-[28px] max-h-40 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-6 text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type={streaming ? "button" : "submit"}
          onClick={streaming ? onStop : undefined}
          disabled={!streaming && (!value.trim() || disabled)}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition",
            streaming
              ? "bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-fg-muted)]"
              : "bg-[var(--color-accent)] text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30",
          )}
          aria-label={streaming ? "Stop" : "Send"}
        >
          {streaming ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-4" />}
        </button>
      </form>
    </div>
  );
}
