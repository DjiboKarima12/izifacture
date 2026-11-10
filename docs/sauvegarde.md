# Sauvegarde de la base

L'offre gratuite de Supabase ne garde aucune sauvegarde récupérable. Le script
`scripts/backup.mjs` exporte chaque nuit toutes les tables métier dans
`/var/backups/izifacture/izifacture-AAAA-MM-JJ.json.gz` et garde les 14 derniers jours.

## Installation sur le VPS (une seule fois)

```bash
cd /var/www/izifacture
npm run backup                 # premier essai : doit afficher « ✓ Sauvegarde … »
crontab -e
```

Ajouter cette ligne à la fin du fichier, puis enregistrer :

```
30 2 * * * cd /var/www/izifacture && /usr/bin/node scripts/backup.mjs >> /var/log/izifacture-backup.log 2>&1
```

Chaque nuit à 2 h 30. Vérifier le chemin de `node` avec `which node` (avec nvm, ce n'est pas
`/usr/bin/node`).

Contrôler que ça tourne :

```bash
ls -lh /var/backups/izifacture/
tail /var/log/izifacture-backup.log
```

## Garder une copie hors du VPS

Une sauvegarde sur le même serveur ne protège pas d'une panne du serveur. Une fois par semaine,
récupérer la dernière sur l'ordinateur (PowerShell) :

```powershell
scp root@<ip-du-vps>:/var/backups/izifacture/izifacture-*.json.gz $HOME\Documents\
```

## Ce que contient un fichier

Du JSON compressé : `{ createdAt, tables: { organizations: [...], invoices: [...], ... } }`.
Les comptes de connexion (`auth.users`) n'y sont pas — l'API n'y donne pas accès. Les noms et
rôles le sont (`profiles`, `memberships`) ; après une perte totale, chacun referait son mot de
passe par « Mot de passe oublié ».

## Restaurer

Restaurer touche à l'argent de vrais utilisateurs : on ne le fait pas à la main dans l'urgence.
Ouvrir le fichier (`gunzip -k fichier.json.gz`), identifier les lignes perdues, et les réinsérer
**table par table, dans l'ordre des dépendances** — `organizations`, `profiles`, `memberships`,
`subscriptions`, `clients`, `products`, `invoices`, `invoice_items`, `payments`, puis le reste —
avec la clé de service. Les triggers d'immuabilité refusent de modifier une facture émise :
réinsérer, ne jamais mettre à jour.
