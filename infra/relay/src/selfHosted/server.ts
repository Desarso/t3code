// @effect-diagnostics nodeBuiltinImport:off - NodeHttpServer.layer requires the native createServer constructor.
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiScalar from "effect/unstable/httpapi/HttpApiScalar";
import * as NodeHttp from "node:http";

import { RelayApi } from "@t3tools/contracts/relay";

import * as ApnsDeliveryQueue from "../agentActivity/ApnsDeliveryQueue.ts";
import * as RelayConfiguration from "../Config.ts";
import {
  clientApi,
  dpopClientApi,
  healthApi,
  metadataApi,
  mobileApi,
  relayClientAuthLayer,
  relayCors,
  relayDocsRedirectRoute,
  relayDpopClientAuthLayer,
  relayEnvironmentAuthLayer,
  relayNotFoundRoute,
  serverApi,
  tokenApi,
} from "../http/Api.ts";
import { makeRelayRuntimeLayer } from "../runtime.ts";
import { cloudflareManagedEndpointLayer } from "./cloudflareClients.ts";
import { postgresRelayDatabaseLayer } from "./database.ts";

const parsePositivePort = (value: number): number => {
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535, received ${value}`);
  }
  return value;
};

const serverConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000), Config.map(parsePositivePort)),
  relayPublicUrl: Config.nonEmptyString("RELAY_PUBLIC_URL"),
  databaseUrl: Config.redacted("DATABASE_URL"),
  personalAccessToken: Config.redacted("SELF_HOSTED_ACCESS_TOKEN"),
  personalAccountId: Config.nonEmptyString("SELF_HOSTED_ACCOUNT_ID").pipe(
    Config.withDefault("self-hosted-owner"),
  ),
  cloudflareAccountId: Config.nonEmptyString("CLOUDFLARE_ACCOUNT_ID"),
  cloudflareZoneId: Config.nonEmptyString("CLOUDFLARE_ZONE_ID"),
  cloudflareApiToken: Config.redacted("CLOUDFLARE_API_TOKEN"),
  tunnelBaseDomain: Config.nonEmptyString("RELAY_TUNNEL_ZONE_NAME"),
  tunnelNamespace: Config.nonEmptyString("RELAY_TUNNEL_NAMESPACE").pipe(Config.withDefault("prod")),
  cloudMintPrivateKey: Config.redacted("CLOUD_MINT_PRIVATE_KEY"),
  cloudMintPublicKey: Config.nonEmptyString("CLOUD_MINT_PUBLIC_KEY"),
  apnsDeliveryJobSigningSecret: Config.redacted("APNS_DELIVERY_JOB_SIGNING_SECRET"),
});

const disabledApnsQueueLayer = ApnsDeliveryQueue.layer.pipe(
  Layer.provide(
    Layer.succeed(
      ApnsDeliveryQueue.ApnsDeliveryQueueSender,
      ApnsDeliveryQueue.ApnsDeliveryQueueSender.of({
        send: () =>
          Effect.fail(
            new Cloudflare.QueueSendError({
              message: "APNs delivery is not enabled by the self-hosted Android relay",
            }),
          ),
      }),
    ),
  ),
);

const httpPlatformNotSupportedLayer = Layer.succeed(HttpPlatform.HttpPlatform, {
  fileResponse: () => Effect.die("Relay API does not serve filesystem responses"),
  fileWebResponse: () => Effect.die("Relay API does not serve file responses"),
});

const relayApiLayer = Layer.mergeAll(
  healthApi,
  metadataApi,
  mobileApi,
  clientApi,
  tokenApi,
  dpopClientApi,
  serverApi,
);

const program = Effect.gen(function* () {
  const config = yield* serverConfig;
  const relayConfiguration = RelayConfiguration.RelayConfiguration.of({
    relayIssuer: config.relayPublicUrl,
    apns: {
      environment: "sandbox",
      teamId: "self-hosted-android",
      keyId: "self-hosted-android",
      bundleId: "com.t3tools.t3code",
      privateKey: Redacted.make("self-hosted-android"),
    },
    apnsDeliveryJobSigningSecret: config.apnsDeliveryJobSigningSecret,
    googleClientIds: [],
    googleAllowedEmails: [],
    personalAccessToken: config.personalAccessToken,
    personalAccountId: config.personalAccountId,
    cloudMintPrivateKey: config.cloudMintPrivateKey,
    cloudMintPublicKey: config.cloudMintPublicKey,
    managedEndpointBaseDomain: config.tunnelBaseDomain,
    managedEndpointNamespace: config.tunnelNamespace,
  });
  const runtimeLayer = makeRelayRuntimeLayer({
    configuration: Layer.succeed(RelayConfiguration.RelayConfiguration, relayConfiguration),
    database: postgresRelayDatabaseLayer(config.databaseUrl),
    managedEndpointProvider: cloudflareManagedEndpointLayer({
      accountId: config.cloudflareAccountId,
      zoneId: config.cloudflareZoneId,
      apiToken: Redacted.value(config.cloudflareApiToken),
    }),
    apnsDeliveryQueue: disabledApnsQueueLayer,
  });
  const appLayer = relayApiLayer.pipe(
    Layer.provideMerge(relayClientAuthLayer),
    Layer.provideMerge(relayDpopClientAuthLayer),
    Layer.provideMerge(relayEnvironmentAuthLayer),
    Layer.provide(runtimeLayer),
  );
  const routerLayer = Layer.merge(
    Layer.mergeAll(
      HttpApiBuilder.layer(RelayApi, { openapiPath: "/openapi.json" }).pipe(
        Layer.provide(appLayer),
      ),
      HttpApiScalar.layer(RelayApi, { path: "/docs" }),
      relayDocsRedirectRoute,
    ).pipe(Layer.provide([Etag.layerWeak, httpPlatformNotSupportedLayer, relayCors])),
    relayNotFoundRoute,
  );
  const serverLayer = HttpRouter.serve(routerLayer).pipe(
    Layer.provide(
      NodeHttpServer.layer(NodeHttp.createServer, {
        host: "0.0.0.0",
        port: config.port,
      }),
    ),
  );

  yield* Effect.logInfo(`Self-hosted relay listening on 0.0.0.0:${config.port}`);
  return yield* Layer.launch(serverLayer);
});

NodeRuntime.runMain(program);
