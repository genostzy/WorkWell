-- News and policies got an authoring UI: HR can now remove a post or a
-- policy, not just add and edit one. 0037 deliberately left delete off
-- both (revoked at the grant level, no delete policy) because nothing
-- could remove anything yet. This adds exactly that, in the same shape
-- as every other HR-write policy on these two tables.
--
-- Deleting a policy cascades to policy_acks (on delete cascade, set in
-- 0037) -- everyone's acknowledgement of that policy disappears with it.
-- That cascade runs as the deleting session, so policy_acks needs its own
-- delete grant and policy too, or the cascade itself is blocked.

create policy news_posts_delete on work.news_posts
  for delete to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

grant delete on work.news_posts to authenticated;
grant delete on public.news_posts to authenticated;

create policy policies_delete on work.policies
  for delete to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

grant delete on work.policies to authenticated;
grant delete on public.policies to authenticated;

-- Not exposed to HR directly (acks are deleted only as a side effect of
-- deleting the policy they belong to), but required for that cascade.
create policy policy_acks_delete on work.policy_acks
  for delete to authenticated
  using (
    exists (
      select 1 from work.policies p
       where p.id = policy_acks.policy_id
         and identity.is_hr()
         and p.org_id = identity.current_org_id()
    )
  );

grant delete on work.policy_acks to authenticated;
