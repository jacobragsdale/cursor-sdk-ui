import type { z } from "zod";

export interface PackDataTool {
  name: string;
  description: string;
  inputShape: Record<string, z.ZodTypeAny>;
  handler: (args: unknown) => Promise<unknown>;
  label?: string;
}

interface TypedPackDataTool<TArgs> {
  name: string;
  description: string;
  inputShape: Record<string, z.ZodTypeAny>;
  handler: (args: TArgs) => Promise<unknown>;
  label?: string;
}

export interface HeaderMetric {
  label: string;
  value: string;
}

export interface PackHeaderSummary {
  asOf?: string;
  metrics: HeaderMetric[];
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  agentPersona: string;
  promptAddendum: string;
  samplePrompts: SamplePrompt[];
  dataTools: PackDataTool[];
  headerSummary?: () => Promise<PackHeaderSummary> | PackHeaderSummary;
  init?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
}

export interface SamplePrompt {
  label: string;
  prompt: string;
}

export function defineDataTool<TArgs>(t: TypedPackDataTool<TArgs>): PackDataTool {
  return t as unknown as PackDataTool;
}
