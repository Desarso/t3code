// @effect-diagnostics nodeBuiltinImport:off - Self-hosted startup reads committed SQL migrations before serving traffic.
import * as PgClient from "@effect/sql-pg/PgClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as NodeFSP from "node:fs/promises";
import * as NodeURL from "node:url";

import * as RelayDb from "../db.ts";

const migrationsDirectory = NodeURL.fileURLToPath(
  new URL("../../migrations/postgres/", import.meta.url),
);

interface MigrationFile {
  readonly id: string;
  readonly name: string;
  readonly sql: string;
}

export class SelfHostedMigrationError extends Schema.TaggedErrorClass<SelfHostedMigrationError>()(
  "SelfHostedMigrationError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not load relay database migrations";
  }
}

const loadMigrations = Effect.fn("relay.self_hosted.load_migrations")(function* () {
  return yield* Effect.tryPromise({
    try: async () => {
      const entries = await NodeFSP.readdir(migrationsDirectory, { withFileTypes: true });
      const directories = entries
        .filter((entry) => entry.isDirectory() && /^\d+_/u.test(entry.name))
        .map((entry) => entry.name)
        .sort();
      return await Promise.all(
        directories.map(async (directory): Promise<MigrationFile> => {
          const separator = directory.indexOf("_");
          return {
            id: directory.slice(0, separator),
            name: directory.slice(separator + 1),
            sql: await NodeFSP.readFile(
              `${migrationsDirectory}/${directory}/migration.sql`,
              "utf8",
            ),
          };
        }),
      );
    },
    catch: (cause) => new SelfHostedMigrationError({ cause }),
  });
});

const runMigrations = Effect.fn("relay.self_hosted.run_migrations")(function* () {
  const sql = yield* PgClient.PgClient;
  yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS relay_self_hosted_migrations (
    migration_id text PRIMARY KEY,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  const appliedRows = yield* sql.unsafe<{ readonly migration_id: string }>(
    "SELECT migration_id FROM relay_self_hosted_migrations",
  );
  const applied = new Set(appliedRows.map((row) => row.migration_id));
  const migrations = yield* loadMigrations();
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    yield* sql.withTransaction(
      Effect.gen(function* () {
        for (const statement of migration.sql
          .split("--> statement-breakpoint")
          .map((candidate) => candidate.trim())
          .filter(Boolean)) {
          yield* sql.unsafe(statement);
        }
        yield* sql`INSERT INTO relay_self_hosted_migrations (migration_id, name)
          VALUES (${migration.id}, ${migration.name})`;
      }),
    );
  }
});

export const postgresRelayDatabaseLayer = (databaseUrl: Redacted.Redacted<string>) => {
  const clientLayer = PgClient.layer({ url: databaseUrl });
  return Layer.effect(
    RelayDb.RelayDb,
    Effect.gen(function* () {
      yield* runMigrations();
      const database = yield* PgDrizzle.makeWithDefaults();
      return RelayDb.RelayDb.of(database);
    }),
  ).pipe(Layer.provide(clientLayer));
};
