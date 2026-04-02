import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ââ helpers ââââââââââââââââââââââââââââââââââââââââââ
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
          // Array of arrays â first row = headers
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
      return { error: "Le contenu pour un fichier .xlsx doit Ãªtre un JSON valide (tableau d'objets ou tableau de tableaux). Exemple : [{\"Nom\":\"Alice\",\"Age\":30},{\"Nom\":\"Bob\",\"Age\":25}]" };
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
        // Simple array of strings â paragraphs
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
      return { error: "Le contenu pour un fichier .docx doit Ãªtre un JSON valide. Formats: tableau de strings [\"para1\",\"para2\"], ou objet {title:\"...\", sections:[{heading:\"...\", text:\"...\"}]}" };
    }
  } else if (ext === "html") {
    // Generate HTML presentation (for .pptx alternative)
    try {
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      let htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PrÃ©sentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f0f0; }
    .slide { width: 100%; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; text-align: center; page-break-after: always; background: white; border: 1px solid #ddd; }
    .slide h1 { font-size: 48px; margin-bottom: 20px; color: #333; }
    .slide h2 { font-size: 36px; margin-bottom: 20px; color: #555; }
    .slide p { font-size: 20px; line-height: 1.6; color: #666; max-width: 900px; }
    .slide ul { font-size: 18px; text-align: left; margin: 20px auto; max-width: 700px; }
    .slide li { margin: 10px 0; }
  </style>
</head>
<body>`;

      // Support both simple array of strings and structured format
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") {
            htmlContent += `<div class="slide"><h1>${item}</h1></div>`;
          } else if (typeof item === "object" && item.title) {
            htmlContent += `<div class="slide"><h1>${item.title}</h1>`;
            if (item.content) htmlContent += `<p>${item.content}</p>`;
            if (item.points && Array.isArray(item.points)) {
              htmlContent += `<ul>${item.points.map((p: string) => `<li>${p}</li>`).join("")}</ul>`;
            }
            htmlContent += `</div>`;
          }
        }
      } else if (typeof parsed === "object") {
        if (parsed.title) {
          htmlContent += `<div class="slide"><h1>${parsed.title}</h1>`;
          if (parsed.subtitle) htmlContent += `<p>${parsed.subtitle}</p>`;
          htmlContent += `</div>`;
        }
        if (parsed.slides && Array.isArray(parsed.slides)) {
          for (const slide of parsed.slides) {
            htmlContent += `<div class="slide">`;
            if (slide.title) htmlContent += `<h2>${slide.title}</h2>`;
            if (slide.content) htmlContent += `<p>${slide.content}</p>`;
            if (slide.points && Array.isArray(slide.points)) {
              htmlContent += `<ul>${slide.points.map((p: string) => `<li>${p}</li>`).join("")}</ul>`;
            }
            htmlContent += `</div>`;
          }
        }
      }

      htmlContent += `</body></html>`;
      fileBuffer = Buffer.from(htmlContent, "utf-8");
      contentType = "text/html;charset=utf-8";
    } catch {
      return { error: "Le contenu pour un fichier .html de prÃ©sentation doit Ãªtre un JSON valide. Formats : tableau de strings ou objet {title:\"...\", slides:[{title:\"...\", content:\"...\", points:[...]}]}" };
    }
  } else {
    // Text-based files
    fileBuffer = Buffer.from(content, "utf-8");
    if (ext === "csv") contentType = "text/csv;charset=utf-8";
    else if (ext === "json") contentType = "application/json;charset=utf-8";
    else if (ext === "md") contentType = "text/markdown;charset=utf-8";
  }

  const { error } = await supabase.storage.from("strickin-docs").upload(path, fileBuffer, { upsert: true, contentType });
  if (error) return { error: error.message };
  const { data: urlData } = supabase.storage.from("strickin-docs").getPublicUrl(path);
  return { success: true, path, url: urlData?.publicUrl || "" };
}

async function summarizeFile(filePath: string) {
  try {
    // Check file extension
    const ext = filePath.split(".").pop()?.toLowerCase() || "";

    // Text-readable files
    if (["md", "txt", "csv", "json", "html", "js", "ts", "tsx", "jsx"].includes(ext)) {
      const { data, error } = await supabase.storage.from("strickin-docs").download(filePath);
      if (error) return { error: `Impossible de tÃ©lÃ©charger le fichier: ${error.message}` };

      const content = new TextDecoder().decode(data);
      const lines = content.split("\n").length;
      const chars = content.length;
      const preview = content.substring(0, 500);

      return {
        success: true,
        filePath,
        type: ext,
        fileType: "text",
        size: chars,
        lines,
        preview: preview + (chars > 500 ? "..." : ""),
        summary: `Fichier texte (${ext}) - ${chars} caractÃ¨res, ${lines} lignes. AperÃ§u du contenu fourni.`,
      };
    }

    // Binary files - provide metadata only
    if (["pdf", "docx", "xlsx", "pptx", "doc", "xls"].includes(ext)) {
      const { data: list } = await supabase.storage.from("strickin-docs").list(filePath.substring(0, filePath.lastIndexOf("/")), { limit: 200 });
      const fileInfo = list?.find((f) => `${filePath.substring(0, filePath.lastIndexOf("/"))}/${f.name}` === filePath);

      return {
        success: true,
        filePath,
        type: ext,
        fileType: "binary",
        size: fileInfo?.metadata?.size || 0,
        mimeType: fileInfo?.metadata?.mimetype || "",
        summary: `Fichier binaire (${ext}) - non directement lisible. Taille: ${fileInfo?.metadata?.size || 0} bytes. Pour rÃ©sumer ce fichier, il faudrait utiliser une API spÃ©cialisÃ©e ou uploader son contenu texte extrait.`,
      };
    }

    return { error: `Type de fichier non supportÃ©: .${ext}` };
  } catch (error) {
    return { error: `Erreur lors de la lecture du fichier: ${String(error)}` };
  }
}

// ââ tools ââââââââââââââââââââââââââââââââââââââââââââ
const TOOLS = [
  {
    name: "list_files",
    description: "Liste les fichiers dans un dossier du storage Supabase. Utilise un dossier vide pour lister les dossiers racine.",
    input_schema: { type: "object", properties: { folder: { type: "string", description: "Nom du dossier (ex: '01_Presentations'). Vide = racine." } }, required: ["folder"] },
  },
  {
    name: "list_all_files",
    description: "Liste TOUS les fichiers de toutes les catÃ©gories du storage.",
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
    input_schema: { type: "object", properties: { paths: { type: "array", items: { type: "string" }, description: "Liste des chemins Ã  supprimer" } }, required: ["paths"] },
  },
  {
    name: "move_file",
    description: "DÃ©place/renomme un fichier dans le storage.",
    input_schema: { type: "object", properties: { from: { type: "string", description: "Chemin source" }, to: { type: "string", description: "Chemin destination" } }, required: ["from", "to"] },
  },
  {
    name: "generate_file",
    description: "GÃ©nÃ¨re et crÃ©e un nouveau fichier dans le storage. Supporte les fichiers texte (.md, .txt, .html, .csv, .json, .ts, .js), les fichiers Excel (.xlsx), les documents Word (.docx), ET les prÃ©sentations HTML (.html pour des prÃ©sentations interactives en lieu et place de .pptx). Pour .xlsx: JSON stringifiÃ© (tableau d'objets, tableau de tableaux, ou objet multi-feuilles). Pour .docx: JSON stringifiÃ© â soit un tableau de strings soit un objet avec title et sections. Pour .html de prÃ©sentation: JSON stringifiÃ© (tableau de strings ou objet {title, slides:[{title, content, points}]}).",
    input_schema: {
      type: "object",
      properties: {
        file_name: { type: "string", description: "Nom du fichier avec extension (ex: 'rapport.md', 'data.csv', 'tableau.xlsx', 'presentation.html')" },
        content: { type: "string", description: "Contenu du fichier. Pour .xlsx : JSON stringifiÃ©. Pour .docx: JSON stringifiÃ©. Pour .html de prÃ©sentation: JSON stringifiÃ©. Sinon: texte brut." },
        folder: { type: "string", description: "Dossier cible (ex: '03_Tableurs'). Par dÃ©faut 'uploads'." },
      },
      required: ["file_name", "content"],
    },
  },
  {
    name: "summarize_file",
    description: "RÃ©sume ou extrait les mÃ©tadonnÃ©es d'un fichier du storage. Pour les fichiers texte (.md, .txt, .csv, .json, .html, code), affiche un aperÃ§u du contenu. Pour les fichiers binaires (.pdf, .docx, .xlsx, .pptx), affiche les mÃ©tadonnÃ©es et propose des alternatives.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Chemin complet du fichier (ex: '01_Presentations/pitch.pdf' ou '02_Documents/rapport.md')" },
      },
      required: ["file_path"],
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
    case "summarize_file": return summarizeFile(input.file_path as string);
    default: return { error: `Outil inconnu: ${name}` };
  }
}

// ââ system prompt ââââââââââââââââââââââââââââââââââââ
const SYSTEM_PROMPT = `Tu es l'assistant IA de Strick'in, une plateforme SaaS de distribution de produits structurÃ©s en France.

## Ton rÃ´le
- RÃ©pondre aux questions sur les produits structurÃ©s (Autocall, Phoenix, Reverse Convertible, certificats, etc.)
- Expliquer les mÃ©canismes des produits : barriÃ¨res, coupons, sous-jacents, knock-in, autocall, etc.
- Aider Ã  gÃ©nÃ©rer des business plans pour la distribution de produits structurÃ©s
- Donner des informations sur le marchÃ© franÃ§ais des produits structurÃ©s (environ 80 Mds EUR)
- Assister sur les aspects rÃ©glementaires (MiFID II, PRIIPs, KID, DDA)
- **GÃ©rer les fichiers** : lister, supprimer, dÃ©placer, organiser les documents
- **GÃ©nÃ©rer des fichiers** : crÃ©er des rapports, documents, CSV, JSON, et tout type de fichier texte
- **RÃ©sumer et explorer les fichiers** : extraire des aperÃ§us et mÃ©tadonnÃ©es

## Contexte Strick'in
- Plateforme B2B2C de distribution digitale de produits structurÃ©s
- Partenaires Ã©metteurs : Julius Baer, Marex Solutions, BNP Paribas / Cardif, BBVA, Goldman Sachs, HSBC
- Partenaires distributeurs : MeilleurTaux, CGP, courtiers, banques privÃ©es
- Stack technique : Next.js 14, TypeScript, Supabase, Vercel
- Base documentaire : ~170 documents (brochures, KIDs, bulletins, fiches rapides, conditions, etc.)

## CatÃ©gories de documents disponibles
1. 01_Presentations â Pitch decks, prÃ©sentations investisseurs/assureurs
2. 02_Documents â Documents internes (blueprints, briefs, memos fondateur)
3. 03_Tableurs â Catalogues, suivis produits
4. 04_Branding_Strikin â Brand books, chartes graphiques
5. 05_Produits_Cardif â Brochures, bulletins, conditions, fiches rapides, KIDs
6. 06_Produits_MeilleurTaux â Brochures, KIDs, DIC, final terms
7. 07_Marex â Term sheets, conditions
8. 08_Fiches_Produits â Guides, KID de rÃ©fÃ©rence
9. 09_Code_Produits_Structures â Code templates autocall, templates gÃ©nÃ©riques

## Gestion de fichiers
Tu as accÃ¨s Ã  des outils pour gÃ©rer et explorer les fichiers dans le storage Supabase :
- **list_files** : lister les fichiers d'un dossier
- **list_all_files** : lister tous les fichiers
- **delete_file** : supprimer un fichier
- **delete_multiple_files** : supprimer plusieurs fichiers
- **move_file** : dÃ©placer/renommer un fichier
- **generate_file** : crÃ©er un nouveau fichier (markdown, CSV, JSON, HTML, texte, code, **fichiers Excel .xlsx**, **documents Word .docx**, ET **prÃ©sentations HTML .html**)
- **summarize_file** : extraire un aperÃ§u ou les mÃ©tadonnÃ©es d'un fichier

Quand on te demande de gÃ©nÃ©rer un fichier, utilise l'outil generate_file pour le crÃ©er directement dans le storage.
Pour les fichiers gÃ©nÃ©rÃ©s, utilise le dossier appropriÃ© selon le type de contenu, ou 'uploads' par dÃ©faut.

## GÃ©nÃ©ration de fichiers Excel (.xlsx)
Pour crÃ©er un fichier Excel, utilise generate_file avec une extension .xlsx et passe le contenu sous forme de JSON stringifiÃ©.
Formats supportÃ©s :
- **Tableau d'objets** : [{"Nom":"Alice","Age":30},{"Nom":"Bob","Age":25}] â crÃ©e un tableau avec headers automatiques
- **Tableau de tableaux** : [["Nom","Age"],["Alice",30],["Bob",25]] â premiÃ¨re ligne = headers
- **Multi-feuilles** : {"Ventes":[...],"Stocks":[...]} â crÃ©e plusieurs onglets
Utilise le dossier '03_Tableurs' pour les fichiers Excel.

## GÃ©nÃ©ration de documents Word (.docx)
Pour crÃ©er un document Word, utilise generate_file avec une extension .docx et passe le contenu sous forme de JSON stringifiÃ©.
Formats supportÃ©s :
- **Tableau de paragraphes** : ["Premier paragraphe", "DeuxiÃ¨me paragraphe"] â crÃ©e un document simple
- **Document structurÃ©** : {"title":"Mon Titre", "sections":[{"heading":"Section 1", "text":"Contenu..."}, {"heading":"Section 2", "text":["Paragraphe 1", "Paragraphe 2"]}]} â crÃ©e un document avec titre, headings et paragraphes
Utilise le dossier '02_Documents' pour les fichiers Word.

## GÃ©nÃ©ration de prÃ©sentations HTML (.html)
Puisque la gÃ©nÃ©ration native de .pptx n'est pas disponible, tu peux gÃ©nÃ©rer des prÃ©sentations interactives au format HTML qui fonctionnent en navigateur.
Pour crÃ©er une prÃ©sentation HTML, utilise generate_file avec une extension .html et passe le contenu sous forme de JSON stringifiÃ©.
Formats supportÃ©s :
- **Tableau de titres** : ["Titre 1", "Titre 2", "Titre 3"] â crÃ©e des slides simples
- **PrÃ©sentation structurÃ©e** : {"title":"PrÃ©sentation", "subtitle":"Sous-titre", "slides":[{"title":"Slide 1", "content":"Contenu", "points":["Point 1", "Point 2"]}]} â crÃ©e une prÃ©sentation professionnelle
Les fichiers HTML gÃ©nÃ©rÃ© peuvent Ãªtre ouverts dans n'importe quel navigateur et imprimÃ©s en PDF si nÃ©cessaire.
Utilise le dossier '01_Presentations' pour les prÃ©sentations HTML.

## RÃ©sumÃ© de fichiers
Quand on te demande de rÃ©sumer ou d'explorer un fichier :
- Utilise **summarize_file** avec le chemin complet du fichier
- Pour les fichiers texte (.md, .txt, .csv, .json, .html, code) : tu obtiendras un aperÃ§u du contenu
- Pour les fichiers binaires (.pdf, .docx, .xlsx, .pptx) : tu obtiendras les mÃ©tadonnÃ©es et pourras proposer d'extraire/convertir le contenu si nÃ©cessaire
- Propose toujours au utilisateur un rÃ©sumÃ© ou un aperÃ§u lorsqu'ils uploadent des fichiers

## Pour les business plans
Quand on te demande de gÃ©nÃ©rer un business plan, pose les questions suivantes une par une :
1. Quel type de produit structurÃ© ? (Autocall, Phoenix, Capital garanti, etc.)
2. Quel sous-jacent ? (Indices, actions, taux, crypto)
3. Quel marchÃ© cible ? (France, Europe, spÃ©cifique)
4. Quel canal de distribution ? (CGP, banques privÃ©es, assurance-vie, en ligne)
5. Quel volume visÃ© ? (AUM cible, nombre de souscriptions)
6. Quel horizon ? (1 an, 3 ans, 5 ans)

Puis gÃ©nÃ¨re un business plan structurÃ© et propose de le sauvegarder comme fichier.

## RÃ¨gles
- RÃ©ponds toujours en franÃ§ais
- Sois prÃ©cis et professionnel mais accessible
- Utilise des donnÃ©es de marchÃ© rÃ©alistes
- Ne donne jamais de conseil en investissement personnalisÃ©
- PrÃ©cise que les produits structurÃ©s comportent un risque de perte en capital
- Quand tu gÃ©nÃ¨res un fichier, confirme avec le chemin et un rÃ©sumÃ© du contenu`;

// ââ streaming helper ââââââââââââââââââââââââââââââââââ
function createSSEMessage(text: string): string {
  return `data: ${JSON.stringify({ text })}\n\n`;
}

// ââ API handler ââââââââââââââââââââââââââââââââââââââ
const MAX_ITERATIONS = 5;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ClÃ© API Anthropic non configurÃ©e. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement Vercel." },
      { status: 500 }
    );
  }

  try {
    const { messages, adminPassword, stream } = await req.json();

    if (adminPassword !== "strickin2026") {
      return NextResponse.json({ error: "AccÃ¨s non autorisÃ©" }, { status: 403 });
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
    let finalResponse = "";

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
      finalResponse = data.content
        ?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n") || "DÃ©solÃ©, je n'ai pas pu gÃ©nÃ©rer de rÃ©ponse.";

      // Handle streaming or JSON response
      if (stream) {
        // Stream response using Server-Sent Events
        const encoder = new TextEncoder();
        const chunks: Uint8Array[] = [];

        // Stream each character chunk
        for (const chunk of finalResponse.split("")) {
          chunks.push(encoder.encode(createSSEMessage(chunk)));
        }
        // Send completion signal
        chunks.push(encoder.encode("data: [DONE]\n\n"));

        return new NextResponse(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) {
                controller.enqueue(chunk);
              }
              controller.close();
            },
          }),
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          }
        );
      } else {
        // Standard JSON response
        return NextResponse.json({ response: finalResponse });
      }
    }

    return NextResponse.json({ response: "DÃ©solÃ©, le traitement a pris trop de temps. Essayez une demande plus simple." });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
