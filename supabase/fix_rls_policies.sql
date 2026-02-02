-- FIX: Infinite Recursion in RLS Policies
-- The error "infinite recursion detected in policy for relation 'members'" 
-- occurs because policies check the members table while querying members table.
-- 
-- SOLUTION: Use a SECURITY DEFINER function to get user role without RLS check

-- Step 1: Create a function to get user role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM members WHERE id = user_id LIMIT 1;
$$;

-- Step 2: Drop ALL existing member policies to start fresh
DROP POLICY IF EXISTS "Members can view their own record" ON members;
DROP POLICY IF EXISTS "Admins can view all members" ON members;
DROP POLICY IF EXISTS "Secretaries can view all members" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;
DROP POLICY IF EXISTS "Admins and secretaries can view all members" ON members;
DROP POLICY IF EXISTS "Secretaries can insert members" ON members;
DROP POLICY IF EXISTS "Staff can insert members" ON members;
DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;

-- Step 3: Create new policies using the SECURITY DEFINER function
-- This avoids recursion because get_user_role() bypasses RLS

-- Policy: Users can view their own profile
CREATE POLICY "view_own_profile" 
  ON members FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Admins and Secretaries can view all members
CREATE POLICY "staff_view_all_members" 
  ON members FOR SELECT 
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'secretary'));

-- Policy: Staff can insert new members
CREATE POLICY "staff_insert_members" 
  ON members FOR INSERT 
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'secretary'));

-- Policy: Admins can update any member
CREATE POLICY "admin_update_members" 
  ON members FOR UPDATE 
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Policy: Users can update their own profile
CREATE POLICY "update_own_profile" 
  ON members FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can delete members
CREATE POLICY "admin_delete_members" 
  ON members FOR DELETE 
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Step 4: Verify the function works
SELECT get_user_role('6934340d-6850-4bcb-a538-e7d142755697') as admin_role;
SELECT get_user_role('fffcc169-6192-492c-b107-2c18b7f1c82e') as secretary_role;

-- Step 5: Verify policies are created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'members';
