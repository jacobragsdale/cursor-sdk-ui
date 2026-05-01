#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dataTools } from "./data-tools";
import { renderTools } from "./render-tools";

async function main() {
  const server = new McpServer(
    { name: "portfolio", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  for (const tool of dataTools) {
    const hasInputs = Object.keys(tool.inputShape).length > 0;
    server.registerTool(
      tool.name,
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

  process.stderr.write("[portfolio-mcp] connected\n");
}

main().catch((err) => {
  process.stderr.write(`[portfolio-mcp] fatal: ${String(err)}\n`);
  process.exit(1);
});
