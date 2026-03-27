# Strick'in — Guide de déploiement

## Ce que contient ce projet

Un portail web interne pour naviguer dans les 179 documents Strick'in.
Interface avec recherche, filtres par catégorie, aperçu et téléchargement PDF.

**Stack : Next.js 14 + Tailwind CSS + Supabase**

---

## Étape 1 : Créer un projet Supabase (gratuit)

1. Va sur **https://supabase.com** et crée un compte
2. Clique **New Project** → nomme-le `strickin-docs`
3. Note le **Project URL** et la **anon key** (dans Settings > API)
4. Note aussi la **service_role key** (pour l'upload uniquement)

## Étape 2 : Configurer la base de données

1. Dans Supabase Dashboard, va dans **SQL Editor**
2. Copie-colle le contenu du fichier `supabase-setup.sql` et exécute-le
3. Va dans **Storage** → **New Bucket** → nomme-le `strickin-docs` → coche **Public**

## Étape 3 : Configurer les variables d'environnement

1. Copie `.env.local.example` en `.env.local`
2. Remplis avec tes clés Supabase :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

## Étape 4 : Uploader les documents

```bash
# Option 1 : Python (plus simple)
pip install supabase
export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...
export STRICKIN_SOURCE_DIR=../strikin_pdf
python scripts/upload.py

# Option 2 : TypeScript
npx ts-node scripts/upload-to-supabase.ts
```

## Étape 5 : Tester en local

```bash
npm install
npm run dev
# Ouvre http://localhost:3000
```

## Étape 6 : Déployer sur Vercel (gratuit)

### Option A : via le site Vercel (le plus simple)
1. Pousse le code sur un repo GitHub
2. Va sur **https://vercel.com** → **Import Project** → sélectionne le repo
3. Ajoute les variables d'environnement (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Clique **Deploy** → tu reçois un lien `https://strickin-docs.vercel.app`

### Option B : via CLI
```bash
npm i -g vercel
vercel login
vercel deploy --prod
```

## Étape 7 : Partager avec l'équipe

Envoie le lien Vercel à ton équipe. C'est tout !
Le site est public par défaut. Si tu veux ajouter un mot de passe, tu peux utiliser Vercel Password Protection (plan Pro) ou ajouter un middleware d'auth simple.

---

## Coûts

| Service | Plan gratuit | Plan Pro |
|---------|-------------|----------|
| Supabase | 1 Go storage, 500 Mo DB | 25$/mois |
| Vercel | Illimité pour perso | 20$/mois |
| **Total** | **0 €** | **~45$/mois** |

Le plan gratuit suffit largement pour ton usage !
