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

const CAT_DESCRIPTIONS: Record<string, string> = {
  "01_Presentations": "Decks de presentation commerciale et strategique de la plateforme Strick'in, incluant les pitch decks investisseurs, presentations assureurs et versions finales de la proposition de valeur pour la distribution digitale de produits structures.",
  "02_Documents": "Documentation fondatrice et strategique : blueprints fintech, briefs complets, notes de synthese, memos fondateurs, interviews et rapports detailles sur le positionnement et la vision de Strick'in dans l'ecosysteme des produits structures.",
  "03_Tableurs": "Catalogues produits provenant de Julius Baer et autres emetteurs, avec les references ISIN, sous-jacents, barrieres et conditions de chaque produit structure. Suivi regulier des mises a jour de prix et disponibilites.",
  "04_Branding_Strikin": "Identite visuelle de Strick'in : brand books, chartes graphiques detaillant la palette couleurs, typographies, usages du logo et guidelines de communication de la marque.",
  "05_Produits_Cardif": "Documentation commerciale des produits structures distribues via BNP Paribas Cardif : brochures produits (autocalls, phoenix, step-down...), bulletins de souscription, fiches rapides, KID reglementaires et final terms. Produits emis par differents emetteurs (HSBC, Goldman Sachs, BNP, etc.).",
  "06_Produits_MeilleurTaux": "Documents d'information cle (KID) pour les produits structures commercialises via la plateforme MeilleurTaux Placement. Serie de produits MT numerotes avec leurs caracteristiques reglementaires.",
  "07_Marex": "Term sheets et documentation des produits structures emis via Marex Solutions : autocallables, barrier reverse convertibles (BRC) sur differents sous-jacents (indices, crypto, actions). Includes tests et variantes de structuration.",
  "08_Fiches_Produits": "Guides et fiches de reference sur les produits structures : documentation pedagogique complete et exemples de KID avec references ISIN.",
  "09_Code_Produits_Structures": "Modeles de code et templates techniques pour la structuration de produits : modeles autocall et templates de structuration parametriques.",
  "10_Doublons": "Fichiers en double detectes dans la base documentaire. Ces documents sont des copies de fichiers existants dans d'autres categories.",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatSize(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function getDocTypes(docs: Doc[]) {
  const types: Record<string, number> = {};
  for (const d of docs) {
    const parts = d.name.split(" ");
    let type = "Autre";
    const n = d.name.toLowerCase();
    if (n.includes("brochure")) type = "Brochure";
    else if (n.includes("bulletin")) type = "Bulletin de souscription";
    else if (n.includes("fiche rapide")) type = "Fiche rapide";
    else if (n.includes("kid")) type = "KID";
    else if (n.includes("final term")) type = "Final Terms";
    else if (n.includes("term sheet")) type = "Term Sheet";
    else if (n.includes("pitch") || n.includes("presentation") || n.includes("deck")) type = "Presentation";
    else if (n.includes("brand") || n.includes("charte")) type = "Branding";
    else if (n.includes("catalogue")) type = "Catalogue";
    else if (n.includes("code") || n.includes("modele")) type = "Code / Template";
    else if (n.includes("memo")) type = "Memo";
    else if (n.includes("note") || n.includes("synthese")) type = "Note de synthese";
    else if (n.includes("brief") || n.includes("blueprint") || n.includes("interview") || n.includes("rapport")) type = "Document strategique";
    types[type] = (types[type] || 0) + 1;
  }
  return Object.entries(types).sort((a, b) => b[1] - a[1]);
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
    const totalExclDoublons = documents.filter(d => d.category !== "10_Doublons").length;
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

    const oldest = documents.length > 0
      ? documents.reduce((o, d) => new Date(d.created_at) < new Date(o.created_at) ? d : o)
      : null;
    const newest = documents[0] || null;

    const allTypes = getDocTypes(documents.filter(d => d.category !== "10_Doublons"));

    return { total, totalExclDoublons, catStats, oldest, newest, allTypes };
  }, [documents]);

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
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

      <div ref={printRef} className="max-w-5xl mx-auto space-y-10 pb-16">
        {/* Nav */}
        <div className="flex items-center justify-between no-print">
          <Link href="/" className="flex items-center gap-2 text-violet hover:underline font-medium text-sm">
            &larr; Retour au portail
          </Link>
          <div className="flex gap-2">
            <button onClick={expandAll} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all font-medium">Tout ouvrir</button>
            <button onClick={collapseAll} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all font-medium">Tout fermer</button>
            <button onClick={() => window.print()} className="px-4 py-1.5 bg-violet text-white rounded-lg text-xs font-medium hover:bg-violet/90 transition-all">Exporter PDF</button>
          </div>
        </div>

        {/* Title Block */}
        <div className="bg-gradient-to-br from-violet/5 to-violet/10 rounded-2xl p-8 border border-violet/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-violet uppercase tracking-wider mb-2">Synthese documentaire</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Strick&apos;in</h1>
              <p className="text-gray-500">Plateforme de distribution digitale de produits structures</p>
            </div>
            <div className="text-right text-sm text-gray-400">
              <p>Genere le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="font-medium text-gray-600">{stats.totalExclDoublons} documents actifs</p>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">Vue d&apos;ensemble</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            La base documentaire Strick&apos;in regroupe <strong>{stats.totalExclDoublons} documents</strong> repartis
            en <strong>{stats.catStats.filter(c => c.count > 0 && c.id !== "10_Doublons").length} categories actives</strong>.
            Elle couvre l&apos;ensemble du cycle de vie des produits structures : de la conception (presentations, memos fondateurs)
            a la commercialisation (brochures, KID, bulletins de souscription), en passant par le suivi (catalogues, term sheets)
            et l&apos;identite de marque. Le corpus est principalement constitue de documentation produit Cardif ({stats.catStats.find(c => c.id === "05_Produits_Cardif")?.count || 0} docs)
            et Marex ({stats.catStats.find(c => c.id === "07_Marex")?.count || 0} docs).
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet">{stats.totalExclDoublons}</p>
            <p className="text-xs text-gray-500 mt-1">Documents actifs</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet">{stats.catStats.filter(c => c.count > 0 && c.id !== "10_Doublons").length}</p>
            <p className="text-xs text-gray-500 mt-1">Categories</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet">{stats.allTypes.length}</p>
            <p className="text-xs text-gray-500 mt-1">Types de docs</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet">{stats.newest ? formatDate(stats.newest.created_at) : "-"}</p>
            <p className="text-xs text-gray-500 mt-1">Dernier ajout</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet">{stats.catStats.find(c => c.id === "10_Doublons")?.count || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Doublons detectes</p>
          </div>
        </div>

        {/* Document Types Breakdown */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">Repartition par type de document</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stats.allTypes.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">{type}</span>
                <span className="text-sm font-bold text-violet">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Detail Sections */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">Detail par categorie</h2>

          {stats.catStats.filter(c => c.count > 0).map((cat) => {
            const docTypes = getDocTypes(cat.docs);
            const isOpen = expanded[cat.id] || false;
            const latestDoc = cat.docs[0];

            return (
              <div key={cat.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden print-break">
                {/* Category Header */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: cat.color }}>
                        {cat.count}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{cat.label}</h3>
                        <p className="text-xs text-gray-400">{cat.count} document{cat.count > 1 ? "s" : ""} {latestDoc ? "- Dernier ajout : " + formatDate(latestDoc.created_at) : ""}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {CAT_DESCRIPTIONS[cat.id] || ""}
                  </p>

                  {/* Type pills */}
                  {docTypes.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {docTypes.map(([type, count]) => (
                        <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {type} <span className="text-violet font-bold">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggle Documents List */}
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="w-full px-5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-1 no-print"
                  >
                    {isOpen ? "Masquer la liste" : "Voir les " + cat.count + " documents"}
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50/80 text-gray-500 text-xs">
                            <th className="text-left px-5 py-2 font-medium">Document</th>
                            <th className="text-left px-3 py-2 font-medium w-24">Date</th>
                            <th className="text-right px-5 py-2 font-medium w-20">Taille</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.docs.map((doc, idx) => (
                            <tr key={doc.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                              <td className="px-5 py-1.5 text-gray-700 text-xs">{doc.name}</td>
                              <td className="px-3 py-1.5 text-gray-400 text-xs">{formatDate(doc.created_at)}</td>
                              <td className="px-5 py-1.5 text-gray-400 text-xs text-right">{formatSize(doc.size)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center space-y-1 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500">Strick&apos;in - Synthese documentaire</p>
          <p className="text-xs text-gray-400">Document genere automatiquement le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} - {stats.total} documents indexes</p>
        </div>
      </div>
    </>
  );
}
