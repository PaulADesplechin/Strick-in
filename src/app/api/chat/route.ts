import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── helpers ──────────────────────────────────────────
async function listFiles(folder: string) {
  const { data, error } = await supabase.storage
    .from("strickin-docs")
    .list(folder, { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) return { error: error.message };
  const files = (data || [])
    .filter((f) => f.name !== ".emptyFolderPlaceholder" && f.id)
    .map((f) => ({ name: f.name, size: f.metadata?.size || 0, type: f.metadata?.mimetype || "", created: f.created_at }));
  return { files, count: files.length };
}

async function listAllFiles() {
  const folders = [
    "01_Presentations","02_Documents","03_Tableurs","04_Branding_Strikin",
    "05_Produits_Cardif","06_Produits_MeilleurTaux","07_Marex","08_Fiches_Produits","09_Code_Produits_Structures",
  ];
  const all: { folder: string; name: string; size: number }[] = [];
  for (const folder of folders) {
    const { data } = await supabase.storage.from("strickin-docs").list(folder, { limit: 200 });
    if (data) {
      data
        .filter((f) => f.name !== ".emptyFolderPlaceholder" && f.id)
        .forEach((f) => all.push({ folder, name: f.name, size: f.metadata?.size || 0 }));
    }
  }
  return { files: all, count: all.length };
}

async function deleteFile(path: string) {
  const { error } = await supabase.storage.from("strickin-docs").remove([path]);
  if (error) return { error: error.message };
  await supabase.from("documents").delete().eq("storage_path", path);
  return { success: true, deleted: path };
}

async function deleteMultipleFiles(paths: string[]) {
  const { error } = await supabase.storage.from("strickin-docs").remove(paths);
  if (error) return { error: error.message };
  for (const p of paths) await supabase.from("documents").delete().eq("storage_path", p);
  return { success: true, deleted: paths };
}

async function moveFile(from: string, to: string) {
  const { error } = await supabase.storage.from("strickin-docs").move(from, to);
  if (error) return { error: error.message };
  await supabase.from("documents").update({ storage_path: to }).eq("storage_path", from);
  return { success: true, from, to };
}

async function generateFile(fileName: string, content: string, folder: string) {
  const path = folder ? `${folder}/${fileName}` : `uploads/${fileName}`;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  let fileBuffer: Buffer | Uint8Array;
  let contentType = "text/plain;charset=utf-8";

  if (ext === "xlsx") {
    // Parse content as JSON array of arrays or JSON array of objects
    try {
      const parsed = JSON.parse(content);
      const wb = XLSX.utils.book_new();

      if (Array.isArray(parsed) && parsed.length > 0) {
        if (Array.isArray(parsed[0])) {
          // Array of arrays — first row = headers
          const ws = XLSX.utils.aoa_to_sheet(parsed);
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        } else if (typeof parsed[0] === "object") {
          // Array of objects
          const ws = XLSX.utils.json_to_sheet(parsed);
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        }
      } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
        // Object with sheet names as keys
        for (const [sheetName, sheetData] of Object.entries(parsed)) {
          if (Array.isArray(sheetData) && sheetData.length > 0) {
            const ws = Array.isArray((sheetData as unknown[])[0])
              ? XLSX.utils.aoa_to_sheet(sheetData as unknown[][])
              : XLSX.utils.json_to_sheet(sheetData as object[]);
            XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
          }
        }
      }

      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      fileBuffer = xlsxBuffer;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } catch {
      return { error: "Le contenu pour un fichier .xlsx doit être un JSON valide (tableau d'objets ou tableau de tableaux). Exemple : [{\"Nom\":\"Alice\",\"Age\":30},{\"Nom\":\"Bob\",\"Age\":25}]" };
    }
  } else if (ext === "docx") {
    // Generate Word document from JSON structure
    try {
      const parsed = JSON.parse(content);
      // Expected format: { title?: string, sections: [{ heading?: string, text: string | string[] }] }
      // Or simple: { paragraphs: string[] }
      // Or simplest: string[] (array of paragraphs)
      const children: Paragraph[] = [];

      if (Array.isArray(parsed)) {
        // Simple array of strings → paragraphs
        for (const item of parsed) {
          children.push(new Paragraph({ children: [new TextRun({ text: String(item), size: 24 })] }));
        }
      } else if (typeof parsed === "object") {
        if (parsed.title) {
          children.push(new Paragraph({
            children: [new TextRun({ text: parsed.title, bold: true, size: 36 })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }));
        }
        const items = parsed.sections || parsed.paragraphs || [];
        for (const item of items) {
          if (typeof item === "string") {
            children.push(new Paragraph({ children: [new TextRun({ text: item, size: 24 })], spacing: { after: 200 } }));
          } else if (typeof item === "object") {
            if (item.heading) {
              children.push(new Paragraph({
                children: [new TextRun({ text: item.heading, bold: true, size: 28 })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
              }));
            }
            const texts = Array.isArray(item.text) ? item.text : item.text ? [item.text] : [];
            for (const t of texts) {
              children.push(new Paragraph({ children: [new TextRun({ text: String(t), size: 24 })], spacing: { after: 200 } }));
            }
          }
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const docxBuf = await Packer.toBuffer(doc);
      fileBuffer = docxBuf;
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } catch {
      return { error: "Le contenu pour un fichier .docx doit être un JSON valide. Formats: tableau de strings [\"para1\",\"para2\"], ou objet {title:\"...\", sections:[{heading:\"...\", text:\"...\"}]}" };
    }
  } else {
    // Text-based files
    fileBuffer = Buffer.from(content, "utf-8");
    if (ext === "html") contentType = "text/html;charset=utf-8";
    else if (ext === "csv") contentType = "text/csv;charset=utf-8";
    else if (ext === "json") contentType = "application/json;charset=utf-8";
    else if (ext === "md") contentType = "text/markdown;charset=utf-8";
  }

  const { error } = await supabase.storage.from("strickin-docs").upload(path, fileBuffer, { upsert: true, contentType });
  if (error) return { error: error.message };
  const { data: urlData } = supabase.storage.from("strickin-docs").getPublicUrl(path);
  return { success: true, path, url: urlData?.publicUrl || "" };
}

// ── tools ────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_files",
    description: "Liste les fichiers dans un dossier du storage Supabase. Utilise un dossier vide pour lister les dossiers racine.",
    input_schema: { type: "object", properties: { folder: { type: "string", description: "Nom du dossier (ex: '01_Presentations'). Vide = racine." } }, required: ["folder"] },
  },
  {
    name: "list_all_files",
    description: "Liste TOUS les fichiers de toutes les catégories du storage.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "delete_file",
    description: "Supprime un fichier du storage. Chemin = 'dossier/nom_fichier'.",
    input_schema: { type: "object", properties: { path: { type: "string", description: "Chemin du fichier (ex: '01_Presentations/pitch.pdf')" } }, required: ["path"] },
  },
  {
    name: "delete_multiple_files",
    description: "Supprime plusieurs fichiers du storage en une fois.",
    input_schema: { type: "object", properties: { paths: { type: "array", items: { type: "string" }, description: "Liste des chemins à supprimer" } }, required: ["paths"] },
  },
  {
    name: "move_file",
    description: "Déplace/renomme un fichier dans le storage.",
    input_schema: { type: "object", properties: { from: { type: "string", description: "Chemin source" }, to: { type: "string", description: "Chemin destination" } }, required: ["from", "to"] },
  },
  {
    name: "generate_file",
    description: "Génère et crée un nouveau fichier dans le storage. Supporte les fichiers texte (.md, .txt, .html, .csv, .json, .ts, .js), les fichiers Excel (.xlsx) ET les documents Word (.docx). Pour .xlsx: JSON stringifié (tableau d'objets, tableau de tableaux, ou objet multi-feuilles). Pour .docx: JSON stringifié — soit un tableau de strings [\"para1\",\"para2\"], soit un objet {title:\"...\", sections:[{heading:\"...\", text:\"...\"}]}.",
    input_schema: {
      type: "object",
      properties: {
        file_name: { type: "string", description: "Nom du fichier avec extension (ex: 'rapport.md', 'data.csv', 'tableau.xlsx')" },
        content: { type: "string", description: "Contenu du fichier. Pour .xlsx : JSON stringifié (tableau d'objets ou tableau de tableaux). Pour les autres : texte brut." },
        folder: { type: "string", description: "Dossier cible (ex: '03_Tableurs'). Par défaut 'uploads'." },
      },
      required: ["file_name", "content"],
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case "list_files": return listFiles((input.folder as string) || "");
    case "list_all_files": return listAllFiles();
    case "delete_file": return deleteFile(input.path as string);
    case "delete_multiple_files": return deleteMultipleFiles(input.paths as string[]);
    case "move_file": return moveFile(input.from as string, input.to as string);
    case "generate_file": return generateFile(input.file_name as string, input.content as string, (input.folder as string) || "uploads");
    default: return { error: `Outil inconnu: ${name}` };
  }
}

// ── system prompt ────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'assistant IA de Strick'in, une plateforme SaaS de distribution de produits structurés en France.

## Ton rôle
- Répondre aux questions sur les produits structurés (Autocall, Phoenix, Reverse Convertible, certificats, etc.)
- Expliquer les mécanismes des produits : barrières, coupons, sous-jacents, knock-in, autocall, etc.
- Aider à générer des business plans pour la distribution de produits structurés
- Donner des informations sur le marché français des produits structurés (environ 80 Mds EUR)
- Assister sur les aspects réglementaires (MiFID II, PRIIPs, KID, DDA)
- **Gérer les fichiers** : lister, supprimer, déplacer, organiser les documents
- **Générer des fichiers** : créer des rapports, documents, CSV, JSON, et tout type de fichier texte

## Contexte Strick'in
- Plateforme B2B2C de distribution digitale de produits structurés
- Partenaires émetteurs : Julius Baer, Marex Solutions, BNP Paribas / Cardif, BBVA, Goldman Sachs, HSBC
- Partenaires distributeurs : MeilleurTaux, CGP, courtiers, banques privées
- Stack technique : Next.js 14, TypeScript, Supabase, Vercel
- Base documentaire : ~170 documents (brochures, KIDs, bulletins, fiches rapides, conditions, etc.)

## Catégories de documents disponibles
1. 01_Presentations — Pitch decks, présentations investisseurs/assureurs
2. 02_Documents — Documents internes (blueprints, briefs, memos fondateur)
3. 03_Tableurs — Catalogues, suivis produits
4. 04_Branding_Strikin — Brand books, chartes graphiques
5. 05_Produits_Cardif — Brochures, bulletins, conditions, fiches rapides, KIDs
6. 06_Produits_MeilleurTaux — Brochures, KIDs, DIC, final terms
7. 07_Marex — Term sheets, conditions
8. 08_Fiches_Produits — Guides, KID de référence
9. 09_Code_Produits_Structures — Code templates autocall, templates génériques

## Gestion de fichiers
Tu as accès à des outils pour gérer les fichiers dans le storage Supabase :
- **list_files** : lister les fichiers d'un dossier
- **list_all_files** : lister tous les fichiers
- **delete_file** : supprimer un fichier
- **delete_multiple_files** : supprimer plusieurs fichiers
- **move_file** : déplacer/renommer un fichier
- **generate_file** : créer un nouveau fichier (markdown, CSV, JSON, HTML, texte, code, **fichiers Excel .xlsx** et **documents Word .docx** !)

Quand on te demande de générer un fichier, utilise l'outil generate_file pour le créer directement dans le storage.
Pour les fichiers générés, utilise le dossier approprié selon le type de contenu, ou 'uploads' par défaut.

## Génération de fichiers Excel (.xlsx)
Pour créer un fichier Excel, utilise generate_file avec une extension .xlsx et passe le contenu sous forme de JSON stringifié.
Formats supportés :
- **Tableau d'objets** : [{"Nom":"Alice","Age":30},{"Nom":"Bob","Age":25}] → crée un tableau avec headers automatiques
- **Tableau de tableaux** : [["Nom","Age"],["Alice",30],["Bob",25]] → première ligne = headers
- **Multi-feuilles** : {"Ventes":[...],"Stocks":[...]} → crée plusieurs onglets
Utilise le dossier '03_Tableurs' pour les fichiers Excel.

## Génération de documents Word (.docx)
Pour créer un document Word, utilise generate_file avec une extension .docx et passe le contenu sous forme de JSON stringifié.
Formats supportés :
- **Tableau de paragraphes** : ["Premier paragraphe", "Deuxième paragraphe"] → crée un document simple
- **Document structuré** : {"title":"Mon Titre", "sections":[{"heading":"Section 1", "text":"Contenu..."}, {"heading":"Section 2", "text":["Paragraphe 1", "Paragraphe 2"]}]} → crée un document avec titre, headings et paragraphes
Utilise le dossier '02_Documents' pour les fichiers Word.

## Pour les business plans
Quand on te demande de générer un business plan, pose les questions suivantes une par une :
1. Quel type de produit structuré ? (Autocall, Phoenix, Capital garanti, etc.)
2. Quel sous-jacent ? (Indices, actions, taux, crypto)
3. Quel marché cible ? (France, Europe, spécifique)
4. Quel canal de distribution ? (CGP, banques privées, assurance-vie, en ligne)
5. Quel volume visé ? (AUM cible, nombre de souscriptions)
6. Quel horizon ? (1 an, 3 ans, 5 ans)

Puis génère un business plan structuré et propose de le sauvegarder comme fichier.

## Règles
- Réponds toujours en français
- Sois précis et professionnel mais accessible
- Utilise des données de marché réalistes
- Ne donne jamais de conseil en investissement personnalisé
- Précise que les produits structurés comportent un risque de perte en capital
- Quand tu génères un fichier, confirme avec le chemin et un résumé du contenu`;

// ── API handler ──────────────────────────────────────
const MAX_ITERATIONS = 5;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement Vercel." },
      { status: 500 }
    );
  }

  try {
    const { messages, adminPassword } = await req.json();

    if (adminPassword !== "strickin2026") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages requis" }, { status: 400 });
    }

    const apiMessages: any[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    // Tool-use loop
    let iterations = 0;
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
          messages: apiMessages,
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

      // Check if model wants to use tools
      if (data.stop_reason === "tool_use") {
        // Add assistant message
        apiMessages.push({ role: "assistant", content: data.content });

        // Execute each tool call
        const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
        for (const block of data.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(block.name, block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        apiMessages.push({ role: "user", content: toolResults });
        continue;
      }

      // Extract final text
      const text = data.content
        ?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n") || "Désolé, je n'ai pas pu générer de réponse.";

      return NextResponse.json({ response: text });
    }

    return NextResponse.json({ response: "Désolé, le traitement a pris trop de temps. Essayez une demande plus simple." });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
