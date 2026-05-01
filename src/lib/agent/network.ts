import { bootstrap } from "global-agent";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

const DEFAULT_NO_PROXY = ["localhost", "127.0.0.1", "::1"];

interface ProxyProfile {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy: string;
  proxyConfigured: boolean;
}

interface GlobalAgentController {
  HTTP_PROXY: string | null;
  HTTPS_PROXY: string | null;
  NO_PROXY: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __PORTFOLIO_SDK_NETWORK_READY__: boolean | undefined;
  // eslint-disable-next-line no-var
  var GLOBAL_AGENT: GlobalAgentController | undefined;
}

export function initializeSdkNetwork(): void {
  if (globalThis.__PORTFOLIO_SDK_NETWORK_READY__) return;

  const profile = normalizeProxyProfile();
  if (profile.proxyConfigured && !isHttp1Enabled()) {
    throw new Error(
      "Proxy environment variables are configured. Set CURSOR_USE_HTTP1=true before starting the app so the Cursor SDK uses its HTTP/1.1 transport through the proxy.",
    );
  }

  if (profile.proxyConfigured) {
    setGlobalDispatcher(
      new EnvHttpProxyAgent({
        httpProxy: profile.httpProxy,
        httpsProxy: profile.httpsProxy,
        noProxy: profile.noProxy,
      }),
    );

    bootstrap({ environmentVariableNamespace: "" });
    if (globalThis.GLOBAL_AGENT) {
      globalThis.GLOBAL_AGENT.HTTP_PROXY = profile.httpProxy ?? null;
      globalThis.GLOBAL_AGENT.HTTPS_PROXY = profile.httpsProxy ?? null;
      globalThis.GLOBAL_AGENT.NO_PROXY = profile.noProxy;
    }
  }

  globalThis.__PORTFOLIO_SDK_NETWORK_READY__ = true;
}

function normalizeProxyProfile(): ProxyProfile {
  const httpProxy = getEnvValue("HTTP_PROXY");
  const httpsProxy = getEnvValue("HTTPS_PROXY");
  const noProxy = mergeNoProxy(getEnvValues("NO_PROXY"));

  setEnvPair("HTTP_PROXY", httpProxy);
  setEnvPair("HTTPS_PROXY", httpsProxy);
  setEnvPair("NO_PROXY", noProxy);

  return {
    httpProxy,
    httpsProxy,
    noProxy,
    proxyConfigured: Boolean(httpProxy || httpsProxy),
  };
}

function setEnvPair(name: "HTTP_PROXY" | "HTTPS_PROXY" | "NO_PROXY", value?: string): void {
  if (!value) return;
  const lowerName = name.toLowerCase();
  process.env[name] ??= value;
  process.env[lowerName] ??= value;
}

function getEnvValue(name: "HTTP_PROXY" | "HTTPS_PROXY"): string | undefined {
  const lowerName = name.toLowerCase();
  return normalizeEnvValue(process.env[name]) ?? normalizeEnvValue(process.env[lowerName]);
}

function getEnvValues(name: "NO_PROXY"): string[] {
  const lowerName = name.toLowerCase();
  return [process.env[name], process.env[lowerName]]
    .map(normalizeEnvValue)
    .filter((value): value is string => Boolean(value));
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function mergeNoProxy(values: string[]): string {
  const entries = new Map<string, string>();
  for (const entry of [...values.flatMap(splitNoProxy), ...DEFAULT_NO_PROXY]) {
    entries.set(entry.toLowerCase(), entry);
  }
  return Array.from(entries.values()).join(",");
}

function splitNoProxy(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isHttp1Enabled(): boolean {
  const value = process.env.CURSOR_USE_HTTP1?.trim().toLowerCase();
  return value === "true" || value === "1";
}
