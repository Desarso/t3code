import { describe, expect, it } from "@effect/vitest";
import { vi } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { makeCloudflareDnsClient, makeCloudflareTunnelClient } from "./cloudflareClients.ts";

const config = {
  accountId: "account-1",
  zoneId: "zone-1",
  apiToken: "secret-token",
};

const encodeJson = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);

const ok = (result: unknown) =>
  new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("self-hosted Cloudflare managed endpoint clients", () => {
  it.effect("lists named tunnels with scoped bearer authentication", () =>
    Effect.gen(function* () {
      const fetchImplementation = vi.fn(async () =>
        ok([{ id: "tunnel-1", name: "t3-relay-prod-example" }]),
      );
      const client = makeCloudflareTunnelClient(config, fetchImplementation as typeof fetch);

      expect(yield* client.list({ name: "t3-relay-prod-example", isDeleted: false })).toEqual({
        result: [{ id: "tunnel-1", name: "t3-relay-prod-example" }],
      });
      expect(fetchImplementation).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/account-1/cfd_tunnel?name=t3-relay-prod-example&is_deleted=false",
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: "Bearer secret-token" }),
        }),
      );
    }),
  );

  it.effect("creates proxied CNAME records in the configured zone", () =>
    Effect.gen(function* () {
      const fetchImplementation = vi.fn(async () => ok({ id: "dns-1" }));
      const client = makeCloudflareDnsClient(config, fetchImplementation as typeof fetch);
      const record = {
        type: "CNAME",
        name: "environment.tunnels.gabrielmalek.com",
        content: "tunnel-1.cfargotunnel.com",
        proxied: true,
        ttl: 1,
      } as const;

      expect(yield* client.createRecord(record)).toEqual({ id: "dns-1" });
      expect(fetchImplementation).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/zone-1/dns_records",
        expect.objectContaining({ method: "POST", body: encodeJson(record) }),
      );
    }),
  );
});
