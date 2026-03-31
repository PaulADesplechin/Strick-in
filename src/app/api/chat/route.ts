import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const SYSTEM_PROMPT = `Tu es l'assistant IA de Strick'in, une plateforme SaaS de distribution de produits structurés en France.

## Ton rôle
- Répondre aux questions sur les produits structurés (Autocall, Phoenix, Reverse Convertible, certificats, etc.)
- Expliquer les mécanismes des produits : barrières, coupons, sous-jacents, knock-in, autocall, etc.
- Aider à générer des business plans pour la distribution de produits structurés
- Donner des informations sur le marché français des produits structurés (environ 80 Mds EUR)
- Assister sur les aspects réglementaires (MiFID II, PRIIPs, KID, DDA)

## Contexte Strick'in
- Plateforme B2B2C de distribution digitale de produits structurés
- Partenaires émetteurs : Julius Baer, Marex Solutions, BNP Paribas / Cardif, BBVA, Goldman Sachs, HSBC
- Partenaires distributeurs : MeilleurTaux, CGP, courtiers, banques privées
- Stack technique : Next.js 14, TypeScript, Supabase, Vercel
- Base documentaire : ~170 documents (brochures, KIDs, bulletins, fiches rapides, conditions, etc.)

## Catégories de documents disponibles
1. Présentations (pitch decks, présentations investisseurs/assureurs)
2. Documents internes (blueprints, briefs, memos fondateur, rapports)
3. Tableurs (catalogues Julius Baer, suivis produits)
4. Branding (brand books, chartes graphiques)
5. Produits Cardif (brochures, bulletins, conditions, fiches rapides, KIDs)
6. Produits MeilleurTaux (brochures, KIDs, DIC, final terms)
7. Marex (term sheets, conditions)
8. Fiches Produits (guides, KID de référence)
9. Code & Structures (templates autocall, templates génériques)

## Pour les business plans
Quand on te demande de générer un business plan, pose les questions suivantes une par une :
1. Quel type de produit structuré ? (Autocall, Phoenix, Capital garanti, etc.)
2. Quel sous-jacent ? (Indices, actions, taux, crypto)
3. Quel marché cible ? (France, Europe, spécifique)
4. Quel canal de distribution ? (CGP, banques privées, assurance-vie, en ligne)
5. Quel volume visé ? (AUM cible, nombre de souscriptions)
6. Quel horizon ? (1 an, 3 ans, 5 ans)

Puis génère un business plan structuré avec :
- Executive Summary
- Analyse de marché
- Stratégie produit
- Plan de distribution
- Modèle de revenus (commissions, SaaS)
- Projections financières
- Risques et mitigations
- Roadmap

## Règles
- Réponds toujours en français
- Sois précis et professionnel mais accessible
- Utilise des données de marché réalistes
- Ne donne jamais de conseil en investissement personnalisé
- Précise que les produits structurés comportent un risque de perte en capital`;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement Vercel." },
      { status: 500 }
    );
  }

  try {
    const { messages, adminPassword } = await req.json();

    // Verify admin password
    if (adminPassword !== "strickin2026") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages requis" }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      return NextResponse.json(
        { error: `Erreur API (${response.status}): ${err.substring(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "Désolé, je n'ai pas pu générer de réponse.";

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
