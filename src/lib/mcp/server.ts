#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { enabledPacks } from "../../packs.config";
import { collectRegisteredTools, validatePacks } from "../packs/registry";
import { renderTools } from "./render-tools";

async function main() {
  validatePacks(enabledPacks);

  for (const pack of enabledPacks) {
    if (pack.init) await pack.init();
  }

  const server = new McpServer(
    { name: "packs", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const registered = collectRegisteredTools(enabledPacks);
  for (const { tool, prefixedName } of registered) {
    const hasInputs = Object.keys(tool.inputShape).length > 0;
    server.registerTool(
      prefixedName,
      {
        description: tool.description,
        ...(hasInputs ? { inputSchema: tool.inputShape } : {}),
      },
      async (args: unknown) => {
        const result = await tool.handler(args as never);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      },
    );
  }

  for (const tool of renderTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema.shape,
      },
      async () => ({
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, rendered: true }) },
        ],
      }),
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const toolList = registered.map((r) => r.prefixedName).join(", ");
  process.stderr.write(`[packs-mcp] connected · packs: ${enabledPacks.map((p) => p.id).join(", ")} · tools: ${toolList}\n`);
}

main().catch((err) => {
  process.stderr.write(`[packs-mcp] fatal: ${String(err)}\n`);
  process.exit(1);
});
