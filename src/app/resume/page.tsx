"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase, CATEGORIES } from "@/lib/supabase";

interface Doc {
  id: string;
  name: string;
  category: string;
  file_url: string;
  created_at: string;
  size?: number;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatSize(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export default function ResumePage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDocuments(data);
      setLoading(false);
    }
    load();
  }, []);
  const stats = useMemo(() => {
    const total = documents.length;
    const byCategory: Record<string, Doc[]> = {};
    for (const doc of documents) {
      if (!byCategory[doc.category]) byCategory[doc.category] = [];
      byCategory[doc.category].push(doc);
    }
    const catStats = CATEGORIES.map((cat) => ({
      ...cat,
      docs: byCategory[cat.id] || [],
      count: (byCategory[cat.id] || []).length,
    }));
    return { total, catStats };
  }, [documents]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (all[c.id] = true));
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  const printCSS = `
@media print {
  nav, .no-print, header, footer { display: none !important; }
  body { background: white !important; }
  .print-break { page-break-before: always; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet" />
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <div ref={printRef} className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <Link href="/" className="flex items-center gap-2 text-violet hover:underline font-medium">
            &larr; Retour
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-violet text-white rounded-xl text-sm font-medium hover:bg-violet/90 transition-all"
          >
            Exporter PDF
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-800">Resume documentaire</h1>
          <p className="text-gray-500">Strick&apos;in - Produits Structures</p>
          <p className="text-xs text-gray-400">Genere le {new Date().toLocaleDateString("fr-FR")} - {stats.total} documents</p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-violet">{stats.total}</p>
            <p className="text-sm text-gray-500">Total documents</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-violet">{stats.catStats.filter(c => c.count > 0).length}</p>
            <p className="text-sm text-gray-500">Categories actives</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-violet">{stats.catStats.reduce((max, c) => c.count > max.count ? c : max, stats.catStats[0])?.label || "-"}</p>
            <p className="text-sm text-gray-500">Plus grande categorie</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-violet">{documents[0] ? formatDate(documents[0].created_at) : "-"}</p>
            <p className="text-sm text-gray-500">Dernier ajout</p>
          </div>
        </div>

        {/* Expand/Collapse controls */}
        <div className="flex gap-2 no-print">
          <button onClick={expandAll} className="px-3 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all">
            Tout ouvrir
          </button>
          <button onClick={collapseAll} className="px-3 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all">
            Tout fermer
          </button>
        </div>

        {/* Categories */}
        {stats.catStats.map((cat) => (
          <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print-break">
            <button
              onClick={() => toggleExpand(cat.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.count}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">{cat.label}</p>
                  <p className="text-xs text-gray-400">{cat.count} document{cat.count > 1 ? "s" : ""}</p>
                </div>
              </div>
              <span className="text-gray-400 text-sm no-print">
                {expanded[cat.id] ? "Masquer" : "Afficher"}
              </span>
            </button>

            {(expanded[cat.id] || false) && cat.docs.length > 0 && (
              <div className="border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-4 py-2 font-medium">Nom</th>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-right px-4 py-2 font-medium">Taille</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.docs.map((doc) => (
                      <tr key={doc.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-700">{doc.name}</td>
                        <td className="px-4 py-2 text-gray-500">{formatDate(doc.created_at)}</td>
                        <td className="px-4 py-2 text-gray-500 text-right">{formatSize(doc.size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4">
          Strick&apos;in - Resume documentaire - {new Date().toLocaleDateString("fr-FR")}
        </div>
      </div>
    </>
  );
}
