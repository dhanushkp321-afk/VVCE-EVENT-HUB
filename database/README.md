# VVCE Events Hub — Database Schemas & Migrations

This directory contains the SQL schema definitions, migrations, and database scripts for the **VVCE Events Hub** application running on **Supabase (PostgreSQL)**.

---

## 📁 Files in this Directory

| File | Description | When to Run |
|---|---|---|
| `migration_approving_authorities.sql` | **Approving Authority Upgrade Migration**<br>• Creates `public.approving_authorities` table<br>• Adds `authority_id`, `authority_name`, `approved_by_authority_id`, `approved_by_authority_name`, `approved_at`, `decision_history` to `public.events`<br>• Adds `authority_id`, `authority_name`, `approval_history` to `public.users`<br>• Configures RLS policies for public/anon access<br>• Creates atomic RPC `approve_event_with_clash_check`<br>• Inserts default Dean Student Welfare authority | Mandatory for Approving Authority portal & CPM |
| `add_team_columns.sql` | **Team Registration & Roles Schema Migration**<br>• Adds team capacity, minimum/maximum size, member invitations and verification columns | Mandatory for multi-member event registrations |

---

## 🚀 How to Apply Migrations in Supabase

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project: `https://nkugbdencpvhhvgqybgi.supabase.co`.
3. In the left navigation, click on **SQL Editor**.
4. Click **New Query**.
5. Copy and paste the contents of `migration_approving_authorities.sql` and click **Run**.
6. Verify table creation by executing:
   ```sql
   SELECT * FROM public.approving_authorities LIMIT 5;
   ```
7. Next, open a new query, paste `add_team_columns.sql`, and click **Run**.
