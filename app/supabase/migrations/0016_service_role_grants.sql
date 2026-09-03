-- Recreating the public schema removes Supabase's default service_role grants.
-- The app only accesses data through the server-side secret key, which maps to
-- this role and bypasses RLS, but it still needs ordinary table privileges.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant all privileges on functions to service_role;
