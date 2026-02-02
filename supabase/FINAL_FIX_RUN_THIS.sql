-- COMPREHENSIVE RLS & SCHEMA FIX
-- Run this ENTIRE script in the Supabase SQL Editor

-- ============================================
-- PART 1: Ensure updated_at column exists
-- ============================================
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE attendance 
SET updated_at = COALESCE(created_at, NOW()) 
WHERE updated_at IS NULL;

-- ============================================
-- PART 2: Create helper function (bypasses RLS)
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM members WHERE id = user_id LIMIT 1;
$$;

-- ============================================
-- PART 3: ATTENDANCE Table RLS Policies
-- ============================================
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Drop all existing attendance policies first
DROP POLICY IF EXISTS "Staff can view attendance" ON attendance;
DROP POLICY IF EXISTS "Members can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Staff can insert attendance" ON attendance;
DROP POLICY IF EXISTS "Staff can update attendance" ON attendance;
DROP POLICY IF EXISTS "Staff can delete attendance" ON attendance;
DROP POLICY IF EXISTS "Enable read access for staff" ON attendance;
DROP POLICY IF EXISTS "Enable insert for staff" ON attendance;
DROP POLICY IF EXISTS "Enable update for staff" ON attendance;
DROP POLICY IF EXISTS "Enable delete for staff" ON attendance;

-- Create new policies
CREATE POLICY "Staff can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "Members can view own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Staff can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "Staff can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "Staff can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

-- ============================================
-- PART 4: EVENTS Table RLS Policies
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view events" ON events;
DROP POLICY IF EXISTS "Staff can insert events" ON events;
DROP POLICY IF EXISTS "Staff can update events" ON events;
DROP POLICY IF EXISTS "Admins can delete events" ON events;
DROP POLICY IF EXISTS "Anyone can view events" ON events;

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "Staff can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- PART 5: MEMBERS Table RLS Policies  
-- ============================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_own_profile" ON members;
DROP POLICY IF EXISTS "staff_view_all_members" ON members;
DROP POLICY IF EXISTS "staff_insert_members" ON members;
DROP POLICY IF EXISTS "admin_update_members" ON members;
DROP POLICY IF EXISTS "update_own_profile" ON members;
DROP POLICY IF EXISTS "admin_delete_members" ON members;

CREATE POLICY "view_own_profile" 
  ON members FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "staff_view_all_members" 
  ON members FOR SELECT 
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "staff_insert_members" 
  ON members FOR INSERT 
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

CREATE POLICY "admin_update_members" 
  ON members FOR UPDATE 
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "update_own_profile" 
  ON members FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_delete_members" 
  ON members FOR DELETE 
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- PART 6: Verify everything is set up
-- ============================================
SELECT 'RLS Policies for members:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'members';

SELECT 'RLS Policies for events:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'events';

SELECT 'RLS Policies for attendance:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'attendance';

SELECT 'Attendance table columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance';
