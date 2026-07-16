import packageJson from "../package.json" with { type: "json" };

declare const __T3CODE_BUILD_APP_VERSION__: string | undefined;

export function resolveBuildVersion(
  buildVersion: string | undefined,
  packageVersion: string = packageJson.version,
): string {
  return buildVersion?.trim() || packageVersion;
}

const injectedBuildVersion =
  typeof __T3CODE_BUILD_APP_VERSION__ === "undefined" ? undefined : __T3CODE_BUILD_APP_VERSION__;

export const BUILD_VERSION = resolveBuildVersion(injectedBuildVersion);
