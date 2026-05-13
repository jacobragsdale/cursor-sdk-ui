import type { Pack, PackDataTool } from "./types";

const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;
const TOOL_NAME_RE = /^[a-z][a-z0-9_]*$/;
const SEPARATOR = "__";

export interface RegisteredTool {
  pack: Pack;
  tool: PackDataTool;
  prefixedName: string;
}

export function validatePacks(packs: Pack[]): void {
  if (packs.length === 0) {
    throw new Error(
      "No packs are enabled. Add at least one pack to `src/packs.config.ts`.",
    );
  }
  const seenPackIds = new Set<string>();
  for (const pack of packs) {
    if (!PACK_ID_RE.test(pack.id)) {
      throw new Error(
        `Pack id "${pack.id}" is invalid; must match ${PACK_ID_RE.source}.`,
      );
    }
    if (seenPackIds.has(pack.id)) {
      throw new Error(`Duplicate pack id "${pack.id}" in enabledPacks.`);
    }
    seenPackIds.add(pack.id);
    const seenToolNames = new Set<string>();
    for (const tool of pack.dataTools) {
      if (!TOOL_NAME_RE.test(tool.name)) {
        throw new Error(
          `Pack "${pack.id}" tool name "${tool.name}" is invalid; must match ${TOOL_NAME_RE.source}.`,
        );
      }
      if (tool.name.startsWith("render_")) {
        throw new Error(
          `Pack "${pack.id}" tool name "${tool.name}" must not start with "render_" (reserved for render tools).`,
        );
      }
      if (seenToolNames.has(tool.name)) {
        throw new Error(
          `Pack "${pack.id}" declares tool "${tool.name}" more than once.`,
        );
      }
      seenToolNames.add(tool.name);
    }
  }
}

export function prefixedToolName(packId: string, toolName: string): string {
  return `${packId}${SEPARATOR}${toolName}`;
}

export function parsePrefixedToolName(
  fullName: string,
): { packId: string; toolName: string } | null {
  const idx = fullName.indexOf(SEPARATOR);
  if (idx <= 0) return null;
  return {
    packId: fullName.slice(0, idx),
    toolName: fullName.slice(idx + SEPARATOR.length),
  };
}

export function collectRegisteredTools(packs: Pack[]): RegisteredTool[] {
  const out: RegisteredTool[] = [];
  for (const pack of packs) {
    for (const tool of pack.dataTools) {
      out.push({
        pack,
        tool,
        prefixedName: prefixedToolName(pack.id, tool.name),
      });
    }
  }
  return out;
}

export function findToolLabel(packs: Pack[], prefixedName: string): string | undefined {
  const parsed = parsePrefixedToolName(prefixedName);
  if (!parsed) return undefined;
  const pack = packs.find((p) => p.id === parsed.packId);
  const tool = pack?.dataTools.find((t) => t.name === parsed.toolName);
  return tool?.label;
}
