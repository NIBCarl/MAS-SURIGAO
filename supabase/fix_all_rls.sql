-- COMPREHENSIVE RLS FIX
-- Run this entire script in the Supabase SQL Editor to fix all permission issues.

-- 1. Helper Function (Bypass RLS for role checks)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM members WHERE id = user_id LIMIT 1;
$$;

-- 2. EVENTS Table Policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view events" ON events;
CREATE POLICY "Staff can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can insert events" ON events;
CREATE POLICY "Staff can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "Staff can update events" ON events;
CREATE POLICY "Staff can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "Admins can delete events" ON events;
CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- 3. ATTENDANCE Table Policies
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view attendance" ON attendance;
CREATE POLICY "Staff can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "Members can view own attendance" ON attendance;
CREATE POLICY "Members can view own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS "Staff can insert attendance" ON attendance;
CREATE POLICY "Staff can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "Staff can update attendance" ON attendance;
CREATE POLICY "Staff can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "Staff can delete attendance" ON attendance;
CREATE POLICY "Staff can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

-- 4. MEMBERS Table Policies (Re-applying for safety)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_own_profile" ON members;
CREATE POLICY "view_own_profile" 
  ON members FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "staff_view_all_members" ON members;
CREATE POLICY "staff_view_all_members" 
  ON members FOR SELECT 
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "staff_insert_members" ON members;
CREATE POLICY "staff_insert_members" 
  ON members FOR INSERT 
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS "admin_update_members" ON members;
CREATE POLICY "admin_update_members" 
  ON members FOR UPDATE 
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "update_own_profile" ON members;
CREATE POLICY "update_own_profile" 
  ON members FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_delete_members" ON members;
CREATE POLICY "admin_delete_members" 
  ON members FOR DELETE 
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');
