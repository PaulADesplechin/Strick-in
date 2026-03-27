"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase, CATEGORIES, type Document } from "@/lib/supabase";
import Link from "next/link";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ResumePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

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
      // Expand all categories by default
      const cats = new Set((data || []).map((d: Document) => d.category));
      setExpandedCats(cats);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const totalSize = documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
    const byCat: Record<string, { docs: Document[]; size: number; types: Set<string> }> = {};
    documents.forEach((d) => {
      if (!byCat[d.category]) byCat[d.category] = { docs: [], size: 0, types: new Set() };
      byCat[d.category].docs.push(d);
      byCat[d.category].size += d.file_size || 0;
      byCat[d.category].types.add(d.file_type);
    });
    const typeCount: Record<string, number> = {};
    documents.forEach((d) => {
      typeCount[d.file_type] = (typeCount[d.file_type] || 0) + 1;
    });
    return { totalSize, byCat, typeCount };
  }, [documents]);

  function toggleCat(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function expandAll() {
    setExpandedCats(new Set(Object.keys(stats.byCat)));
  }

  function collapseAll() {
    setExpandedCats(new Set());
  }

  function handleExportPDF() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement du resume...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          nav, .no-print, header, footer { display: none !important; }
          body { background: white !important; }
          .print-break { page-break-before: always; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div ref={printRef} className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <Link href="/" className="flex items-center gap-2 text-violet hover:underline font-medium">
            \u2190 Retour
          </Link>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet text-white rounded-xl font-medium hover:bg-violet/90 transition-all shadow-lg shadow-violet/20"
          >
            \u{1F4C4} Exporter en PDF
          </button>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Resume documentaire</h1>
          <p className="text-gray-400 mt-2">
            Strick&apos;in \u2014 Mis a jour le {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center py-6">
            <p className="text-3xl font-bold text-violet">{documents.length}</p>
            <p className="text-sm text-gray-500 mt-1">Documents</p>
          </div>
          <div className="card text-center py-6">
            <p className="text-3xl font-bold text-violet">{Object.keys(stats.byCat).length}</p>
            <p className="text-sm text-gray-500 mt-1">Categories</p>
          </div>
          <div className="card text-center py-6">
            <p className="text-3xl font-bold text-violet">{Object.keys(stats.typeCount).length}</p>
            <p className="text-sm text-gray-500 mt-1">Types de fichiers</p>
          </div>
          <div className="card text-center py-6">
            <p className="text-3xl font-bold text-violet">{formatSize(stats.totalSize)}</p>
            <p className="text-sm text-gray-500 mt-1">Taille totale</p>
          </div>
        </div>

        {/* Types breakdown */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Repartition par type</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.typeCount)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span key={type} className="px-3 py-1.5 rounded-full text-sm font-medium bg-violet/10 text-violet">
                  {type}: {count}
                </span>
              ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 no-print">
          <button onClick={expandAll} className="text-sm text-violet hover:underline font-medium">
            Tout deployer
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-sm text-violet hover:underline font-medium">
            Tout replier
          </button>
        </div>

        {/* Categories Detail */}
        {CATEGORIES.map((cat) => {
          const catData = stats.byCat[cat.id];
          if (!catData) return null;
          const isExpanded = expandedCats.has(cat.id);

          return (
            <div key={cat.id} className="card overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: cat.color }}
                  >
                    {catData.docs.length}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-800">{cat.label}</h3>
                    <p className="text-xs text-gray-400">
                      {catData.docs.length} fichier(s) \u00B7 {formatSize(catData.size)} \u00B7 {Array.from(catData.types).join(", ")}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 text-xl">{isExpanded ? "\u25B2" : "\u25BC"}</span>
              </button>

              {/* Documents List */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase">
                        <th className="text-left px-5 py-3 font-medium">Nom</th>
                        <th className="text-left px-5 py-3 font-medium">Type</th>
                        <th className="text-left px-5 py-3 font-medium">Taille</th>
                        <th className="text-left px-5 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catData.docs.map((doc, i) => (
                        <tr
                          key={doc.id}
                          className={`text-sm ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-violet/5 transition-colors`}
                        >
                          <td className="px-5 py-3 font-medium text-gray-700 max-w-xs truncate">{doc.name}</td>
                          <td className="px-5 py-3 text-gray-500">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{doc.file_type}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-500">{formatSize(doc.file_size)}</td>
                          <td className="px-5 py-3 text-gray-400">{formatDate(doc.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div className="text-center text-sm text-gray-300 pt-4">
          Genere automatiquement par Strick&apos;in \u00B7 {documents.length} documents indexes
        </div>
      </div>
    </>
  );
}
