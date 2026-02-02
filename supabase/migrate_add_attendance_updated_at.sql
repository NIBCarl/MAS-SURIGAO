-- Migration: Add updated_at column to attendance table
-- Run this in Supabase SQL Editor if your attendance table doesn't have updated_at

-- Add updated_at column to attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing rows to set updated_at = created_at
UPDATE attendance 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Create trigger for attendance updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance';
