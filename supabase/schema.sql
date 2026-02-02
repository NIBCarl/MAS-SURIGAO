-- MAS-AMICUS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  qr_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'secretary', 'member')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'irregular', 'at-risk', 'inactive')),
  registered_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'closed')),
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id),
  event_id UUID NOT NULL REFERENCES events(id),
  check_in_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('early', 'on-time', 'late', 'excused', 'absent')),
  method TEXT NOT NULL DEFAULT 'qr-scan' CHECK (method IN ('qr-scan', 'manual', 'self-checkin')),
  is_excused BOOLEAN DEFAULT FALSE,
  notes TEXT,
  recorded_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, event_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, check_in_at);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_members_qr ON members(qr_code);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Members policies
CREATE POLICY "Members can view their own record" 
  ON members FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all members" 
  ON members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Secretaries can view all members" 
  ON members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

CREATE POLICY "Secretaries can insert members" 
  ON members FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

CREATE POLICY "Admins can update members" 
  ON members FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Events policies
CREATE POLICY "All authenticated users can view events" 
  ON events FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Admins and secretaries can manage events" 
  ON events FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

-- Attendance policies
CREATE POLICY "Members can view their own attendance" 
  ON attendance FOR SELECT 
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

CREATE POLICY "Secretaries can insert attendance" 
  ON attendance FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

CREATE POLICY "Admins can update attendance" 
  ON attendance FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create default admin user (run this after creating the user in Supabase Auth)
-- INSERT INTO members (id, full_name, phone, qr_code, role, status)
-- VALUES ('user-uuid-from-auth', 'Admin User', '09123456789', 'admin-qr-code', 'admin', 'active');
