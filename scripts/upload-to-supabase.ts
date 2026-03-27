/**
 * STRICK'IN — Upload all PDF documents to Supabase Storage + DB
 *
 * Usage:
 *   1. Create a .env.local file with your Supabase credentials
 *   2. Run: npx ts-node --esm scripts/upload-to-supabase.ts
 *
 * Or use the simpler Python version: scripts/upload.py
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""; // Use service role for upload
const BUCKET = "strickin-docs";
const SOURCE_DIR = "/sessions/magical-quirky-fermat/mnt/Documents/strikin_pdf";

const CATEGORY_LABELS: Record<string, string> = {
  "01_Presentations": "Présentations",
  "02_Documents": "Documents",
  "03_Tableurs": "Tableurs",
  "04_Branding_Strikin": "Branding",
  "05_Produits_Cardif": "Produits Cardif",
  "06_Produits_MeilleurTaux": "Produits MeilleurTaux",
  "07_Marex": "Marex",
  "08_Fiches_Produits": "Fiches Produits",
  "09_Code_Produits_Structures": "Code & Structures",
};

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let uploaded = 0;
  let errors = 0;

  const categories = fs.readdirSync(SOURCE_DIR).filter((f) =>
    fs.statSync(path.join(SOURCE_DIR, f)).isDirectory()
  );

  for (const category of categories) {
    const catDir = path.join(SOURCE_DIR, category);
    const files = fs.readdirSync(catDir).filter((f) => !f.startsWith(".") && !f.endsWith(".tmp"));
    const label = CATEGORY_LABELS[category] || category;

    console.log(`\n📁 ${label} (${files.length} fichiers)`);

    for (const file of files) {
      const filePath = path.join(catDir, file);
      const stat = fs.statSync(filePath);
      const ext = path.extname(file).slice(1).toLowerCase() || "pdf";
      const storagePath = `${category}/${file}`;

      try {
        // Upload to Storage
        const fileBuffer = fs.readFileSync(filePath);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: ext === "pdf" ? "application/pdf" : `application/${ext}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Insert into DB
        const { error: dbError } = await supabase.from("documents").insert({
          name: file.replace(/\.[^.]+$/, ""), // Remove extension
          category,
          category_label: label,
          file_type: ext,
          file_size: stat.size,
          storage_path: storagePath,
        });

        if (dbError) throw dbError;

        uploaded++;
        console.log(`  ✅ ${file}`);
      } catch (err: any) {
        errors++;
        console.error(`  ❌ ${file}: ${err.message}`);
      }
    }
  }

  console.log(`\n🎉 Upload terminé: ${uploaded} fichiers uploadés, ${errors} erreurs`);
}

main();
