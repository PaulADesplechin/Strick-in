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

function extractISINs(docs: Doc[]): string[] {
  const isins = new Set<string>();
  for (const d of docs) {
    const matches = d.name.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/g);
    if (matches) matches.forEach(m => isins.add(m));
  }
  return Array.from(isins).sort();
}

function extractProducts(docs: Doc[]): Record<string, number> {
  const products: Record<string, number> = {};
  for (const d of docs) {
    const n = d.name;
    let product = "";
    if (n.match(/Daily D/i)) product = "Daily Degressif";
    else if (n.match(/Phoenix.*Fl/i)) product = "Phoenix Autocall Fleche";
    else if (n.match(/HIS CMS Phoenix/i)) product = "HIS CMS Phoenix Trimestriel";
    else if (n.match(/Horizon Taux/i)) product = "Horizon Taux";
    else if (n.match(/K Taux Euribor/i)) product = "K Taux Euribor";
    else if (n.match(/Monthly Step/i)) product = "Monthly Step Transat";
    else if (n.match(/Objectif Distribution/i)) product = "Objectif Distribution Trimestrielle";
    else if (n.match(/BBVA Opti Strike/i)) product = "BBVA Opti Strike Netflix ASML";
    else if (n.match(/Rendement M.*moire/i)) product = "Rendement Memoire Degressif BNP";
    else if (n.match(/Rendement Taux/i)) product = "Rendement Taux In Fine";
    else if (n.match(/Tempo Taux Italie/i)) product = "Tempo Taux Italie 10 Ans";
    else if (n.match(/Opportunit.*Autocall.*Euro/i)) product = "Opportunite Autocall Euro Stoxx Banks";
    else if (n.match(/Ath.*na.*Escalier.*Cr.*dit/i)) product = "Athena Escalier Credit Agricole";
    else if (n.match(/Ath.*na.*Escalier.*Engie/i)) product = "Athena Escalier Engie";
    else if (n.match(/Odyss.*Tempo/i)) product = "Odyssee Tempo Degressif TotalEnergies";
    if (product) products[product] = (products[product] || 0) + 1;
  }
  return products;
}

function getDocType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("brochure")) return "Brochure";
  if (n.includes("bulletin")) return "Bulletin de souscription";
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
  if (n.includes("memo")) return "Memo";
  if (n.includes("rapport")) return "Rapport";
  if (n.includes("blueprint")) return "Blueprint";
  if (n.includes("brief")) return "Brief";
  if (n.includes("interview")) return "Interview";
  if (n.includes("note") || n.includes("synthese")) return "Note de synthese";
  if (n.includes("scoping")) return "Scoping";
  if (n.includes("structure de co")) return "Structure de couts";
  return "Autre";
}

function getDocTypes(docs: Doc[]): [string, number][] {
  const types: Record<string, number> = {};
  for (const d of docs) {
    const t = getDocType(d.name);
    types[t] = (types[t] || 0) + 1;
  }
  return Object.entries(types).sort((a, b) => b[1] - a[1]);
}

function extractEmitters(docs: Doc[]): Record<string, number> {
  const emitters: Record<string, number> = {};
  for (const d of docs) {
    const n = d.name;
    if (n.match(/BNP|Cardif/i)) emitters["BNP Paribas / Cardif"] = (emitters["BNP Paribas / Cardif"] || 0) + 1;
    if (n.match(/HSBC/i)) emitters["HSBC"] = (emitters["HSBC"] || 0) + 1;
    if (n.match(/Goldman/i)) emitters["Goldman Sachs"] = (emitters["Goldman Sachs"] || 0) + 1;
    if (n.match(/BBVA/i)) emitters["BBVA"] = (emitters["BBVA"] || 0) + 1;
    if (n.match(/Julius Baer/i)) emitters["Julius Baer"] = (emitters["Julius Baer"] || 0) + 1;
    if (n.match(/Marex/i)) emitters["Marex Solutions"] = (emitters["Marex Solutions"] || 0) + 1;
    if (n.match(/MeilleurTaux/i)) emitters["MeilleurTaux Placement"] = (emitters["MeilleurTaux Placement"] || 0) + 1;
  }
  return emitters;
}

function extractUnderlyings(docs: Doc[]): string[] {
  const set = new Set<string>();
  for (const d of docs) {
    const n = d.name;
    if (n.match(/Euro Stoxx.*Bank/i)) set.add("Euro Stoxx Banks");
    if (n.match(/Euro Stoxx 50/i)) set.add("Euro Stoxx 50");
    if (n.match(/DAX/i)) set.add("DAX");
    if (n.match(/Netflix/i)) set.add("Netflix");
    if (n.match(/ASML/i)) set.add("ASML");
    if (n.match(/TotalEnergies/i)) set.add("TotalEnergies");
    if (n.match(/Credit Agricole/i) || n.match(/Cr.*dit Agricole/i)) set.add("Credit Agricole");
    if (n.match(/Engie/i)) set.add("Engie");
    if (n.match(/Bitcoin/i)) set.add("Bitcoin");
    if (n.match(/MSFT/i)) set.add("Microsoft (MSFT)");
    if (n.match(/Euribor/i)) set.add("Euribor");
    if (n.match(/Italie/i)) set.add("Taux Italie 10 ans");
  }
  return Array.from(set).sort();
}

function extractStructures(docs: Doc[]): string[] {
  const set = new Set<string>();
  for (const d of docs) {
    const n = d.name.toLowerCase();
    if (n.includes("autocall")) set.add("Autocall");
    if (n.includes("phoenix")) set.add("Phoenix");
    if (n.includes("athena") || n.includes("ath")) set.add("Athena");
    if (n.includes("degressif")) set.add("Degressif / Step-Down");
    if (n.includes("brc") || n.includes("barrier reverse")) set.add("Barrier Reverse Convertible");
    if (n.includes("capital prot")) set.add("Capital Protege");
    if (n.includes("in fine")) set.add("In Fine");
    if (n.includes("memoire") || n.includes("m")) set.add("Effet Memoire");
  }
  return Array.from(set).sort();
}

const CAT_DETAILS: Record<string, { desc: string; contenu: string }> = {
  "01_Presentations": {
    desc: "Supports de presentation commerciale et strategique de Strick'in pour differentes audiences (investisseurs, assureurs, partenaires).",
    contenu: "5 documents couvrant le positionnement strategique de la plateforme : 2 versions du pitch deck investisseurs (v1 et v2), 1 presentation dediee aux assureurs detaillant l'integration avec les reseaux de distribution, 1 presentation sur le modele de distribution digitale des produits structures, et la version finale de reference (v2.6). Les decks presentent la proposition de valeur, le modele economique, la taille du marche adressable et la roadmap produit."
  },
  "02_Documents": {
    desc: "Corpus strategique et fondateur du projet Strick'in. Documentation interne detaillee couvrant la genese, la vision et la structuration du projet.",
    contenu: "12 documents fondateurs : le Blueprint Fintech (architecture technique et business), le Brief Complet (cahier des charges), 2 versions du Memo Fondateur (vision et pivots strategiques), la Note de Synthese, un Rapport de 400 pages (analyse exhaustive du marche), un Rapport Condense, le Recapitulatif Projet Complet, une Interview (positionnement media), un Scoping post-reunion FLE (15 Dec 2025), la Structure de Couts detaillee et une Presentation Generale."
  },
  "03_Tableurs": {
    desc: "Catalogues de produits structures fournis par Julius Baer et autres emetteurs. Suivi regulier avec mises a jour frequentes.",
    contenu: "9 fichiers tableurs dont 7 catalogues Julius Baer dates entre janvier et mars 2026 (certains le meme jour a differentes heures, refletant les mises a jour intra-journalieres des prix), plus 2 tableurs de suivi complementaires. Chaque catalogue contient les references ISIN, les sous-jacents, barrieres, coupons et conditions de chaque produit disponible."
  },
  "04_Branding_Strikin": {
    desc: "Identite visuelle et charte de marque de Strick'in. Documentation de reference pour toutes les communications.",
    contenu: "4 documents : le Brand Book v1 et v2 (evolution de l'identite de marque avec logo, valeurs, tone of voice) et la Charte Graphique v1 et v2 (palette couleurs, typographies, regles d'utilisation du logo, templates de mise en page)."
  },
  "05_Produits_Cardif": {
    desc: "Documentation commerciale et reglementaire complete des produits structures distribues via BNP Paribas Cardif. Dossier le plus volumineux de la base.",
    contenu: "78 documents couvrant environ 16 produits structures distincts. Pour chaque produit, le dossier complet comprend generalement : la Brochure commerciale, le Bulletin de Souscription, les Conditions detaillees, la Fiche Rapide (resume 1 page) et le KID reglementaire (Document d'Information Cle). Produits phares : Daily Degressif, Phoenix Autocall Fleche, HIS CMS Phoenix Trimestriel, Horizon Taux, BBVA Opti Strike Netflix ASML, Rendement Memoire Degressif BNP, Monthly Step Transat, K Taux Euribor, Objectif Distribution Trimestrielle, Odyssee Tempo Degressif TotalEnergies, Athena Escalier (Credit Agricole et Engie), Opportunite Autocall Euro Stoxx Banks, Rendement Taux In Fine et Tempo Taux Italie 10 Ans. Emetteurs : BNP Paribas, HSBC, Goldman Sachs, BBVA. Inclut aussi le Mode Operatoire Commissions Assurance Cardif 2024."
  },
  "06_Produits_MeilleurTaux": {
    desc: "Documents d'Information Cle (KID) pour la gamme de produits structures distribues via MeilleurTaux Placement.",
    contenu: "18 KID reglementaires pour les produits MT11 a MT28. Chaque KID contient les objectifs du produit, le profil investisseur cible, les scenarios de performance, les risques, les couts et la duree recommandee. Serie coherente de produits numerotes refletant un partenariat de distribution regulier."
  },
  "07_Marex": {
    desc: "Documentation de structuration via Marex Solutions : term sheets, tests de produits et documentation emetteur.",
    contenu: "23 documents : 17 produits structures de test (Test 1 a Test 17) montrant l'iteration sur les parametres de structuration, 2 Autocallable & BRC specifiques (Produit MD et Produit Toxic, 12 mois USD), 1 Autocallable & BRC Bitcoin (12 mois EUR v2), 1 BRC DAX (17 mois EUR - Test 4), 1 Capital Protege Euro Stoxx 50, 1 Final Terms HSBC (Recovery Coupon Autocall, Jan 2036, ISIN FR0014013546) et 1 NewCo Brief Business Plan Go/No Go. Sous-jacents testes : DAX, MSFT, Bitcoin, Euro Stoxx 50."
  },
  "08_Fiches_Produits": {
    desc: "Documentation pedagogique et de reference sur les produits structures.",
    contenu: "2 documents : le Guide Complet des Produits Structures (documentation pedagogique couvrant les mecanismes, la fiscalite et les risques) et 1 KID de reference (Produit XS1704831624)."
  },
  "09_Code_Produits_Structures": {
    desc: "Templates et modeles de code pour la structuration parametrique de produits.",
    contenu: "2 modeles de code : un template Autocall (modele de structuration automatique avec barrieres, coupons et rappel anticipe) et un template Produit generique (modele parametrique adaptable a differents types de payoffs)."
  },
  "10_Doublons": {
    desc: "Fichiers en double detectes et isoles de la base active. Principalement des copies de documents Cardif.",
    contenu: "18 fichiers dupliques identifies et deplaces : bulletins de souscription en double (BBVA Opti Strike x3), fiches rapides dupliquees (Athena Escalier, Daily Degressif), KID en copie (Horizon Taux, Rendement Memoire, Rendement Taux In Fine, etc.) et quelques presentations dupliquees."
  },
};

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

  const analysis = useMemo(() => {
    const total = documents.length;
    const active = documents.filter(d => d.category !== "10_Doublons");
    const totalActive = active.length;
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

    const allISINs = extractISINs(active);
    const allProducts = extractProducts(active);
    const allEmitters = extractEmitters(active);
    const allUnderlyings = extractUnderlyings(active);
    const allStructures = extractStructures(active);
    const allTypes = getDocTypes(active);

    const newest = documents[0] || null;
    const oldest = documents.length > 0 ? documents.reduce((o, d) => new Date(d.created_at) < new Date(o.created_at) ? d : o) : null;

    return { total, totalActive, catStats, allISINs, allProducts, allEmitters, allUnderlyings, allStructures, allTypes, newest, oldest };
  }, [documents]);

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const expandAll = () => { const a: Record<string, boolean> = {}; CATEGORIES.forEach(c => a[c.id] = true); setExpanded(a); };
  const collapseAll = () => setExpanded({});

  const printCSS = `@media print { nav,.no-print,header,footer{display:none!important} body{background:white!important} .print-break{page-break-before:always} *{print-color-adjust:exact;-webkit-print-color-adjust:exact} }`;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet" /></div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />
      <div ref={printRef} className="max-w-5xl mx-auto space-y-10 pb-16">

        {/* Nav */}
        <div className="flex items-center justify-between no-print">
          <Link href="/" className="flex items-center gap-2 text-violet hover:underline font-medium text-sm">&larr; Retour au portail</Link>
          <div className="flex gap-2">
            <button onClick={expandAll} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all font-medium">Tout deployer</button>
            <button onClick={collapseAll} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-all font-medium">Tout replier</button>
            <button onClick={() => window.print()} className="px-4 py-1.5 bg-violet text-white rounded-lg text-xs font-medium hover:bg-violet/90 transition-all">Exporter PDF</button>
          </div>
        </div>

        {/* Title */}
        <div className="bg-gradient-to-br from-violet/5 via-violet/8 to-violet/12 rounded-2xl p-8 border border-violet/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-violet uppercase tracking-widest mb-3">Synthese documentaire complete</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Strick&apos;in</h1>
              <p className="text-gray-500 text-sm">Plateforme de distribution digitale de produits structures</p>
            </div>
            <div className="text-right text-sm text-gray-400 space-y-1">
              <p>Genere le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="font-semibold text-gray-700 text-lg">{analysis.totalActive} documents actifs</p>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b-2 border-violet/20 pb-2">1. Synthese executive</h2>
          <div className="bg-gray-50 rounded-xl p-5 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              La base documentaire <strong>Strick&apos;in</strong> centralise <strong>{analysis.totalActive} documents actifs</strong> repartis
              en <strong>{analysis.catStats.filter(c => c.count > 0 && c.id !== "10_Doublons").length} categories</strong>.
              Elle constitue le referentiel unique pour l&apos;ensemble des activites de structuration et de distribution de produits structures de la plateforme.
            </p>
            <p>
              Le corpus couvre l&apos;integralite du cycle de vie : de la <strong>conception</strong> (memos fondateurs, blueprints, scoping) a la
              <strong> commercialisation</strong> (brochures, KID, bulletins de souscription), en passant par la <strong>structuration</strong> (term sheets, tests Marex)
              et la <strong>communication</strong> (pitch decks, brand books). La documentation identifie <strong>{analysis.allISINs.length} codes ISIN distincts</strong>,
              <strong> {Object.keys(analysis.allProducts).length} produits structures nommes</strong>,
              <strong> {Object.keys(analysis.allEmitters).length} emetteurs/partenaires</strong> et
              <strong> {analysis.allUnderlyings.length} sous-jacents references</strong>.
            </p>
            <p>
              Le dossier <strong>Produits Cardif</strong> represente {analysis.catStats.find(c => c.id === "05_Produits_Cardif")?.count || 0} documents ({Math.round(((analysis.catStats.find(c => c.id === "05_Produits_Cardif")?.count || 0) / analysis.totalActive) * 100)}% du total),
              suivi de <strong>Marex</strong> ({analysis.catStats.find(c => c.id === "07_Marex")?.count || 0}) et <strong>MeilleurTaux</strong> ({analysis.catStats.find(c => c.id === "06_Produits_MeilleurTaux")?.count || 0}).
              {analysis.catStats.find(c => c.id === "10_Doublons")?.count || 0} doublons ont ete detectes et isoles.
            </p>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { val: analysis.totalActive, label: "Docs actifs", color: "text-violet" },
            { val: analysis.allISINs.length, label: "Codes ISIN", color: "text-emerald-600" },
            { val: Object.keys(analysis.allProducts).length, label: "Produits nommes", color: "text-blue-600" },
            { val: Object.keys(analysis.allEmitters).length, label: "Emetteurs", color: "text-orange-600" },
            { val: analysis.allUnderlyings.length, label: "Sous-jacents", color: "text-purple-600" },
            { val: analysis.allTypes.length, label: "Types de docs", color: "text-rose-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </section>

        {/* Analytical Panels */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b-2 border-violet/20 pb-2">2. Analyse transversale</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Emitters */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Emetteurs / Partenaires identifies</h3>
              <div className="space-y-2">
                {Object.entries(analysis.allEmitters).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">{name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-violet/20" style={{ width: Math.max(20, (count / Math.max(...Object.values(analysis.allEmitters))) * 100) + "px" }}>
                        <div className="h-full rounded-full bg-violet" style={{ width: "100%" }} />
                      </div>
                      <span className="text-xs font-bold text-violet w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Underlyings */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Sous-jacents references</h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.allUnderlyings.map(u => (
                  <span key={u} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">{u}</span>
                ))}
              </div>
            </div>

            {/* Structures */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Types de structures utilisees</h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.allStructures.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{s}</span>
                ))}
              </div>
            </div>

            {/* Doc Types */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Repartition par type de document</h3>
              <div className="space-y-1.5">
                {analysis.allTypes.map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{type}</span>
                    <span className="text-xs font-bold text-violet">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ISINs */}
          {analysis.allISINs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Codes ISIN identifies ({analysis.allISINs.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.allISINs.map(isin => (
                  <code key={isin} className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">{isin}</code>
                ))}
              </div>
            </div>
          )}

          {/* Named Products */}
          {Object.keys(analysis.allProducts).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Produits structures nommes ({Object.keys(analysis.allProducts).length})</h3>
              <div className="grid md:grid-cols-2 gap-2">
                {Object.entries(analysis.allProducts).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-gray-700">{name}</span>
                    <span className="text-xs font-bold text-violet">{count} docs</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Category Detail */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b-2 border-violet/20 pb-2">3. Detail par categorie</h2>

          {analysis.catStats.filter(c => c.count > 0).map((cat) => {
            const docTypes = getDocTypes(cat.docs);
            const isins = extractISINs(cat.docs);
            const isOpen = expanded[cat.id] || false;
            const detail = CAT_DETAILS[cat.id];
            const latestDoc = cat.docs[0];

            return (
              <div key={cat.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden print-break">
                <div className="p-5 space-y-4">
                  {/* Category Title */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: cat.color }}>
                      {cat.count}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-lg">{cat.label}</h3>
                        <span className="text-xs text-gray-400">{latestDoc ? "Maj : " + formatDate(latestDoc.created_at) : ""}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{detail?.desc || ""}</p>
                    </div>
                  </div>

                  {/* Detailed Content Description */}
                  {detail?.contenu && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contenu detaille</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{detail.contenu}</p>
                    </div>
                  )}

                  {/* Type + ISIN pills */}
                  <div className="flex flex-wrap gap-3">
                    {docTypes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 font-medium">Types</p>
                        <div className="flex flex-wrap gap-1">
                          {docTypes.map(([type, count]) => (
                            <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet/8 text-violet font-medium">
                              {type} <strong>{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {isins.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 font-medium">ISIN ({isins.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {isins.slice(0, 8).map(isin => (
                            <code key={isin} className="px-1.5 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-500">{isin}</code>
                          ))}
                          {isins.length > 8 && <span className="text-xs text-gray-400">+{isins.length - 8}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable Document List */}
                <div className="border-t border-gray-100">
                  <button onClick={() => toggleExpand(cat.id)} className="w-full px-5 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-1 no-print">
                    {isOpen ? "Masquer la liste des documents" : "Afficher les " + cat.count + " documents"}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-50 max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-50 text-gray-500 text-xs">
                            <th className="text-left px-5 py-2 font-medium">#</th>
                            <th className="text-left px-3 py-2 font-medium">Type</th>
                            <th className="text-left px-3 py-2 font-medium">Document</th>
                            <th className="text-left px-3 py-2 font-medium w-24">Date</th>
                            <th className="text-right px-5 py-2 font-medium w-20">Taille</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.docs.map((doc, idx) => (
                            <tr key={doc.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                              <td className="px-5 py-1.5 text-gray-300 text-xs">{idx + 1}</td>
                              <td className="px-3 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{getDocType(doc.name)}</span></td>
                              <td className="px-3 py-1.5 text-gray-700 text-xs">{doc.name}</td>
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
        </section>

        {/* Footer */}
        <div className="text-center space-y-2 pt-6 border-t-2 border-violet/10">
          <p className="text-sm font-semibold text-gray-600">Strick&apos;in - Synthese documentaire complete</p>
          <p className="text-xs text-gray-400">Document genere automatiquement le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="text-xs text-gray-400">{analysis.total} documents indexes dont {analysis.totalActive} actifs - {analysis.allISINs.length} ISIN - {Object.keys(analysis.allProducts).length} produits structures</p>
        </div>
      </div>
    </>
  );
}
