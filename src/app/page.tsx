"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase, CATEGORIES, type Document } from "@/lib/supabase";
import { DocumentCard } from "@/components/DocumentCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { SearchBar } from "@/components/SearchBar";
import { StatsBar } from "@/components/StatsBar";
import { AdminLock } from "@/components/AdminLock";
import { UploadZone } from "@/components/UploadZone";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    loadDocuments();
    if (typeof window !== "undefined") {
      const unlocked = sessionStorage.getItem("strickin_admin");
      if (unlocked === "true") setAdminUnlocked(true);
    }
  }, []);

  async function loadDocuments() {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleAdminUnlock() {
    setAdminUnlocked(true);
    setShowAdminModal(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("strickin_admin", "true");
    }
  }

  function handleAdminLock() {
    setAdminUnlocked(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("strickin_admin");
    }
  }

  const filtered = useMemo(() => {
    let result = documents;
    if (!adminUnlocked && activeCategory !== "10_Doublons") {
      result = result.filter((d) => d.category !== "10_Doublons");
    }
    if (activeCategory) result = result.filter((d) => d.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category_label.toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, activeCategory, search, adminUnlocked]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const visibleTotal = useMemo(() => {
    if (adminUnlocked) return documents.length;
    return documents.filter((d) => d.category !== "10_Doublons").length;
  }, [documents, adminUnlocked]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAdminModal && (
        <AdminLock
          onUnlock={handleAdminUnlock}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      <StatsBar total={visibleTotal} filtered={filtered.length} categories={Object.keys(categoryCounts).length} />

      {/* Upload Zone */}
      <UploadZone onUploadComplete={loadDocuments} />

      <div className="flex items-center gap-4">
        <SearchBar value={search} onChange={setSearch} />
        <div className="flex items-center gap-2">
          {adminUnlocked ? (
            <button
              onClick={handleAdminLock}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all"
              title="Cliquer pour verrouiller"
            >
              \uD83D\uDD13 Admin
            </button>
          ) : (
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
              title="Cliquer pour d\u00E9verrouiller"
            >
              \uD83D\uDD12 Admin
            </button>
          )}
          <div className="flex items-center gap-1 bg-white rounded-xl border border-grey-border p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "grid" ? "bg-violet text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "list" ? "bg-violet text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Liste
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <CategorySidebar
          categories={CATEGORIES}
          counts={categoryCounts}
          active={activeCategory}
          onSelect={setActiveCategory}
          adminUnlocked={adminUnlocked}
        />

        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-gray-400 text-lg">Aucun document trouv\u00E9</p>
              <p className="text-gray-300 text-sm mt-2">Essayez de modifier votre recherche ou filtres</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  mode="grid"
                  isUnlocked={adminUnlocked}
                  onLockClick={() => setShowAdminModal(true)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  mode="list"
                  isUnlocked={adminUnlocked}
                  onLockClick={() => setShowAdminModal(true)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
