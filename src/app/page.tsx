"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase, CATEGORIES, type Document } from "@/lib/supabase";
import { DocumentCard } from "@/components/DocumentCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { SearchBar } from "@/components/SearchBar";
import { StatsBar } from "@/components/StatsBar";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    loadDocuments();
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

  const filtered = useMemo(() => {
    let result = documents;
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
  }, [documents, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  }, [documents]);

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
      {/* Stats */}
      <StatsBar total={documents.length} filtered={filtered.length} categories={Object.keys(categoryCounts).length} />

      {/* Search + View Toggle */}
      <div className="flex items-center gap-4">
        <SearchBar value={search} onChange={setSearch} />
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

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <CategorySidebar
          categories={CATEGORIES}
          counts={categoryCounts}
          active={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* Documents */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-gray-400 text-lg">Aucun document trouvé</p>
              <p className="text-gray-300 text-sm mt-2">Essayez de modifier votre recherche ou filtres</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((doc) => (
                <DocumentCard key={doc.id} document={doc} mode="grid" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((doc) => (
                <DocumentCard key={doc.id} document={doc} mode="list" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
