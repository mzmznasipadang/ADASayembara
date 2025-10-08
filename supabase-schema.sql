-- Queue Management System Schema with RLS Policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create queue_entries table
CREATE TABLE IF NOT EXISTS queue_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket INTEGER NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'current', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_queue_entries_ticket ON queue_entries(ticket);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries(status);

-- Create system_state table
CREATE TABLE IF NOT EXISTS system_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_queue INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial system state
INSERT INTO system_state (id, current_queue)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- Create admin_users table for authentication
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate_limit table to prevent abuse
CREATE TABLE IF NOT EXISTS rate_limit (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ip_address TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit(ip_address, action, created_at);

-- Enable Row Level Security
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for queue_entries
-- Allow everyone to read queue entries
CREATE POLICY "Allow public read access to queue_entries"
    ON queue_entries FOR SELECT
    USING (true);

-- Allow everyone to insert queue entries (rate limited by application)
CREATE POLICY "Allow public insert to queue_entries"
    ON queue_entries FOR INSERT
    WITH CHECK (true);

-- Only allow authenticated users to update queue entries
CREATE POLICY "Allow authenticated update to queue_entries"
    ON queue_entries FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Only allow authenticated users to delete queue entries
CREATE POLICY "Allow authenticated delete from queue_entries"
    ON queue_entries FOR DELETE
    USING (auth.role() = 'authenticated');

-- RLS Policies for system_state
-- Allow everyone to read system state
CREATE POLICY "Allow public read access to system_state"
    ON system_state FOR SELECT
    USING (true);

-- Only allow authenticated users to update system state
CREATE POLICY "Allow authenticated update to system_state"
    ON system_state FOR UPDATE
    USING (auth.role() = 'authenticated');

-- RLS Policies for admin_users
-- Only allow authenticated admins to read admin_users
CREATE POLICY "Allow authenticated read access to admin_users"
    ON admin_users FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for rate_limit
-- Allow public insert for rate limiting
CREATE POLICY "Allow public insert to rate_limit"
    ON rate_limit FOR INSERT
    WITH CHECK (true);

-- Allow public read for rate limit checks
CREATE POLICY "Allow public read access to rate_limit"
    ON rate_limit FOR SELECT
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for queue_entries
CREATE TRIGGER update_queue_entries_updated_at
    BEFORE UPDATE ON queue_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for system_state
CREATE TRIGGER update_system_state_updated_at
    BEFORE UPDATE ON system_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean old rate limit entries (cleanup entries older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for queue_entries and system_state
ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE system_state;
