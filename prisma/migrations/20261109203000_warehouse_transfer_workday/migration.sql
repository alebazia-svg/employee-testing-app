CREATE TABLE IF NOT EXISTS warehouse_transfer_state (
    base text NOT NULL,
    ref text NOT NULL,
    version integer NOT NULL,
    event jsonb NOT NULL,
    closed boolean NOT NULL,
    assignee integer REFERENCES "User"(id),
    exception text,
    PRIMARY KEY (base, ref)
);
CREATE INDEX IF NOT EXISTS warehouse_transfer_open
    ON warehouse_transfer_state (base) WHERE NOT closed;
CREATE TABLE IF NOT EXISTS warehouse_transfer_cursor (
    base text PRIMARY KEY,
    seq bigint NOT NULL DEFAULT 0
);

ALTER TABLE warehouse_transfer_cursor ADD COLUMN IF NOT EXISTS anchor jsonb;
UPDATE warehouse_transfer_cursor c SET anchor=s.event FROM warehouse_transfer_state s
WHERE c.base=s.base AND c.anchor IS NULL AND c.seq=(s.event->>'sequence')::bigint;
