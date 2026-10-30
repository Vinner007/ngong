// Schema for the SQLite database that lives inside each room's Durable Object.
// One Durable Object = one room, so there is no room_id column anywhere: the database IS the room.
//
// Conventions:
// - STRICT tables so SQLite rejects a value of the wrong type instead of storing it anyway.
// - Times are unix milliseconds (INTEGER).
// - Hashes and salts are lowercase hex (TEXT); embeddings are raw Float32 bytes (BLOB).
// - Counters on `topic` are kept in sync inside the same transaction as the rows they count,
//   so building a snapshot never needs COUNT(*) over the question table.

const MIGRATIONS: readonly string[] = [
  /* v1 */ `
  CREATE TABLE room (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    code             TEXT    NOT NULL,
    title            TEXT    NOT NULL DEFAULT '' CHECK (length(title) <= 60),
    host_token_hash  TEXT    NOT NULL CHECK (length(host_token_hash) = 64),
    device_salt      TEXT    NOT NULL CHECK (length(device_salt) = 64),
    status           TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    demo_audience    INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL,
    expires_at       INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE topic (
    id                    INTEGER PRIMARY KEY,
    label                 TEXT    NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
    label_source          TEXT    NOT NULL CHECK (label_source IN ('question', 'ai', 'host')),
    labeled_at_size       INTEGER NOT NULL DEFAULT 1,
    centroid              BLOB    NOT NULL,
    question_count        INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
    member_count          INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
    understood_count      INTEGER NOT NULL DEFAULT 0 CHECK (understood_count >= 0),
    still_confused_count  INTEGER NOT NULL DEFAULT 0 CHECK (still_confused_count >= 0),
    resolved_at           INTEGER,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE question (
    id           INTEGER PRIMARY KEY,
    topic_id     INTEGER REFERENCES topic(id) ON DELETE SET NULL,
    device_hash  TEXT    NOT NULL CHECK (length(device_hash) = 64),
    body         TEXT    NOT NULL CHECK (length(body) BETWEEN 1 AND 200),
    embedding    BLOB,
    status       TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'clustered', 'hidden', 'failed')),
    attempts     INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL
  ) STRICT;

  -- One row per person per topic, whether they asked or tapped "ฉันก็งง".
  CREATE TABLE topic_member (
    topic_id     INTEGER NOT NULL REFERENCES topic(id) ON DELETE CASCADE,
    device_hash  TEXT    NOT NULL,
    via          TEXT    NOT NULL CHECK (via IN ('ask', 'metoo')),
    feedback     TEXT    CHECK (feedback IN ('understood', 'still_confused')),
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (topic_id, device_hash)
  ) STRICT, WITHOUT ROWID;

  -- Each index exists for exactly one query in queries.ts.
  CREATE INDEX question_by_topic  ON question (topic_id, created_at DESC) WHERE status = 'clustered';
  CREATE INDEX question_to_embed  ON question (created_at) WHERE status IN ('pending', 'failed');
  CREATE INDEX question_by_device ON question (device_hash, created_at DESC);
  CREATE INDEX question_recent    ON question (created_at DESC);
  CREATE INDEX member_by_device   ON topic_member (device_hash);
  CREATE INDEX member_recent      ON topic_member (created_at);
  `,
]

/** True once the room has been created. Lets read-only requests for unknown codes leave no trace. */
export function hasSchema(sql: SqlStorage): boolean {
  const rows = sql
    .exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'room'")
    .toArray()
  return rows.length > 0
}

export function runMigrations(storage: DurableObjectStorage): void {
  storage.transactionSync(() => {
    const sql = storage.sql
    sql.exec(
      "CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
    )

    const row = sql
      .exec<{ value: string }>("SELECT value FROM schema_meta WHERE key = 'schema_version'")
      .toArray()[0]
    const currentVersion = row ? Number(row.value) : 0

    for (let version = currentVersion; version < MIGRATIONS.length; version++) {
      sql.exec(MIGRATIONS[version]!)
      sql.exec(
        `INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        String(version + 1),
      )
    }
  })
}
