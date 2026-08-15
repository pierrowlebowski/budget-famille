# Synchronisation entre appareils — mise en route

Les virements sont stockés dans une base Supabase (gratuite). Tous les appareils
qui ouvrent l'adresse du site lisent et écrivent dans cette même base : aucune
configuration n'est nécessaire sur le téléphone, il suffit d'ouvrir l'URL.

Ces quatre étapes ne se font **qu'une seule fois**.

## 1. Créer le projet

Sur [supabase.com](https://supabase.com) → *Start your project* → connexion avec
GitHub → *New project*.

- **Name** : `budget-famille`
- **Region** : `Central EU (Frankfurt)`
- **Database password** : n'importe quoi, tu n'en auras pas besoin ensuite

La création prend environ une minute.

## 2. Créer la table et importer l'historique

Menu de gauche → **SQL Editor** → *New query* → colle tout le bloc ci-dessous →
bouton **Run**.

```sql
create table if not exists virements (
  id     text primary key,
  person text    not null,
  amount numeric not null,
  "date" date    not null,
  note   text    default ''
);

alter table virements enable row level security;

create policy "lecture publique"     on virements for select using (true);
create policy "insertion publique"   on virements for insert with check (true);
create policy "suppression publique" on virements for delete using (true);

insert into virements (id, person, amount, "date", note) values
  ('seed_01', 'Léa',     500, '2026-06-20', ''),
  ('seed_02', 'Pierre',  500, '2026-06-15', ''),
  ('seed_03', 'Pierre', 1000, '2026-06-01', ''),
  ('seed_04', 'Léa',    1000, '2026-05-31', ''),
  ('seed_05', 'Pierre', 1200, '2026-05-18', ''),
  ('seed_06', 'Léa',    1200, '2026-05-18', ''),
  ('seed_07', 'Pierre',  500, '2026-04-29', ''),
  ('seed_08', 'Léa',    1000, '2026-04-29', ''),
  ('seed_09', 'Pierre',  600, '2026-04-14', ''),
  ('seed_10', 'Pierre',  800, '2026-04-10', ''),
  ('seed_11', 'Léa',    1000, '2026-04-02', ''),
  ('seed_12', 'Pierre',  500, '2026-03-26', ''),
  ('mqz4culr', 'Pierre', 600, '2026-06-22', ''),
  ('mqz4e7l9', 'Léa',   1000, '2026-07-02', '')
on conflict (id) do nothing;
```

## 3. Récupérer les deux valeurs

Les deux valeurs sont sur **deux pages différentes**, sous **Project Settings** :

- **Data API** → champ **Project URL**, de la forme `https://abcdefgh.supabase.co`
  (raccourci : c'est le `<ref>` de l'adresse du dashboard
  `supabase.com/dashboard/project/<ref>`, donc `https://<ref>.supabase.co`)
- **API Keys** → la clé marquée `anon` `public` (commence par `eyJ...`), ou
  `publishable` (`sb_publishable_...`) sur les projets récents — les deux
  fonctionnent avec ce code.

Colle-les dans [`js/config.js`](js/config.js), à la place des deux valeurs
`VOTRE-...`.

> Ces deux valeurs sont publiques par conception : elles se retrouvent dans le
> code de la page, et c'est normal. Seules les règles RLS de l'étape 2 décident
> de ce qu'elles permettent — ici, lire et écrire dans la table `virements`, et
> rien d'autre.

## 4. Publier

```bash
git add -A && git commit -m "Synchronisation multi-appareils via Supabase" && git push
```

Une minute plus tard, le site est à jour. Ouvre-le sur ton téléphone et sur ton
ordinateur : les deux affichent les mêmes données.

---

## Comment ça se comporte au quotidien

- La pastille en haut à droite indique l'état : **À jour**, **Synchro…**,
  **Hors ligne** ou **N en attente**.
- Les données s'actualisent à l'ouverture de l'onglet, au retour sur l'onglet,
  et automatiquement toutes les minutes.
- Sans réseau, la saisie fonctionne quand même : elle est mise en file d'attente
  et part toute seule au retour de la connexion.
- La dernière version consultée reste affichée hors ligne (cache local).
- Supprimer un virement demande un code à 4 chiffres, défini par `DELETE_CODE`
  en haut de [`js/app.js`](js/app.js). C'est un garde-fou contre la fausse
  manœuvre : le code étant dans le source de la page, il n'empêche pas quelqu'un
  de déterminé.

## À savoir

N'importe qui connaissant l'adresse du site peut lire et modifier les virements
— c'est la contrepartie de l'absence totale de connexion à gérer. Si tu veux
fermer ça plus tard, deux options : remplacer la politique `suppression publique`
par une règle plus stricte, ou activer l'authentification Supabase.

Le bouton **JSON** de l'en-tête télécharge une sauvegarde complète à tout moment.
