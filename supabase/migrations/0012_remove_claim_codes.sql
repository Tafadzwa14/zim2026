-- People can claim a pending identity by choosing their name and a PIN; no
-- administrator-issued claim code is required.

drop function if exists claim_user(uuid, text, text, text);
create function claim_user(
  p_user_id uuid,
  p_emoji text,
  p_pin_hash text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_version integer;
begin
  update users set
    emoji = p_emoji,
    pin_hash = p_pin_hash,
    claim_token_hash = null,
    session_version = session_version + 1
  where id = p_user_id
    and pin_hash = 'PENDING'
  returning session_version into new_version;
  return coalesce(new_version, -1);
end;
$$;

drop function if exists reset_user_pin(uuid, text);
create function reset_user_pin(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update users set
    pin_hash = 'PENDING',
    claim_token_hash = null,
    pin_reset_requested = false,
    session_version = session_version + 1
  where id = p_user_id
$$;

revoke all on function claim_user(uuid, text, text) from public, anon, authenticated;
revoke all on function reset_user_pin(uuid) from public, anon, authenticated;
grant execute on function claim_user(uuid, text, text) to service_role;
grant execute on function reset_user_pin(uuid) to service_role;
