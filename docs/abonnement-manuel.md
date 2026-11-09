# Activer un abonnement Premium à la main

En attendant qu'un prestataire Mobile Money soit branché, le passage au Premium se fait ainsi :

1. Le client remplit « Payer par Mobile Money » sur la page **Abonnement**. WhatsApp s'ouvre avec un
   message prérempli : boutique, formule, montant, numéro Mobile Money et **Réf.** (l'identifiant de
   l'organisation).
2. Le support envoie la demande de paiement sur ce numéro et attend la confirmation de l'opérateur.
3. Une fois le paiement reçu, le support exécute la requête ci-dessous dans l'éditeur SQL de Supabase.
4. Le client recharge la page : le Premium est actif, sans reconnexion.

## La requête

Remplacer les trois valeurs en tête :

- `REF` : la **Réf.** du message WhatsApp ;
- `TRANSACTION` : l'identifiant de transaction donné par l'opérateur (SMS de confirmation) ;
- `1 month` pour le mensuel, `12 months` pour l'annuel ; et le montant reçu.

```sql
with params as (
  select
    'REF'::uuid          as org_id,
    'TRANSACTION'::text  as transaction_id,
    interval '1 month'   as duree,
    2000                 as montant_fcfa
),
evenement as (
  insert into public.billing_events (provider, provider_event_id, type, payload)
  select 'manual', p.transaction_id, 'premium.activated',
         jsonb_build_object('org_id', p.org_id, 'duree', p.duree::text, 'montant', p.montant_fcfa)
  from params p
  where exists (select 1 from public.subscriptions s where s.org_id = p.org_id)
  returning 1
)
update public.subscriptions s
set plan = 'premium',
    status = 'active',
    provider = 'manual',
    current_period_end = greatest(coalesce(s.current_period_end, now()), now()) + p.duree
from params p
where s.org_id = p.org_id
  and exists (select 1 from evenement)
returning s.org_id, s.plan, s.current_period_end;
```

## Pourquoi elle est écrite ainsi

- **Une seule instruction** : l'enregistrement du paiement et la prolongation réussissent ensemble
  ou échouent ensemble.
- **Un même paiement ne prolonge qu'une fois.** `billing_events` refuse deux fois le même couple
  `(provider, provider_event_id)` : rejouer la requête avec le même identifiant de transaction échoue
  au lieu d'offrir un mois de plus.
- **Une prolongation s'ajoute à la période en cours** (`greatest(...)`) : un client qui renouvelle
  avant l'échéance ne perd aucun jour.
- **Rien à faire à l'échéance.** L'application lit `current_period_end` : passé cette date,
  l'organisation retombe d'elle-même sur le plan gratuit (`planOf()` dans `lib/plan.ts`).

La requête doit renvoyer **une ligne**. Aucune ligne : la Réf. est fausse, et rien n'a été
enregistré — on peut la relancer corrigée. Erreur
`duplicate key` : ce paiement a déjà été enregistré.

Le jour où un prestataire est branché, son webhook fera exactement la même chose, en clé de
service, avec `provider` à son nom.
