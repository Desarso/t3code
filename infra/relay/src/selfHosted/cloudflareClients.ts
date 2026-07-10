import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as ManagedEndpointProvider from "../environments/ManagedEndpointProvider.ts";

export interface CloudflareManagedEndpointConfig {
  readonly accountId: string;
  readonly zoneId: string;
  readonly apiToken: string;
}

interface CloudflareEnvelope<T> {
  readonly success: boolean;
  readonly result: T;
  readonly errors?: ReadonlyArray<{ readonly code?: number; readonly message?: string }>;
}

class CloudflareApiRequestError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "CloudflareApiRequestError";
    this.status = status;
    this.details = details;
  }
}

const encodeJson = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);

const cloudflareApi =
  (config: CloudflareManagedEndpointConfig, fetchImplementation: typeof fetch) =>
  async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetchImplementation(`https://api.cloudflare.com/client/v4${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });
    const body = (await response.json().catch(() => null)) as CloudflareEnvelope<T> | null;
    if (!response.ok || body?.success !== true) {
      const reason = body?.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ");
      throw new CloudflareApiRequestError(
        reason || `Cloudflare API request failed with status ${response.status}`,
        response.status,
        body?.errors,
      );
    }
    return body.result;
  };

export const makeCloudflareTunnelClient = (
  config: CloudflareManagedEndpointConfig,
  fetchImplementation: typeof fetch = globalThis.fetch,
): ManagedEndpointProvider.ManagedEndpointTunnelClient["Service"] => {
  const request = cloudflareApi(config, fetchImplementation);
  const basePath = `/accounts/${encodeURIComponent(config.accountId)}/cfd_tunnel`;
  return ManagedEndpointProvider.ManagedEndpointTunnelClient.of({
    list: (input) =>
      Effect.tryPromise({
        try: async () => ({
          result: await request<ReadonlyArray<{ readonly id?: string; readonly name?: string }>>(
            `${basePath}?name=${encodeURIComponent(input.name)}&is_deleted=false`,
          ),
        }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointTunnelClientError({
            operation: "list",
            tunnelName: input.name,
            cause,
          }),
      }),
    create: (input) =>
      Effect.tryPromise({
        try: () =>
          request<{ readonly id?: string; readonly name?: string }>(basePath, {
            method: "POST",
            body: encodeJson({ name: input.name, config_src: input.configSrc }),
          }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointTunnelClientError({
            operation: "create",
            tunnelName: input.name,
            cause,
          }),
      }),
    putConfiguration: (tunnelId, tunnelConfig) =>
      Effect.tryPromise({
        try: () =>
          request(`${basePath}/${encodeURIComponent(tunnelId)}/configurations`, {
            method: "PUT",
            body: encodeJson({ config: tunnelConfig }),
          }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointTunnelClientError({
            operation: "put-configuration",
            tunnelId,
            cause,
          }),
      }),
    getToken: (tunnelId) =>
      Effect.tryPromise({
        try: () => request<string>(`${basePath}/${encodeURIComponent(tunnelId)}/token`),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointTunnelClientError({
            operation: "get-token",
            tunnelId,
            cause,
          }),
      }),
    delete: (tunnelId) =>
      Effect.tryPromise({
        try: () =>
          request(`${basePath}/${encodeURIComponent(tunnelId)}`, {
            method: "DELETE",
          }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointTunnelClientError({
            operation: "delete",
            tunnelId,
            cause,
          }),
      }),
  });
};

export const makeCloudflareDnsClient = (
  config: CloudflareManagedEndpointConfig,
  fetchImplementation: typeof fetch = globalThis.fetch,
): ManagedEndpointProvider.ManagedEndpointDnsClient["Service"] => {
  const request = cloudflareApi(config, fetchImplementation);
  const basePath = `/zones/${encodeURIComponent(config.zoneId)}/dns_records`;
  return ManagedEndpointProvider.ManagedEndpointDnsClient.of({
    listRecords: (hostname) =>
      Effect.tryPromise({
        try: () =>
          request<ReadonlyArray<{ readonly id: string }>>(
            `${basePath}?type=CNAME&name=${encodeURIComponent(hostname)}`,
          ),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointDnsClientError({
            operation: "list-records",
            hostname,
            cause,
          }),
      }),
    createRecord: (record) =>
      Effect.tryPromise({
        try: () =>
          request<{ readonly id: string }>(basePath, {
            method: "POST",
            body: encodeJson(record),
          }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointDnsClientError({
            operation: "create-record",
            hostname: record.name,
            cause,
          }),
      }),
    updateRecord: (dnsRecordId, record) =>
      Effect.tryPromise({
        try: () =>
          request(`${basePath}/${encodeURIComponent(dnsRecordId)}`, {
            method: "PUT",
            body: encodeJson(record),
          }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointDnsClientError({
            operation: "update-record",
            hostname: record.name,
            dnsRecordId,
            cause,
          }),
      }),
    deleteRecord: (dnsRecordId) =>
      Effect.tryPromise({
        try: () =>
          request(`${basePath}/${encodeURIComponent(dnsRecordId)}`, {
            method: "DELETE",
          }),
        catch: (cause) =>
          new ManagedEndpointProvider.ManagedEndpointDnsClientError({
            operation: "delete-record",
            dnsRecordId,
            cause,
          }),
      }),
  });
};

export const cloudflareManagedEndpointLayer = (
  config: CloudflareManagedEndpointConfig,
  fetchImplementation: typeof fetch = globalThis.fetch,
) =>
  ManagedEndpointProvider.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        ManagedEndpointProvider.layerTunnelClient(
          makeCloudflareTunnelClient(config, fetchImplementation),
        ),
        ManagedEndpointProvider.layerDnsClient(
          makeCloudflareDnsClient(config, fetchImplementation),
        ),
      ),
    ),
  );
