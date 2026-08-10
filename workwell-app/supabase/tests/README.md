# Database tests

pgtap suites, one file per concern. Run each file's contents through the
Supabase MCP `execute_sql` tool against the project database.

Order matters only in that `06_seed.sql` expects `0006_seed_demo_org.sql`
to have been applied. Every file wraps itself in `begin ... rollback`, so
running them leaves no trace.

There is no local Docker on this machine, so `supabase test db` is not
available. When CI is added, it needs either a Postgres service container
with an `auth` schema shim providing `auth.uid()` and `auth.users`, or a
hosted branch database.

`10_boundary.sql` is the executable form of the guarantee in
`docs/superpowers/specs/2026-08-10-identity-and-plane-boundary-design.md`.
If it is ever deleted or skipped, that guarantee reverts to a paragraph
nobody checks.

One assertion from that spec is deliberately absent: "signed in as HR,
selecting from any private table returns zero rows". There are no private
tables yet. It belongs in slice B's first task, alongside the first table
that goes behind the boundary.
