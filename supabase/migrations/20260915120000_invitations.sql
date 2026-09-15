-- Invitations par CODE : faire entrer un caissier dans une boutique existante.
--
-- LE PROBLÈME — `create_organization()` est appelée à chaque inscription. Un
-- caissier qui crée son compte obtient donc sa propre boutique, vide, et la
-- session retient `organizations[0]`. L'ajouter ensuite à la boutique de son
-- patron ne suffirait pas : il aurait deux organisations et atterrirait dans la
-- mauvaise.
--
-- PAR CODE ET NON PAR EMAIL — aucun service d'envoi n'est configuré, et un lien
-- par email suppose que l'invité ait une adresse qu'il relève. Un code de huit
-- caractères se dicte au téléphone, s'écrit sur un papier, et fonctionne même
-- quand le réseau du caissier est mauvais.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,

  -- Majuscules et chiffres sans ambiguïté : ni O/0 ni I/1/L, qui se confondent
  -- à l'oral comme à l'écrit. Un code mal recopié est un code perdu.
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),

  role public.member_role not null default 'member',

  -- Sept jours : assez pour que le caissier s'inscrive, assez court pour qu'un
  -- code oublié sur un papier ne reste pas une porte ouverte.
  expires_at timestamptz not null default now() + interval '7 days',

  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invitations_org_id_idx on public.invitations (org_id);

-- ------------------------------------------------------------------- Accès

alter table public.invitations enable row level security;
revoke all on public.invitations from anon;

-- Seuls les responsables voient et créent les invitations de LEUR organisation.
-- Un membre ordinaire n'a pas à faire entrer quelqu'un dans la boutique.
create policy "invitations_select_admins" on public.invitations
  for select to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

create policy "invitations_insert_admins" on public.invitations
  for insert to authenticated
  with check (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

create policy "invitations_delete_admins" on public.invitations
  for delete to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- Accepter une invitation.
--
-- `security definer` PARCE QU'IL LE FAUT : l'invité n'est pas encore membre, il
-- ne peut donc ni lire la table (la politique exige déjà un rôle) ni s'insérer
-- dans `memberships`. La fonction fait le travail à sa place, et vérifie
-- elle-même tout ce que la RLS aurait vérifié.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_code text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.invitations;
  v_org public.organizations;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  -- `for update` : deux personnes qui saisissent le même code au même instant
  -- ne peuvent pas l'utiliser toutes les deux.
  select * into v_invitation
  from public.invitations
  where code = upper(btrim(p_code))
  for update;

  if v_invitation.id is null then
    raise exception 'Code invalide.' using errcode = 'no_data_found';
  end if;

  -- Un code ne sert qu'une fois : sinon il circulerait de main en main et
  -- ouvrirait la boutique à qui l'a recopié.
  if v_invitation.accepted_at is not null then
    raise exception 'Ce code a déjà été utilisé.' using errcode = 'restrict_violation';
  end if;

  if v_invitation.expires_at < now() then
    raise exception 'Ce code a expiré.' using errcode = 'restrict_violation';
  end if;

  select * into v_org from public.organizations where id = v_invitation.org_id;

  -- Déjà membre : on ne double pas l'appartenance, et on ne consomme pas le
  -- code — il pourra servir à quelqu'un d'autre.
  if exists (
    select 1 from public.memberships
    where org_id = v_invitation.org_id and user_id = v_user
  ) then
    return v_org;
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_invitation.org_id, v_user, v_invitation.role);

  update public.invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_invitation.id;

  return v_org;
end;
$$;

revoke execute on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

notify pgrst, 'reload schema';
