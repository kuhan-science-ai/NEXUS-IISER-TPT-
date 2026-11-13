-- Give existing groups one starter text channel and one starter voice channel.
-- Subsequent user deletions are preserved; this backfill runs only once.
INSERT INTO campus_group_channels (id, group_id, name, position, created_at, channel_type)
SELECT lower(hex(randomblob(16))), g.id, 'general',
       COALESCE((SELECT MAX(c.position) + 1 FROM campus_group_channels c WHERE c.group_id = g.id), 0),
       datetime('now'), 'text'
FROM campus_groups g
WHERE NOT EXISTS (
  SELECT 1 FROM campus_group_channels c
  WHERE c.group_id = g.id AND c.channel_type = 'text'
);

INSERT INTO campus_group_channels (id, group_id, name, position, created_at, channel_type)
SELECT lower(hex(randomblob(16))), g.id, 'general-vc',
       COALESCE((SELECT MAX(c.position) + 1 FROM campus_group_channels c WHERE c.group_id = g.id), 0),
       datetime('now'), 'voice'
FROM campus_groups g
WHERE NOT EXISTS (
  SELECT 1 FROM campus_group_channels c
  WHERE c.group_id = g.id AND c.channel_type = 'voice'
);
