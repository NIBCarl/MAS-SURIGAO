-- Fix RLS Policies for Events and Attendance
-- The previous fix only covered the members table. We need to ensure
-- Secretaries can create events and attendance, and Admins can view them.

-- EVENTS POLICY
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view events" ON events;
CREATE POLICY "Staff can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true); -- Everyone authenticated can view events (or restrict to staff if needed)

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

-- ATTENDANCE POLICY
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view attendance" ON attendance;
CREATE POLICY "Staff can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

-- Member can view their own attendance
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
