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

const SENSITIVE_KEYWORDS = [
  "interview", "fondateur", "memo fondateur", "brief complet", "blueprint",
  "scoping", "business plan", "commissions", "structure de co", "rapport 400",
  "rapport condens", "newco", "go/no go", "recapitulatif projet"
];

function isSensitive(name: string): boolean {
  const n = name.toLowerCase();
  return SENSITIVE_KEYWORDS.some(kw => n.includes(kw));
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

function extractISINs(docs: Doc[]): string[] {
  const isins = new Set<string>();
  for (const d of docs) {
    const matches = d.name.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/g);
    if (matches) matches.forEach(m => isins.add(m));
  }
  return Array.from(isins).sort();
}

function getDocType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("brochure")) return "Brochure";
  if (n.includes("bulletin")) return "Bulletin";
  if (n.includes("fiche rapide")) return "Fiche rapide";
  if (n.startsWith("kid") || n.includes("kid ")) return "KID";
  if (n.includes("dic ") || n.startsWith("dic")) return "DIC";
  if (n.includes("final term")) return "Final Terms";
  if (n.includes("term sheet")) return "Term Sheet";
  if (n.includes("conditions")) return "Conditions";
  if (n.includes("mode op")) return "Mode operatoire";
  if (n.includes("pitch") || n.includes("deck")) return "Pitch Deck";
  if (n.includes("brand") || n.includes("charte")) return "Branding";
  if (n.includes("catalogue")) return "Catalogue";
  if (n.includes("code") || n.includes("modele")) return "Template";
  return "Document";
}

function getDocTypes(docs: Doc[]): [string, number][] {
  const types: Record<string, number> = {};
  for (const d of docs) { const t = getDocType(d.name); types[t] = (types[t] || 0) + 1; }
  return Object.entries(types).sort((a, b) => b[1] - a[1]);
}

function extractEmitters(docs: Doc[]): Record<string, number> {
  const e: Record<string, number> = {};
  for (const d of docs) {
    const n = d.name;
    if (n.match(/BNP|Cardif/i)) e["BNP Paribas / Cardif"] = (e["BNP Paribas / Cardif"] || 0) + 1;
    if (n.match(/HSBC/i)) e["HSBC"] = (e["HSBC"] || 0) + 1;
    if (n.match(/Goldman/i)) e["Goldman Sachs"] = (e["Goldman Sachs"] || 0) + 1;
    if (n.match(/BBVA/i)) e["BBVA"] = (e["BBVA"] || 0) + 1;
    if (n.match(/Julius Baer/i)) e["Julius Baer"] = (e["Julius Baer"] || 0) + 1;
    if (n.match(/Marex/i)) e["Marex Solutions"] = (e["Marex Solutions"] || 0) + 1;
    if (n.match(/MeilleurTaux/i)) e["MeilleurTaux"] = (e["MeilleurTaux"] || 0) + 1;
  }
  return e;
}

function extractUnderlyings(docs: Doc[]): string[] {
  const s = new Set<string>();
  for (const d of docs) {
    const n = d.name;
    if (n.match(/Euro Stoxx.*Bank/i)) s.add("Euro Stoxx Banks");
    if (n.match(/Euro Stoxx 50/i)) s.add("Euro Stoxx 50");
    if (n.match(/DAX/i)) s.add("DAX");
    if (n.match(/Netflix/i)) s.add("Netflix");
    if (n.match(/ASML/i)) s.add("ASML");
    if (n.match(/TotalEnergies/i)) s.add("TotalEnergies");
    if (n.match(/Cr.*dit Agricole/i)) s.add("Credit Agricole");
    if (n.match(/Engie/i)) s.add("Engie");
    if (n.match(/Bitcoin/i)) s.add("Bitcoin");
    if (n.match(/MSFT/i)) s.add("Microsoft");
    if (n.match(/Euribor/i)) s.add("Euribor");
    if (n.match(/Italie/i)) s.add("Taux Italie 10Y");
  }
  return Array.from(s).sort();
}

const CAT_DETAILS: Record<string, { desc: string; contenu: string }> = {
  "01_Presentations": {
    desc: "Supports de presentation commerciale et strategique pour differentes audiences.",
    contenu: "5 decks couvrant le positionnement de la plateforme : pitch decks investisseurs (v1/v2), presentation assureurs, modele de distribution digitale et version finale de reference (v2.6)."
  },
  "02_Documents": {
    desc: "Documentation strategique et fondatrice du projet.",
    contenu: "Documents internes couvrant la vision, l'architecture et le positionnement strategique de la plateforme."
  },
  "03_Tableurs": {
    desc: "Catalogues de produits structures et suivi des emetteurs.",
    contenu: "9 fichiers dont 7 catalogues Julius Baer (Jan-Mars 2026) avec mises a jour intra-journalieres des prix, references ISIN, sous-jacents et conditions."
  },
  "04_Branding_Strikin": {
    desc: "Identite visuelle et charte de marque.",
    contenu: "4 documents : Brand Book (v1/v2) et Charte Graphique (v1/v2) definissant logo, couleurs, typographies et guidelines de communication."
  },
  "05_Produits_Cardif": {
    desc: "Documentation commerciale et reglementaire des produits distribues via BNP Paribas Cardif.",
    contenu: "78 documents couvrant ~16 produits structures. Pour chaque produit : Brochure, Bulletin de Souscription, Conditions, Fiche Rapide et KID. Produits phares : Daily Degressif, Phoenix Autocall Fleche, HIS CMS Phoenix, Horizon Taux, BBVA Opti Strike, Rendement Memoire Degressif BNP, Monthly Step Transat, K Taux Euribor, Odyssee Tempo Degressif, Athena Escalier. Emetteurs : BNP, HSBC, Goldman Sachs, BBVA."
  },
  "06_Produits_MeilleurTaux": {
    desc: "KID reglementaires pour la gamme MeilleurTaux Placement.",
    contenu: "18 KID pour les produits MT11 a MT28 avec objectifs, profil investisseur, scenarios de performance, risques et couts."
  },
  "07_Marex": {
    desc: "Term sheets et documentation de structuration via Marex Solutions.",
    contenu: "23 documents : 17 tests de structuration, Autocallable & BRC (Bitcoin, DAX, MSFT, Euro Stoxx 50), Final Terms HSBC et documentation business."
  },
  "08_Fiches_Produits": {
    desc: "Documentation pedagogique et fiches de reference.",
    contenu: "Guide Complet des Produits Structures et KID de reference."
  },
  "09_Code_Produits_Structures": {
    desc: "Templates techniques pour la structuration de produits.",
    contenu: "2 modeles : template Autocall et template Produit generique parametrique."
  },
  "10_Doublons": {
    desc: "Fichiers en double detectes et isoles.",
    contenu: "18 copies identifiees et separees de la base active."
  },
};

export default function ResumePage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "search">("overview");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (data) setDocuments(data);
      setLoading(false);
    }
    load();
  }, []);

  // Filter out sensitive docs from public view
  const publicDocs = useMemo(() => documents.filter(d => !isSensitive(d.name)), [documents]);
  const activeDocs = useMemo(() => publicDocs.filter(d => d.category !== "10_Doublons"), [publicDocs]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return activeDocs.filter(d => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }, [search, activeDocs]);

  const analysis = useMemo(() => {
    const byCategory: Record<string, Doc[]> = {};
    for (const doc of publicDocs) {
      if (!byCategory[doc.category]) byCategory[doc.category] = [];
      byCategory[doc.category].push(doc);
    }
    const catStats = CATEGORIES.map((cat) => ({
      ...cat, docs: byCategory[cat.id] || [], count: (byCategory[cat.id] || []).length,
    }));
    const allISINs = extractISINs(activeDocs);
    const allEmitters = extractEmitters(activeDocs);
    const allUnderlyings = extractUnderlyings(activeDocs);
    const allTypes = getDocTypes(activeDocs);
    const maxCatCount = Math.max(...catStats.map(c => c.count));
    return { total: publicDocs.length, totalActive: activeDocs.length, catStats, allISINs, allEmitters, allUnderlyings, allTypes, maxCatCount };
  }, [publicDocs, activeDocs]);

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const expandAll = () => { const a: Record<string, boolean> = {}; CATEGORIES.forEach(c => a[c.id] = true); setExpanded(a); };
  const collapseAll = () => setExpanded({});

  const printCSS = `@media print{nav,.no-print,header,footer{display:none!important}body{background:white!important}.print-break{page-break-before:always}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet" /></div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />
      <div ref={printRef} className="max-w-5xl mx-auto space-y-8 pb-16">

        {/* Nav */}
        <div className="flex items-center justify-between no-print">
          <Link href="/" className="flex items-center gap-2 text-violet hover:underline font-medium text-sm">&larr; Retour au portail</Link>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-1.5 bg-violet text-white rounded-lg text-xs font-medium hover:bg-violet/90 transition-all">Exporter PDF</button>
          </div>
        </div>

        {/* Title */}
        <div className="bg-gradient-to-br from-violet/5 via-violet/8 to-violet/12 rounded-2xl p-8 border border-violet/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-violet uppercase tracking-widest mb-3">Synthese documentaire</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Strick&apos;in</h1>
              <p className="text-gray-500 text-sm">Plateforme de distribution digitale de produits structures</p>
            </div>
            <div className="text-right text-sm space-y-1">
              <p className="text-gray-400">{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="font-bold text-gray-800 text-xl">{analysis.totalActive}</p>
              <p className="text-xs text-gray-500">documents actifs</p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative no-print">
          <input
            type="text"
            placeholder="Rechercher un document, produit, ISIN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) setActiveTab("search"); else setActiveTab("overview"); }}
            className="w-full px-4 py-3 pl-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/50 bg-white"
          />
          <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {search && <button onClick={() => { setSearch(""); setActiveTab("overview"); }} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-sm">Effacer</button>}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 no-print">
          {(["overview", "categories", "search"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-xs font-medium rounded-lg transition-all ${activeTab === tab ? "bg-white text-violet shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {tab === "overview" ? "Vue d'ensemble" : tab === "categories" ? "Categories" : "Recherche (" + searchResults.length + ")"}
            </button>
          ))}
        </div>

        {/* SEARCH TAB */}
        {activeTab === "search" && (
          <div className="space-y-3">
            {searchResults.length === 0 && search.trim() && (
              <p className="text-center text-gray-400 py-8">Aucun resultat pour &quot;{search}&quot;</p>
            )}
            {searchResults.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet/10 text-violet shrink-0">{getDocType(doc.name)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">{CATEGORIES.find(c => c.id === doc.category)?.label} - {formatDate(doc.created_at)}</p>
                  </div>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 ml-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet/10 text-violet hover:bg-violet/20 transition-all">
                  Voir
                </a>
              </div>
            ))}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { val: analysis.totalActive, label: "Docs actifs", color: "text-violet" },
                { val: analysis.allISINs.length, label: "Codes ISIN", color: "text-emerald-600" },
                { val: Object.keys(analysis.allEmitters).length, label: "Emetteurs", color: "text-orange-600" },
                { val: analysis.allUnderlyings.length, label: "Sous-jacents", color: "text-blue-600" },
                { val: analysis.allTypes.length, label: "Types de docs", color: "text-rose-600" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Visual Category Chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-4">Repartition par categorie</h3>
              <div className="space-y-3">
                {analysis.catStats.filter(c => c.count > 0 && c.id !== "10_Doublons").map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{cat.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                        style={{ width: Math.max(8, (cat.count / analysis.maxCatCount) * 100) + "%", backgroundColor: cat.color }}>
                        <span className="text-white text-xs font-bold">{cat.count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{Math.round((cat.count / analysis.totalActive) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2-col panels */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Emitters */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Emetteurs / Partenaires</h3>
                <div className="space-y-2">
                  {Object.entries(analysis.allEmitters).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{name}</span>
                      <span className="text-xs font-bold text-violet bg-violet/10 px-2 py-0.5 rounded-full">{count} docs</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Underlyings */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Sous-jacents references</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.allUnderlyings.map(u => (
                    <span key={u} className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">{u}</span>
                  ))}
                </div>
              </div>

              {/* Doc Types */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Types de documents</h3>
                <div className="space-y-1.5">
                  {analysis.allTypes.map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-full bg-violet rounded-full" style={{ width: (count / analysis.allTypes[0][1]) * 100 + "%" }} /></div>
                        <span className="text-xs font-bold text-gray-500 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ISINs */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Codes ISIN ({analysis.allISINs.length})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.allISINs.map(isin => (
                    <code key={isin} className="px-2 py-0.5 rounded text-xs font-mono bg-gray-50 text-gray-600 border border-gray-100">{isin}</code>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <div className="flex gap-2 no-print">
              <button onClick={expandAll} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all font-medium">Tout deployer</button>
              <button onClick={collapseAll} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all font-medium">Tout replier</button>
            </div>

            {analysis.catStats.filter(c => c.count > 0).map((cat) => {
              const docTypes = getDocTypes(cat.docs);
              const isins = extractISINs(cat.docs);
              const isOpen = expanded[cat.id] || false;
              const detail = CAT_DETAILS[cat.id];

              return (
                <div key={cat.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden print-break">
                  <div className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: cat.color }}>
                        {cat.count}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-800 text-lg">{cat.label}</h3>
                          <span className="text-xs text-gray-400">{Math.round((cat.count / analysis.totalActive) * 100)}% du total</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{detail?.desc || ""}</p>
                      </div>
                    </div>

                    {detail?.contenu && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Contenu</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{detail.contenu}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {docTypes.map(([type, count]) => (
                        <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet/8 text-violet font-medium">
                          {type} <strong>{count}</strong>
                        </span>
                      ))}
                      {isins.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-600 font-medium">
                          ISIN <strong>{isins.length}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-100">
                    <button onClick={() => toggleExpand(cat.id)} className="w-full px-5 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-1 no-print">
                      {isOpen ? "Masquer" : "Voir les " + cat.count + " documents"}
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-50 max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-gray-50 text-gray-500 text-xs">
                              <th className="text-left px-4 py-2 font-medium">Type</th>
                              <th className="text-left px-3 py-2 font-medium">Document</th>
                              <th className="text-left px-3 py-2 font-medium w-20">Date</th>
                              <th className="text-center px-2 py-2 font-medium w-16 no-print">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.docs.map((doc, idx) => (
                              <tr key={doc.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                                <td className="px-4 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">{getDocType(doc.name)}</span></td>
                                <td className="px-3 py-1.5 text-gray-700 text-xs">{doc.name}</td>
                                <td className="px-3 py-1.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(doc.created_at)}</td>
                                <td className="px-2 py-1.5 text-center no-print">
                                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet hover:underline font-medium">Voir</a>
                                </td>
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
        )}

        {/* Footer */}
        <div className="text-center space-y-2 pt-6 border-t border-gray-200">
          <p className="text-sm font-semibold text-gray-600">Strick&apos;in - Synthese documentaire</p>
          <p className="text-xs text-gray-400">{analysis.totalActive} documents actifs - {analysis.allISINs.length} ISIN - {Object.keys(analysis.allEmitters).length} emetteurs</p>
          <p className="text-xs text-gray-300">Les documents internes et confidentiels sont exclus de cette synthese</p>
        </div>
      </div>
    </>
  );
}
