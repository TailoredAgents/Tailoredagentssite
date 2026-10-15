CREATE TABLE signature_banners (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL UNIQUE,
 storage_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL,
 content_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 width INTEGER NOT NULL,
 height INTEGER NOT NULL,
 alt TEXT NOT NULL DEFAULT 'Email signature',
 link TEXT NOT NULL DEFAULT ''
);

-- Retain replaced/deleted originals so a D1 restoration can still find them.
CREATE TRIGGER signature_banner_replaced AFTER UPDATE OF storage_key ON signature_banners
WHEN OLD.storage_key <> NEW.storage_key BEGIN
 INSERT INTO retained_objects(storage_key,purge_after) VALUES (OLD.storage_key,datetime('now','+32 days'))
 ON CONFLICT(storage_key) DO UPDATE SET purge_after=excluded.purge_after;
END;
CREATE TRIGGER signature_banner_removed AFTER DELETE ON signature_banners BEGIN
 INSERT INTO retained_objects(storage_key,purge_after) VALUES (OLD.storage_key,datetime('now','+32 days'))
 ON CONFLICT(storage_key) DO UPDATE SET purge_after=excluded.purge_after;
END;
