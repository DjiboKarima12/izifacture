-- Le marché de départ est le Niger : les défauts de `organizations` suivent.
--
-- POURQUOI UNE MIGRATION ET PAS UNE CORRECTION DE `20260812120000` — cette
-- migration-là est déjà passée sur la base hébergée. La retoucher ne change
-- rien à ce qui y est installé, et fait diverger silencieusement les deux : une
-- base neuve rejouerait « Niger », la base réelle resterait sur « Sénégal ».
-- Un historique de migrations ne se réécrit pas, il s'allonge.
--
-- CE QUE ÇA TOUCHE — uniquement les organisations créées APRÈS. Un défaut de
-- colonne ne repasse pas sur l'existant, et c'est voulu : les organisations
-- déjà inscrites ont un pays qu'elles ont choisi ou accepté, le corriger dans
-- leur dos changerait ce qui s'imprime sur leurs factures.
--
-- Le défaut compte vraiment, parce que `create_organization()` n'insère que le
-- nom : tout le reste de la fiche vient d'ici. Un entrepreneur nigérien qui
-- s'inscrit voyait donc « Sénégal » sur ses factures jusqu'à ce qu'il pense à
-- ouvrir les paramètres.

alter table public.organizations
  alter column country set default 'Niger';

-- La TVA suit le pays : 19 % au Niger, contre les 18 % du Sénégal et de la Côte
-- d'Ivoire hérités du schéma initial. C'est le taux proposé à la première
-- ligne de facture — se tromper là, c'est se tromper sur un montant, donc sur
-- ce que le client doit payer et sur ce qui est déclaré.
--
-- Reste modifiable dans les paramètres : le défaut sert le cas courant, il ne
-- décide pas à la place d'un exportateur ou d'une activité exonérée.
alter table public.organizations
  alter column default_tax_rate set default 19;
