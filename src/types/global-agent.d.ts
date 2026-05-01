declare module "global-agent" {
  interface ProxyAgentConfigurationInput {
    environmentVariableNamespace?: string;
    forceGlobalAgent?: boolean;
    socketConnectionTimeout?: number;
    ca?: string[] | string;
    logger?: unknown;
  }

  export function bootstrap(configurationInput?: ProxyAgentConfigurationInput): boolean;
}
