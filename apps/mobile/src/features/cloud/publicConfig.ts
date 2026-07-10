import Constants from "expo-constants";
import { relayClerkTokenOptions } from "@t3tools/shared/relayAuth";
import { normalizeSecureRelayUrl } from "@t3tools/shared/relayUrl";
import * as Schema from "effect/Schema";

export class CloudPublicConfigMissingError extends Schema.TaggedErrorClass<CloudPublicConfigMissingError>()(
  "CloudPublicConfigMissingError",
  {
    key: Schema.Literal("T3CODE_CLERK_JWT_TEMPLATE"),
  },
) {
  override get message(): string {
    return `${this.key} is not configured.`;
  }
}

export interface CloudPublicConfig {
  readonly authMode: "clerk" | "personal-access-token" | null;
  readonly clerk: {
    readonly publishableKey: string | null;
    readonly jwtTemplate: string | null;
  };
  readonly relay: {
    readonly url: string | null;
    readonly personalAccessToken: string | null;
  };
  readonly observability: {
    readonly tracesUrl: string | null;
    readonly tracesDataset: string | null;
    readonly tracesToken: string | null;
  };
}

type UntrustedSection<T> = {
  readonly [Key in keyof T]?: unknown;
};

type ExpoExtra =
  | {
      readonly clerk?: UntrustedSection<CloudPublicConfig["clerk"]>;
      readonly relay?: UntrustedSection<CloudPublicConfig["relay"]>;
      readonly observability?: UntrustedSection<CloudPublicConfig["observability"]>;
    }
  | undefined;

function trimNonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSecureUrl(value: unknown): string | null {
  const raw = trimNonEmpty(value);
  if (raw === null) {
    return null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveCloudPublicConfig(extra: ExpoExtra = Constants.expoConfig?.extra) {
  const clerk = {
    publishableKey: trimNonEmpty(extra?.clerk?.publishableKey),
    jwtTemplate: trimNonEmpty(extra?.clerk?.jwtTemplate),
  };
  const relay = {
    url: normalizeSecureRelayUrl(trimNonEmpty(extra?.relay?.url) ?? ""),
    personalAccessToken: trimNonEmpty(extra?.relay?.personalAccessToken),
  };
  const authMode = relay.url
    ? relay.personalAccessToken
      ? ("personal-access-token" as const)
      : clerk.publishableKey && clerk.jwtTemplate
        ? ("clerk" as const)
        : null
    : null;
  return {
    authMode,
    clerk,
    relay,
    observability: {
      tracesUrl: normalizeSecureUrl(extra?.observability?.tracesUrl),
      tracesDataset: trimNonEmpty(extra?.observability?.tracesDataset),
      tracesToken: trimNonEmpty(extra?.observability?.tracesToken),
    },
  } satisfies CloudPublicConfig;
}

export function hasCloudPublicConfig(
  config: CloudPublicConfig = resolveCloudPublicConfig(),
): boolean {
  return config.authMode !== null;
}

export function hasClerkCloudPublicConfig(
  config: CloudPublicConfig = resolveCloudPublicConfig(),
): boolean {
  return config.authMode === "clerk";
}

export function resolveRelayTokenProvider(
  config: CloudPublicConfig = resolveCloudPublicConfig(),
): () => Promise<string | null> {
  const token = config.relay.personalAccessToken;
  return async () => token;
}

type Configured<T> = {
  readonly [Key in keyof T]: NonNullable<T[Key]>;
};

type TracingPublicConfig = Omit<CloudPublicConfig, "observability"> & {
  readonly observability: Configured<CloudPublicConfig["observability"]>;
};

export function hasTracingPublicConfig(
  config: CloudPublicConfig = resolveCloudPublicConfig(),
): config is TracingPublicConfig {
  return Boolean(
    config.observability.tracesUrl &&
    config.observability.tracesDataset &&
    config.observability.tracesToken,
  );
}

export function resolveRelayClerkTokenOptions() {
  const { jwtTemplate } = resolveCloudPublicConfig().clerk;
  if (!jwtTemplate) {
    throw new CloudPublicConfigMissingError({ key: "T3CODE_CLERK_JWT_TEMPLATE" });
  }
  return relayClerkTokenOptions(jwtTemplate);
}
