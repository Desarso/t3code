import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import * as DeliveryAttempts from "./agentActivity/DeliveryAttempts.ts";
import * as AgentActivityRows from "./agentActivity/AgentActivityRows.ts";
import * as Devices from "./agentActivity/Devices.ts";
import * as LiveActivities from "./agentActivity/LiveActivities.ts";
import * as AgentActivityPublisher from "./agentActivity/AgentActivityPublisher.ts";
import * as ApnsClient from "./agentActivity/ApnsClient.ts";
import * as ApnsProviderTokens from "./agentActivity/ApnsProviderTokens.ts";
import * as ApnsDeliveryQueue from "./agentActivity/ApnsDeliveryQueue.ts";
import * as ApnsDeliveries from "./agentActivity/ApnsDeliveries.ts";
import * as MobileRegistrations from "./agentActivity/MobileRegistrations.ts";
import * as DpopProofs from "./auth/DpopProofs.ts";
import * as RelayTokens from "./auth/RelayTokens.ts";
import * as RelayConfiguration from "./Config.ts";
import * as RelayDb from "./db.ts";
import * as EnvironmentCredentials from "./environments/EnvironmentCredentials.ts";
import * as EnvironmentLinks from "./environments/EnvironmentLinks.ts";
import * as EnvironmentConnector from "./environments/EnvironmentConnector.ts";
import * as EnvironmentLinker from "./environments/EnvironmentLinker.ts";
import * as EnvironmentPublishSignatures from "./environments/EnvironmentPublishSignatures.ts";
import * as ManagedEndpointAllocations from "./environments/ManagedEndpointAllocations.ts";
import * as ManagedEndpointProvider from "./environments/ManagedEndpointProvider.ts";
import * as ManagedTunnelLimits from "./environments/ManagedTunnelLimits.ts";

export const webcryptoLayer = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
    digest: (algorithm, data) =>
      Effect.promise(async () => {
        const input = new Uint8Array(data.length);
        input.set(data);
        return new Uint8Array(await globalThis.crypto.subtle.digest(algorithm, input.buffer));
      }),
  }),
);

/** Shared domain runtime used by both the Cloudflare and self-hosted servers. */
export const makeRelayRuntimeLayer = <
  ConfigurationError,
  ConfigurationRequirements,
  DatabaseError,
>(layers: {
  readonly configuration: Layer.Layer<
    RelayConfiguration.RelayConfiguration,
    ConfigurationError,
    ConfigurationRequirements
  >;
  readonly database: Layer.Layer<RelayDb.RelayDb, DatabaseError>;
  readonly managedEndpointProvider: Layer.Layer<
    ManagedEndpointProvider.ManagedEndpointProvider,
    never,
    | Crypto.Crypto
    | ManagedEndpointAllocations.ManagedEndpointAllocations
    | ManagedTunnelLimits.ManagedTunnelLimits
    | RelayConfiguration.RelayConfiguration
  >;
  readonly apnsDeliveryQueue: Layer.Layer<
    ApnsDeliveryQueue.ApnsDeliveryQueue,
    never,
    Crypto.Crypto | RelayConfiguration.RelayConfiguration
  >;
}) => {
  const domainLayer = Layer.empty.pipe(
    Layer.provideMerge(MobileRegistrations.layer),
    Layer.provideMerge(AgentActivityPublisher.layer),
    Layer.provideMerge(EnvironmentConnector.layer),
    Layer.provideMerge(EnvironmentLinker.layer),
    Layer.provideMerge(EnvironmentPublishSignatures.layer),
    Layer.provideMerge(layers.managedEndpointProvider),
    Layer.provideMerge(DpopProofs.layer),
    Layer.provideMerge(ApnsDeliveries.layer),
    Layer.provideMerge(ApnsClient.layer.pipe(Layer.provideMerge(ApnsProviderTokens.layer))),
    Layer.provideMerge(layers.apnsDeliveryQueue),
    Layer.provideMerge(AgentActivityRows.layer),
    Layer.provideMerge(Devices.layer),
    Layer.provideMerge(EnvironmentCredentials.layer),
    Layer.provideMerge(
      Layer.mergeAll(
        EnvironmentLinks.layer,
        ManagedEndpointAllocations.layer,
        ManagedTunnelLimits.layer,
      ),
    ),
    Layer.provideMerge(LiveActivities.layer),
    Layer.provideMerge(DeliveryAttempts.layer),
    Layer.provideMerge(RelayTokens.layer),
    Layer.provideMerge(RelayDb.RelayTransactions.layer.pipe(Layer.provideMerge(layers.database))),
    Layer.provideMerge(layers.configuration),
    Layer.provideMerge(webcryptoLayer),
  );
  return domainLayer.pipe(Layer.provideMerge(FetchHttpClient.layer));
};
