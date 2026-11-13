ALTER TABLE campus_group_channels
ADD COLUMN channel_type TEXT NOT NULL DEFAULT 'text'
CHECK (channel_type IN ('text', 'voice'));
