import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Document = {
  id: string;
  name: string;
  category: string;
  category_label: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};

export const CATEGORIES = [
  { id: "01_Presentations", label: "Présentations", icon: "presentation", color: "#3B28CC", protected: false },
  { id: "02_Documents", label: "Documents", icon: "file-text", color: "#1E3A5F", protected: true },
  { id: "03_Tableurs", label: "Tableurs", icon: "table", color: "#0D9488", protected: true },
  { id: "04_Branding_Strikin", label: "Branding", icon: "palette", color: "#D946EF", protected: false },
  { id: "05_Produits_Cardif", label: "Produits Cardif", icon: "building", color: "#EA580C", protected: false },
  { id: "06_Produits_MeilleurTaux", label: "Produits MeilleurTaux", icon: "trending-up", color: "#2563EB", protected: false },
  { id: "07_Marex", label: "Marex", icon: "landmark", color: "#7C3AED", protected: true },
  { id: "08_Fiches_Produits", label: "Fiches Produits", icon: "clipboard-list", color: "#DC2626", protected: false },
  { id: "09_Code_Produits_Structures", label: "Code & Structures", icon: "code", color: "#059669", protected: true },
  { id: "10_Doublons", label: "Doublons", icon: "copy", color: "#9CA3AF", protected: true },
] as const;

/** Categories that require admin access */
export const PROTECTED_CATEGORIES = CATEGORIES.filter((c) => c.protected).map((c) => c.id);

/** Check if a document belongs to a protected category */
export function isProtectedDoc(category: string): boolean {
  return (PROTECTED_CATEGORIES as readonly string[]).includes(category);
}

/** Admin password */
const ADMIN_PIN = "strickin2026";

export function verifyAdminPassword(input: string): boolean {
  return input === ADMIN_PIN;
}

export async function getDocuments(category?: string, search?: string) {
  let query = supabase.from("documents").select("*").order("category").order("name");
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("name", `%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as Document[];
}

export async function getDocumentUrl(storagePath: string) {
  const { data } = await supabase.storage.from("strickin-docs").createSignedUrl(storagePath, 3600);
  return data?.signedUrl || "";
}

export function getPublicUrl(storagePath: string) {
  const { data } = supabase.storage.from("strickin-docs").getPublicUrl(storagePath);
  return data.publicUrl;
}
