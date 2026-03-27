#!/usr/bin/env python3
"""
STRICK'IN — Upload all documents to Supabase
Usage:
  pip install supabase
  python scripts/upload.py
"""

import os
from pathlib import Path
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "strickin-docs"

# Change this to your local path to the strikin_pdf folder
SOURCE_DIR = os.environ.get("STRICKIN_SOURCE_DIR", "./strikin_pdf")

CATEGORY_LABELS = {
    "01_Presentations": "Présentations",
    "02_Documents": "Documents",
    "03_Tableurs": "Tableurs",
    "04_Branding_Strikin": "Branding",
    "05_Produits_Cardif": "Produits Cardif",
    "06_Produits_MeilleurTaux": "Produits MeilleurTaux",
    "07_Marex": "Marex",
    "08_Fiches_Produits": "Fiches Produits",
    "09_Code_Produits_Structures": "Code & Structures",
}

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars")
        return

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    uploaded = 0
    errors = 0

    source = Path(SOURCE_DIR)
    for cat_dir in sorted(source.iterdir()):
        if not cat_dir.is_dir():
            continue

        category = cat_dir.name
        label = CATEGORY_LABELS.get(category, category)
        files = [f for f in cat_dir.iterdir() if f.is_file() and not f.name.startswith('.') and not f.name.endswith('.tmp')]

        print(f"\n📁 {label} ({len(files)} fichiers)")

        for file_path in sorted(files):
            ext = file_path.suffix[1:].lower() or "pdf"
            storage_path = f"{category}/{file_path.name}"
            content_type = "application/pdf" if ext == "pdf" else f"application/{ext}"

            try:
                # Upload file
                with open(file_path, "rb") as f:
                    client.storage.from_(BUCKET).upload(
                        storage_path,
                        f.read(),
                        {"content-type": content_type, "upsert": "true"}
                    )

                # Insert metadata
                client.table("documents").insert({
                    "name": file_path.stem,
                    "category": category,
                    "category_label": label,
                    "file_type": ext,
                    "file_size": file_path.stat().st_size,
                    "storage_path": storage_path,
                }).execute()

                uploaded += 1
                print(f"  ✅ {file_path.name}")

            except Exception as e:
                errors += 1
                print(f"  ❌ {file_path.name}: {e}")

    print(f"\n🎉 Upload terminé: {uploaded} fichiers, {errors} erreurs")

if __name__ == "__main__":
    main()
