import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET = "strickin-docs";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// --- Supabase file helpers ---

async function listFiles(folder?: string): Promise<string[]> {
  const supabase = getSupabase();
  const path = folder || "";
  const { data, error } = await supabase.storage.from(BUCKET).list(path, { limit: 500, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(error.message);
  if (!data) return [];
  return data.map(f => (path ? `${path}/${f.name}` : f.name));
}

async function listAllFiles(): Promise<{ folder: string; files: string[] }[]> {
  const supabase = getSupabase();
  const { data: folders, error } = await supabase.storage.from(BUCKET).list("", { limit: 100 });
  if (error) throw new Error(error.message);
  const results: { folder: string; files: string[] }[] = [];
  for (const item of folders || []) {
    if (!item.id) {
      // It's a folder
      const { data: files } = await supabase.storage.from(BUCKET).list(item.name, { limit: 500, sortBy: { column: "name", order: "asc" } });
      results.push({ folder: item.name, files: (files || []).filter(f => f.id).map(f => f.name) });
    }
  }
  return results;
}

async function deleteFile(filePath: string): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) throw new Error(error.message);
  return `Fichier supprimé : ${filePath}`;
}

async function moveFile(fromPath: string, toPath: string): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).move(fromPath, toPath);
  if (error) throw new Error(error.message);
  return `Fichier déplacé de ${fromPath} vers ${toPath}`;
}

async function deleteMultipleFiles(filePaths: string[]): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove(filePaths);
  if (error) throw new Error(error.message);
  return `${filePaths.length} fichier(s) supprimé(s)`;
}

// --- Tool definitions for Claude ---

const TOOLS = [
  {
    name: "list_files",
    description: "Liste les fichiers dans un dossier spécifique du bucket Supabase. Si aucun dossier n'est précisé, liste les dossiers racine.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder: { type: "string", description: "Nom du dossier (ex: '01_Plaquettes'). Vide pour lister les dossiers racine." }
      },
      required: [] as string[]
    }
  },
  {
    name: "list_all_files",
    description: "Liste TOUS les fichiers de TOUS les dossiers du bucket. Utile pour avoir une vue d'ensemble complète.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: "delete_file",
    description: "Supprime un fichier du bucket Supabase. Nécessite le chemin complet (dossier/nom_du_fichier).",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Chemin complet du fichier (ex: '10_Doublons/fichier.pdf')" }
      },
      required: ["file_path"]
    }
  },
  {
    name: "delete_multiple_files",
    description: "Supprime plusieurs fichiers d'un coup du bucket Supabase.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Liste des chemins complets des fichiers à supprimer"
        }
      },
      required: ["file_paths"]
    }
  },
  {
    name: "move_file",
    description: "Déplace ou renomme un fichier dans le bucket Supabase. Permet de trier les fichiers entre dossiers.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_path: { type: "string", description: "Chemin actuel du fichier (ex: '10_Doublons/doc.pdf')" },
        to_path: { type: "string", description: "Nouveau chemin du fichier (ex: '01_Plaquettes/doc.pdf')" }
      },
      required: ["from_path", "to_path"]
    }
  }
];

// --- System prompt ---

const SYSTEM_PROMPT = `Tu es l'assistant IA de Strick'in, une plateforme SaaS de distribution de produits structurés en France.

## Ton rôle
- Répondre aux questions sur les produits structurés et la documentation
- Générer des business plans pour la distribution de produits structurés
- Donner des informations sur le marché français des produits structurés
- Aider sur les aspects réglementaires (MiFID II, PRIIPs, DDA)
- **GÉRER LES FICHIERS** : lister, trier, supprimer et déplacer les documents dans le stockage Supabase

## Gestion des fichiers
Tu as accès à des outils pour gérer les fichiers du bucket Supabase "strickin-docs". Les dossiers typiques sont :
- 01_Plaquettes, 02_TermSheets, 03_KIDs, 04_Brochures, 05_Rapports, 06_Juridique, 07_Marketing, 08_Modeles, 09_Archives, 10_Doublons

Quand l'utilisateur demande de :
- **Lister** : utilise list_files ou list_all_files
- **Supprimer** : utilise delete_file ou delete_multiple_files. TOUJOURS confirmer avant de supprimer.
- **Déplacer/Trier** : utilise move_file pour déplacer un fichier d'un dossier à un autre
- **Trier les doublons** : liste d'abord les fichiers, identifie les doublons, puis propose de les supprimer ou déplacer

## Contexte Strick'in
- Partenaires : Luma Financial Technologies, Marex Solutions, Goldman Sachs, Société Générale CIB
- Stack : Next.js 14, TypeScript, Supabase, Vercel
- 9 catégories de documents + 1 dossier Doublons

## Business Plan
Quand on te demande un business plan, pose ces 6 questions :
1. Profil du distributeur (CGP, banque privée, courtier...)
2. Cible clientèle (patrimoine moyen, profil risque)
3. Volume visé (nombre de clients, encours)
4. Gamme produits (Autocall, Phoenix, Participation...)
5. Partenaires émetteurs souhaités
6. Horizon de déploiement

Puis génère un plan structuré avec : Résumé exécutif, Analyse de marché, Stratégie produit, Plan commercial, Projections financières, Roadmap.

## Règles
- Réponds TOUJOURS en français
- Sois professionnel mais accessible
- Ne donne JAMAIS de conseil en investissement personnalisé
- Pour la suppression de fichiers, TOUJOURS demander confirmation avant d'exécuter
- Quand tu utilises un outil, explique ce que tu fais à l'utilisateur`;

// --- Tool execution ---

async function executeTool(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case "list_files": {
      const files = await listFiles(toolInput.folder as string | undefined);
      return files.length > 0 ? files.join("\n") : "Aucun fichier trouvé dans ce dossier.";
    }
    case "list_all_files": {
      const all = await listAllFiles();
      return all.map(g => `📁 ${g.folder} (${g.files.length} fichiers):\n${g.files.map(f => `  - ${f}`).join("\n")}`).join("\n\n");
    }
    case "delete_file":
      return await deleteFile(toolInput.file_path as string);
    case "delete_multiple_files":
      return await deleteMultipleFiles(toolInput.file_paths as string[]);
    case "move_file":
      return await moveFile(toolInput.from_path as string, toolInput.to_path as string);
    default:
      return `Outil inconnu : ${toolName}`;
  }
}

// --- API Route ---

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé API Anthropic non configurée" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { messages, adminPassword } = body;

    if (adminPassword !== "strickin2026") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages requis" }, { status: 400 });
    }

    // Call Claude with tools - handle tool use loop
    let currentMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    let finalText = "";
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

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
          tools: TOOLS,
          messages: currentMessages,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        return NextResponse.json(
          { error: errData.error?.message || "Erreur API Anthropic" },
          { status: response.status }
        );
      }

      const data = await response.json();

      // Collect text blocks and tool use blocks
      const textBlocks: string[] = [];
      const toolUseBlocks: { id: string; name: string; input: Record<string, unknown> }[] = [];

      for (const block of data.content) {
        if (block.type === "text") {
          textBlocks.push(block.text);
        } else if (block.type === "tool_use") {
          toolUseBlocks.push({ id: block.id, name: block.name, input: block.input });
        }
      }

      if (textBlocks.length > 0) {
        finalText += textBlocks.join("\n");
      }

      // If no tool use, we're done
      if (data.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
        break;
      }

      // Execute tools and add results
      const assistantMessage = { role: "assistant", content: data.content };
      const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

      for (const tool of toolUseBlocks) {
        try {
          const result = await executeTool(tool.name, tool.input);
          toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: `Erreur: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
          });
        }
      }

      currentMessages = [
        ...currentMessages,
        assistantMessage,
        { role: "user", content: toolResults },
      ];
    }

    return NextResponse.json({ response: finalText });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
