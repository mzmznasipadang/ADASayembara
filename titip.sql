-- Create queue_entries table
CREATE TABLE queue_entries (
  id BIGSERIAL PRIMARY KEY,
  ticket INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_state table
CREATE TABLE system_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_queue INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial system state
INSERT INTO system_state (id, current_queue) VALUES (1, 1);

-- Create indexes for better performance
CREATE INDEX idx_queue_entries_ticket ON queue_entries(ticket);
CREATE INDEX idx_queue_entries_status ON queue_entries(status);

-- Enable Row Level Security (RLS)
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - you can restrict later)
CREATE POLICY "Enable read access for all users" ON queue_entries
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON queue_entries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON queue_entries
  FOR UPDATE USING (true);

CREATE POLICY "Enable read access for system state" ON system_state
  FOR SELECT USING (true);

CREATE POLICY "Enable update access for system state" ON system_state
  FOR UPDATE USING (true);