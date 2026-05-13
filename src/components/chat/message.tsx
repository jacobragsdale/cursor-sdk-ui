"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RenderBlock } from "@/components/render/render-block";
import type { AssistantBlock, ChatMessage } from "@/lib/types";
import { ActivityRow } from "./activity-row";

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-[var(--color-accent)]/14 px-4 py-2.5 text-sm leading-6 text-[var(--color-fg)] ring-1 ring-inset ring-[var(--color-accent)]/22 sm:max-w-[720px]">
          {message.text}
        </div>
      </div>
    );
  }

  const hasAnyContent = message.blocks.length > 0;

  return (
    <div className="flex w-full">
      <div className="w-full space-y-3">
        {!hasAnyContent && message.status === "streaming" && (
          <ActivityRow status="running" summary="Preparing analysis" />
        )}
        <Blocks blocks={message.blocks} />
        {message.status === "cancelled" && (
          <div className="text-xs text-[var(--color-fg-dim)]">Stopped.</div>
        )}
      </div>
    </div>
  );
}

function Blocks({ blocks }: { blocks: AssistantBlock[] }) {
  const rendered: ReactNode[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (isKpiRender(block)) {
      const kpis: Extract<AssistantBlock, { kind: "render" }>[] = [block];
      while (isKpiRender(blocks[i + 1])) {
        i += 1;
        kpis.push(blocks[i] as Extract<AssistantBlock, { kind: "render" }>);
      }
      rendered.push(
        <div
          key={kpis.map((kpi) => kpi.id).join(":")}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {kpis.map((kpi) => (
            <RenderBlock key={kpi.id} name={kpi.name} args={kpi.args} />
          ))}
        </div>,
      );
      continue;
    }
    rendered.push(<BlockRenderer key={block.id} block={block} />);
  }

  return rendered;
}

function isKpiRender(
  block: AssistantBlock | undefined,
): block is Extract<AssistantBlock, { kind: "render" }> {
  return block?.kind === "render" && block.name === "render_kpi_card";
}

function BlockRenderer({ block }: { block: AssistantBlock }) {
  switch (block.kind) {
    case "text":
      return (
        <div className="text-sm leading-relaxed text-[var(--color-fg)] [&>*+*]:mt-2 [&_a]:text-[var(--color-accent)] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-[var(--color-fg)] [&_em]:italic [&_code]:rounded [&_code]:bg-[var(--color-surface-3)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-[var(--color-border)] [&_pre]:bg-[var(--color-surface)] [&_pre]:p-3 [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
        </div>
      );
    case "thinking":
      return <ActivityRow name="analysis" status="running" summary="Analyzing request" />;
    case "activity":
      return (
        <ActivityRow
          name={block.name}
          label={block.label}
          status={block.status}
          summary={block.summary}
        />
      );
    case "render":
      return <RenderBlock name={block.name} args={block.args} />;
  }
}
