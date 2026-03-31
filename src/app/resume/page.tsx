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

const FILE_SUMMARIES: Record<string, string> = {
  // 01_Presentations
  "Pitch Deck \u2014 Plateforme Structur\u00e9s v2": "Deuxieme version du pitch deck investisseurs presentant le modele economique de Strick'in, la taille du marche des produits structures en France (80Mds EUR), le positionnement B2B2C, la strategie de distribution digitale, les projections financieres sur 3 ans et les besoins de financement. Inclut la comparaison concurrentielle et les avantages technologiques de la plateforme.",
  "Pr\u00e9sentation \u2014 Distribution Produits Structur\u00e9s Digitale": "Presentation detaillee du modele de distribution digitale des produits structures : chaine de valeur de l'emission a la souscription, role des distributeurs (CGP, courtiers, banques privees), integration API avec les emetteurs, flux de donnees en temps reel (prix, ISIN, barrieres), et conformite reglementaire (MiFID II, PRIIPs, DDA).",
  "Pr\u00e9sentation Strick'in \u2014 Assureurs": "Deck specifiquement concu pour les assureurs partenaires (Cardif, Generali, Suravenir). Presente l'integration technique en marque blanche, les flux de souscription digitalises, le reporting automatise, la gestion des commissions, et les avantages de la plateforme pour reduire les couts de distribution et ameliorer le time-to-market des nouveaux produits.",
  "Pr\u00e9sentation Strick'in \u2014 Finale v2.6": "Version de reference la plus recente (v2.6) de la presentation Strick'in. Synthese complete du projet : vision, equipe, technologie (Next.js, Supabase, API temps reel), pipeline commercial, partenariats signes (Julius Baer, Marex, BNP Cardif), roadmap produit 2026-2027, et metriques cles de traction.",
  "Pr\u00e9sentation Strick'in \u2014 Version Finale": "Premiere version finale de la presentation corporate. Couvre le positionnement de Strick'in comme plateforme SaaS de distribution de produits structures, l'analyse du marche, les cas d'usage par segment de clientele, et la proposition de valeur differenciante par rapport aux solutions existantes.",

  // 02_Documents (most are sensitive/hidden, but summaries still needed for the function)
  "Blueprint Fintech \u2014 Strick'in": "Document d'architecture technique et fonctionnelle complet de la plateforme fintech. Decrit le stack technologique (Next.js 14, TypeScript, Supabase, Vercel), l'architecture microservices, les APIs de pricing, le moteur de matching produits/profils investisseurs, les flux de conformite KYC/AML, et le plan de scalabilite infrastructure.",
  "Brief Complet \u2014 Strick'in": "Brief strategique exhaustif du projet Strick'in : genese du projet, analyse de marche detaillee (marche francais et europeen des produits structures), identification des pain points distributeurs, proposition de valeur, modele de revenus (SaaS + commissions), plan de go-to-market et jalons cles.",
  "Interview Compl\u00e8te \u2014 Strick'in": "Transcription complete d'entretiens avec des acteurs cles du marche (CGP, banquiers prives, structureurs) pour valider le product-market fit. Retours terrain sur les besoins en digitalisation, les frustrations avec les processus actuels, et les fonctionnalites attendues d'une plateforme de distribution.",
  "M\u00e9mo Fondateur v1 \u2014 Strick'in": "Premier memo fondateur decrivant la vision initiale du projet, l'opportunite de marche identifiee, le parcours et les motivations du fondateur, les premieres hypotheses de business model, et les etapes de validation envisagees.",
  "M\u00e9mo Fondateur v2 \u2014 Strick'in": "Version actualisee du memo fondateur integrant les retours des premiers entretiens investisseurs, les ajustements du business model, les premiers partenariats en discussion, et la strategie de levee de fonds.",
  "Note de Synth\u00e8se \u2014 Strick'in": "Synthese executive de 2-3 pages resumant le projet Strick'in pour des interlocuteurs de haut niveau : marche cible, solution proposee, avantage competitif, equipe, traction actuelle et prochaines etapes. Document concu pour les prises de contact rapides avec investisseurs et partenaires.",
  "Pr\u00e9sentation G\u00e9n\u00e9rale \u2014 Strick'in": "Presentation generale couvrant tous les aspects de Strick'in : contexte marche, problematique de distribution, solution technologique, demo de la plateforme, partenariats, modele economique et roadmap. Document polyvalent pour differentes audiences (prospects, partenaires, investisseurs).",
  "Rapport 400 Pages \u2014 Strick'in": "Rapport de recherche approfondi de 400 pages sur le marche des produits structures : analyse quantitative des volumes d'emission, cartographie complete des acteurs (emetteurs, distributeurs, assureurs), benchmark reglementaire europeen, etude des tendances (ESG, crypto-structures, produits verts), et opportunites de digitalisation par segment.",
  "Rapport Condens\u00e9 Complet \u2014 Strick'in": "Version condensee du rapport de recherche (environ 50 pages) reprenant les conclusions cles, les chiffres de marche les plus significatifs, les profils d'acteurs majeurs, et les recommandations strategiques pour le positionnement de Strick'in.",
  "R\u00e9capitulatif Projet Complet \u2014 Strick'in": "Document recapitulatif complet du projet couvrant toutes les dimensions : historique, equipe, technologie, produit, commercial, financier, juridique. Sert de document de reference interne et de base pour les due diligences.",
  "Scoping FLE \u2014 Post R\u00e9union 15 D\u00e9c 2025": "Compte-rendu et cadrage post-reunion du 15 decembre 2025. Definit le perimetre fonctionnel de la phase 1, les priorites de developpement, les ressources necessaires, le calendrier previsionnel, et les decisions prises concernant les choix technologiques et les premiers partenaires a embarquer.",
  "Structure de Co\u00fbts \u2014 Strick'in": "Decomposition detaillee de la structure de couts de Strick'in : couts de developpement (equipe tech, infra cloud), couts de conformite reglementaire (AMF, ACPR), couts commerciaux (acquisition, retention), couts operationnels, et projections de rentabilite sur 3-5 ans avec differents scenarios de croissance.",

  // 03_Tableurs
  "Julius Baer \u2014 Catalogue Produits (19 Jan 2026 - 12h30)": "Catalogue complet des produits structures Julius Baer au 19 janvier 2026 (mise a jour 12h30). Contient les prix mid/ask en temps reel, les codes ISIN, les sous-jacents (indices, actions, taux), les barrieres de protection du capital, les coupons, les dates d'observation autocall, et les maturites. Environ 50-80 produits actifs disponibles a la commercialisation.",
  "Julius Baer \u2014 Catalogue Produits (19 Jan 2026 - 15h20)": "Mise a jour intra-journaliere du catalogue Julius Baer (15h20). Reflete les variations de prix de l'apres-midi suite aux mouvements de marche europeens. Les ecarts de prix entre les deux snapshots permettent d'observer la sensibilite des produits aux variations des sous-jacents.",
  "Julius Baer \u2014 Catalogue Produits (20 Jan 2026)": "Catalogue produits Julius Baer du 20 janvier 2026. Nouvelle journee de cotation avec potentiellement de nouveaux produits ajoutes et des produits arrives a maturite retires. Inclut les memes colonnes de reference (ISIN, strike, barriere, coupon, worst-of).",
  "Julius Baer \u2014 Catalogue Produits (23 Jan 2026 - 15h29)": "Snapshot du catalogue Julius Baer du 23 janvier a 15h29. Suivi de l'evolution des prix sur la semaine, avec mise en evidence des produits proches de leurs barrieres autocall ou de leurs barrieres de protection (knock-in).",
  "Julius Baer \u2014 Catalogue Produits (23 Jan 2026 - 15h30)": "Second snapshot pris une minute apres le precedent (15h30 vs 15h29). Permet de verifier la stabilite des prix et la coherence des flux de donnees en quasi temps reel entre la plateforme Julius Baer et le systeme Strick'in.",
  "Julius Baer \u2014 Catalogue Produits (8 Mars 2026 - 9h30)": "Catalogue de debut mars 2026 (ouverture de marche). Reflete les nouvelles emissions du debut de trimestre, les ajustements de pricing post-resultats d'entreprises, et les nouvelles structures lancees pour le T2 2026. Mise a jour des sous-jacents avec integration de nouveaux indices sectoriels.",
  "Julius Baer \u2014 Catalogue Produits (8 Mars 2026 - 9h31)": "Snapshot de controle qualite pris une minute apres le precedent. Verification de la coherence des donnees et de la latence du flux de prix entre les systemes Julius Baer et la base Strick'in.",
  "Produits Strick'in \u2014 Suivi Global": "Tableur de suivi global de l'ensemble des produits distribues par Strick'in toutes sources confondues. Consolide les donnees Julius Baer, Marex, BNP Cardif et MeilleurTaux avec un suivi des encours, des souscriptions, des performances et des commissions par produit et par canal de distribution.",
  "Produits Strick'in \u2014 Suivi Global v2": "Version actualisee du suivi global avec ajout de colonnes de performance (rendement depuis lancement, distance a la barriere, prochaine date autocall), un onglet de reporting par conseiller, et des graphiques de repartition par type de structure et par emetteur.",

  // 04_Branding_Strikin
  "Brand Book Strick'in v1": "Premiere version du brand book definissant l'identite de marque Strick'in : logo principal et variantes (monochrome, sur fond sombre), palette de couleurs (violet #7B5CFF, gris, blanc), typographies (titres et corps de texte), iconographie, ton de communication (professionnel mais accessible), et exemples d'application sur supports digitaux et print.",
  "Brand Book Strick'in v2": "Version enrichie du brand book avec ajout des guidelines pour les reseaux sociaux, les templates de presentation, les signatures email, les banniers web, les elements d'interface utilisateur (boutons, cartes, formulaires), et un guide de redaction pour maintenir la coherence de marque sur tous les canaux.",
  "Charte Graphique Strick'in v1": "Premiere charte graphique technique avec les specifications exactes : codes couleurs (HEX, RGB, CMJN), corps de texte minimum, marges de securite du logo, grille de mise en page, et regles d'utilisation sur differents supports (ecran, impression, petit format).",
  "Charte Graphique Strick'in v2": "Charte graphique mise a jour integrant les retours d'utilisation : ajustements des contrastes pour l'accessibilite (WCAG AA), nouvelles declinaisons du logo pour les formats mobiles, ajout de pictogrammes metier (produits structures, performance, protection), et templates Figma pour l'equipe design.",

  // 08_Fiches_Produits
  "Guide Complet \u2014 Produits Structur\u00e9s": "Guide pedagogique exhaustif de 80+ pages couvrant tous les types de produits structures : Autocall (Phoenix, Athena), Reverse Convertible, Certificats, Warrants, produits a capital garanti et a capital protege. Pour chaque structure : mecanisme detaille avec schemas, scenarios de gain/perte, profil de risque (delta, vega, gamma), cas d'usage par profil investisseur, et exemples concrets avec des produits reels. Inclut un glossaire complet des termes techniques.",
  "KID de R\u00e9f\u00e9rence \u2014 Produits Structur\u00e9s": "Document d'informations cles (KID) generique servant de modele de reference pour tous les produits structures distribues. Conforme a la reglementation PRIIPs, il presente la structure standard d'un KID : objectifs du produit, profil de risque (indicateur SRI 1-7), scenarios de performance (favorable, intermediaire, defavorable, stress), couts totaux (entree, sortie, recurrents), et duree de detention recommandee.",

  // 09_Code_Produits_Structures
  "Template Autocall \u2014 Strick'in": "Template technique parametrable pour generer automatiquement la documentation d'un produit Autocall. Parametres configurables : sous-jacent(s), strike, barriere autocall (en % du strike), barriere de protection du capital (knock-in), frequence d'observation (mensuelle, trimestrielle, annuelle), coupon conditionnel, memoire de coupon (oui/non), et decrementation. Genere automatiquement les scenarios de remboursement anticipe et le profil de gain/perte.",
  "Template Produit G\u00e9n\u00e9rique \u2014 Strick'in": "Template generique adaptable a tout type de produit structure (Autocall, Phoenix, Reverse Convertible, produit a capital garanti). Systeme de modules interchangeables : module de protection (barriere europeenne, americaine, airbag), module de rendement (coupon fixe, conditionnel, participation), module de remboursement (autocall, in fine, acceleration). Permet de creer une fiche produit complete en moins de 5 minutes.",

  // 10_Doublons
  "Brochure \u2014 Daily D\u00e9gressif (F\u00e9v 2026)": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Brochure \u2014 HIS CMS Phoenix Trimestriel In Fine (F\u00e9v 2026)": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Brochure \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks \u2014 XS3170663259": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Bulletin Souscription \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks \u2014 XS3170663259": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Conditions \u2014 Ath\u00e9na Escalier Cr\u00e9dit Agricole & Engie (Jan 2026)": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Conditions \u2014 Ath\u00e9na Escalier Cr\u00e9dit Agricole & Engie (Jan 2026) v2": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Conditions \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks \u2014 XS3170663259": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Fiche Rapide \u2014 HIS CMS Phoenix Trimestriel In Fine (F\u00e9v 2026)": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Fiche Rapide \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID \u2014 HIS CMS Phoenix Trimestriel In Fine (F\u00e9v 2026)": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks (F\u00e9v 2026)": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID MeilleurTaux \u2014 Produit MT14": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID MeilleurTaux \u2014 Produit MT15": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID MeilleurTaux \u2014 Produit MT19": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID MeilleurTaux \u2014 Produit MT20": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "KID MeilleurTaux \u2014 Produit MT21": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Marex \u2014 Term Sheet Phoenix Autocall Worst-of (Engie, BNP) \u2014 Test 9": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",
  "Marex \u2014 Term Sheet Phoenix BRC 1Y EUR \u2014 Test 7": "Copie en doublon identifiee et isolee. Le fichier original se trouve dans sa categorie source. Ce document a ete detecte automatiquement lors de l'audit de la base documentaire et deplace ici pour eviter les confusions.",

  // 05_Produits_Cardif - Brochures
  "Brochure \u2014 BBVA Opti Strike Netflix ASML (F\u00e9v 2026) \u2014 XS3184672429": "Brochure commerciale du produit Opti Strike emis par BBVA sur un panier worst-of Netflix / ASML. Structure a capital non garanti avec mecanisme de strike optimise : le strike est fixe au niveau le plus bas du sous-jacent observe pendant les 3 premiers mois, offrant un point d'entree potentiellement plus favorable. Coupon conditionnel trimestriel de 2.5% (10% p.a.) si aucun sous-jacent ne passe sous 60% du strike. Barriere de protection a 50% du strike a maturite (3 ans). Risque de perte en capital si un sous-jacent clot sous la barriere.",
  "Brochure \u2014 Daily D\u00e9gressif (F\u00e9v 2026)": "Brochure du produit Daily Degressif distribue via Cardif. Structure autocallable avec observation quotidienne et seuil d'autocall degressif (le seuil de remboursement anticipe baisse progressivement, par exemple de 100% a 80% du strike). Coupon memoire de 8% p.a. verse si le sous-jacent est au-dessus du seuil de coupon. Protection du capital a maturite avec barriere a 50% du strike. Duree maximale 10 ans.",
  "Brochure \u2014 HIS CMS Phoenix Trimestriel In Fine (F\u00e9v 2026)": "Brochure du produit HIS CMS Phoenix avec remboursement in fine. Contrairement a un Phoenix classique (autocallable), ce produit ne prevoit pas de remboursement anticipe : le capital est rembourse uniquement a maturite. Coupon trimestriel conditionnel avec effet memoire lie a la performance du sous-jacent. Si le sous-jacent est au-dessus de la barriere de coupon a chaque date d'observation, le coupon est verse ; sinon il est mis en memoire et rattrape des que la condition est remplie.",
  "Brochure \u2014 Horizon Taux (Mars 2026)": "Brochure du produit Horizon Taux distribue via Cardif en mars 2026. Produit structure sur taux d'interet (CMS EUR ou taux swap) plutot que sur actions. Offre un coupon fixe garanti les premieres annees puis un coupon variable indexe sur l'ecart de taux (ex: CMS 10Y - CMS 2Y). Protection du capital a 100% a maturite. Produit destine aux investisseurs recherchant un rendement regulier avec une sensibilite aux mouvements de courbe de taux.",
  "Brochure \u2014 K Taux Euribor (F\u00e9v 2026) \u2014 FR5CIBFS0455": "Brochure du produit K Taux Euribor emis en fevrier 2026. Structure indexee sur l'Euribor 3 mois avec un mecanisme de coupon conditionnel : tant que l'Euribor 3M reste dans un corridor predefined (ex: entre 1% et 4%), l'investisseur recoit un coupon bonifie. Si l'Euribor sort du corridor, le coupon est reduit ou nul. Capital garanti a 100% a maturite. Duree 5-7 ans.",
  "Brochure \u2014 Monthly Step Transat (F\u00e9v 2026) \u2014 DE000UJ56SD2": "Brochure du produit Monthly Step Transat emis par un emetteur allemand (DE000). Structure autocallable mensuelle avec coupon step-up progressif : le coupon augmente a chaque date d'observation ou le produit n'est pas rappele (ex: 0.5% le mois 1, 0.55% le mois 2, etc.). Sous-jacent potentiellement transatlantique (indices EU + US). Barriere de protection a 60-65% du strike.",
  "Brochure \u2014 Objectif Distribution Trimestrielle (F\u00e9v 2026) \u2014 FRSG000178R5": "Brochure du produit Objectif Distribution Trimestrielle emis par Societe Generale (FRSG). Structure concue pour generer un revenu regulier trimestriel. Coupon fixe ou quasi-fixe verse chaque trimestre independamment de la performance du sous-jacent, avec protection conditionnelle du capital a maturite. Cible les investisseurs en quete de revenus periodiques previsibles.",
  "Brochure \u2014 Odyss\u00e9e Tempo D\u00e9gressif TotalEnergies (Jan 2026)": "Brochure du produit Odyssee Tempo Degressif sur l'action TotalEnergies. Autocall avec seuil degressif (le niveau de rappel anticipe diminue au fil du temps) et temporalite specifique (observations mensuelles ou trimestrielles). Le mecanisme 'tempo' implique une acceleration ou un ralentissement des observations selon la performance du sous-jacent. Barriere de protection et coupon memoire conditionnel.",
  "Brochure \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks \u2014 XS3170663259": "Brochure du produit Opportunite Autocall sur l'indice Euro Stoxx Banks. Structure autocallable classique avec observation periodique : si l'indice est au-dessus du strike a une date d'observation, le produit est rembourse par anticipation avec un coupon cumule. Sous-jacent sectoriel bancaire europeen offrant une exposition aux grandes banques de la zone euro. Barriere de protection a 60% du strike.",
  "Brochure \u2014 Phoenix Autocall Fl\u00e8che (Mars 2026) \u2014 FR1459ABA714": "Brochure du produit Phoenix Autocall Fleche distribue en mars 2026. Structure combinant un Phoenix (coupon conditionnel periodique avec memoire) et un mecanisme 'fleche' (le coupon augmente significativement si le sous-jacent depasse un certain seuil, ex: +150% si au-dessus de 110% du strike). Sous-jacent action ou indice, observation trimestrielle, barriere de protection a 50-60%.",
  "Brochure \u2014 Produit XS2814261926": "Brochure d'un produit structure identifie par son ISIN XS2814261926. Emis sur le marche international (prefixe XS), ce produit offre une structure de rendement conditionnel avec protection partielle du capital. Les caracteristiques specifiques (sous-jacent, barriere, coupon) sont detaillees dans la brochure complete.",
  "Brochure \u2014 Produit XS3125093420": "Brochure d'un produit structure international (ISIN XS3125093420). Documentation commerciale presentant le mecanisme de remuneration, les scenarios de performance, le profil de risque, et les conditions de remboursement anticipees ou a maturite.",
  "Brochure \u2014 Rendement M\u00e9moire D\u00e9gressif BNP (F\u00e9v 2026) \u2014 XS3170753": "Brochure du produit Rendement Memoire Degressif emis par BNP Paribas. Combine trois mecanismes cles : (1) coupon a memoire - les coupons non verses sont cumules et payes des que la condition est remplie, (2) seuil degressif - le niveau d'autocall diminue progressivement, et (3) protection du capital via barriere a maturite. Un des produits phares de la gamme Cardif.",
  "Brochure \u2014 Rendement Taux In Fine (Mars 2026)": "Brochure du produit Rendement Taux In Fine distribue en mars 2026. Produit sur taux d'interet sans mecanisme d'autocall (remboursement uniquement a maturite). Offre un coupon fixe ou indexe sur les taux, avec capital garanti ou protege a l'echeance. Destine aux profils conservateurs cherchant un complement de rendement par rapport aux fonds euros.",
  "Brochure BNP \u2014 Tempo Taux Italie 10 Ans (Mars 2026) \u2014 FR0014014QI4": "Brochure du produit Tempo Taux Italie 10 Ans emis par BNP Paribas. Structure indexee sur le taux souverain italien a 10 ans (BTP). Coupon conditionnel verse tant que le spread Italie/Allemagne ou le taux absolu reste dans des bornes predefinies. Le mecanisme 'tempo' module la frequence des observations. Capital garanti a maturite par BNP Paribas.",
  "Brochure Optimis\u00e9e \u2014 Rendement M\u00e9moire D\u00e9gressif BNP (F\u00e9v 2026)": "Version optimisee de la brochure Rendement Memoire Degressif BNP avec mise en page amelioree, graphiques de scenarios plus lisibles, comparaison de performance vs placement classique (fonds euro, livret A), et section FAQ repondant aux questions frequentes des conseillers et investisseurs.",

  // 05_Produits_Cardif - Bulletins de Souscription
  "Bulletin Souscription \u2014 BBVA Opti Strike Netflix ASML \u2014 XS3184672429": "Formulaire officiel de souscription au produit BBVA Opti Strike Netflix/ASML. Contient les informations prcontractuelles obligatoires, le montant minimum de souscription, les modalites de reglement (virement, prelevement), les frais d'entree et de gestion, les coordonnees du depositaire, et les clauses de revocation. A signer par le client et le conseiller.",
  "Bulletin Souscription \u2014 Daily D\u00e9gressif (F\u00e9v 2026) \u2014 FR1459ABA565": "Bulletin de souscription du Daily Degressif avec ISIN FR1459ABA565. Formulaire detaillant le montant investi, le cadre fiscal (assurance-vie, compte-titres, PEA le cas echeant), les frais appliques, la declaration d'adequation (profil de risque de l'investisseur), et les signatures requises.",
  "Bulletin Souscription \u2014 HIS CMS Phoenix Trimestriel \u2014 FRSG00016RC6": "Formulaire de souscription pour le HIS CMS Phoenix Trimestriel emis par SG (ISIN FRSG00016RC6). Inclut la section de verification d'adequation MiFID II, les informations sur les couts et frais conformes au reglement PRIIPs, et l'attestation de remise du KID.",
  "Bulletin Souscription \u2014 Horizon Taux (Mars 2026) \u2014 FRSG000170R2": "Bulletin de souscription du produit Horizon Taux emis par SG (mars 2026). Formulaire avec les conditions specifiques aux produits de taux : pas de risque action mais sensibilite aux mouvements de la courbe des taux. Montant minimum, frais, et cadre fiscal detailles.",
  "Bulletin Souscription \u2014 K Taux Euribor \u2014 FR5CIBFS0455": "Formulaire de souscription du K Taux Euribor (ISIN FR5CIBFS0455). Document prcontractuel incluant la description synthetique du produit, les risques specifiques lies aux produits de taux courts (Euribor), et les modalites de sortie anticipee sur le marche secondaire.",
  "Bulletin Souscription \u2014 Monthly Step Transat \u2014 DE000UJ56SD2": "Bulletin de souscription du Monthly Step Transat (emetteur allemand, ISIN DE000UJ56SD2). Specificites liees a l'emission etrangere : fiscalite des coupons, regime de retenue a la source, et conditions de liquidite sur le marche secondaire allemand.",
  "Bulletin Souscription \u2014 Objectif Distribution Trimestrielle \u2014 FRSG000178R5": "Formulaire de souscription de l'Objectif Distribution Trimestrielle (SG, ISIN FRSG000178R5). Met en avant le calendrier previsionnel des distributions trimestrielles et les conditions de versement des coupons.",
  "Bulletin Souscription \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks \u2014 XS3170663259": "Bulletin de souscription de l'Opportunite Autocall Euro Stoxx Banks (ISIN XS3170663259). Formulaire standard avec focus sur l'exposition sectorielle bancaire europeenne et les risques specifiques lies a la concentration sur un seul secteur.",
  "Bulletin Souscription \u2014 Phoenix Autocall Fl\u00e8che \u2014 FR1459ABA714": "Formulaire de souscription du Phoenix Autocall Fleche (ISIN FR1459ABA714). Document incluant les scenarios de remboursement anticipe, le mecanisme de coupon fleche, et la comparaison avec un placement sans risque.",
  "Bulletin Souscription \u2014 Produit XS2814261926": "Bulletin de souscription pour le produit identifie par ISIN XS2814261926. Formulaire standard contenant les informations precontractuelles, les conditions de souscription, et les declarations reglementaires.",
  "Bulletin Souscription \u2014 Produit XS3125093420": "Formulaire de souscription du produit XS3125093420. Inclut les details de l'emission, les frais, les modalites de reglement et la documentation reglementaire requise.",
  "Bulletin Souscription \u2014 Produit XS3126594509": "Bulletin de souscription pour le produit ISIN XS3126594509. Formulaire officiel avec toutes les mentions legales, les conditions de souscription et de rachat, et les informations sur le risque de credit de l'emetteur.",
  "Bulletin Souscription \u2014 Rendement M\u00e9moire D\u00e9gressif BNP \u2014 XS3170753597": "Formulaire de souscription du Rendement Memoire Degressif BNP (ISIN XS3170753597). Inclut une section pedagogique expliquant le mecanisme de memoire et de degressivite du seuil d'autocall pour faciliter la comprehension du client.",
  "Bulletin Souscription \u2014 Rendement Taux In Fine \u2014 FRSG000179L6": "Bulletin de souscription du Rendement Taux In Fine (SG, ISIN FRSG000179L6). Formulaire specifique aux produits de taux sans autocall, mettant en avant la garantie du capital et le mecanisme de coupon fixe ou indexe.",
  "Bulletin Souscription \u2014 Tempo Taux Italie 10 Ans \u2014 FR0014014QI4": "Formulaire de souscription du Tempo Taux Italie 10 Ans (BNP, ISIN FR0014014QI4). Document incluant les risques specifiques lies a l'exposition au risque souverain italien, le mecanisme de coupon conditionnel et les conditions de garantie du capital par BNP Paribas.",

  // 05_Produits_Cardif - Conditions
  "Conditions \u2014 Ath\u00e9na Escalier Cr\u00e9dit Agricole & Engie (Jan 2026)": "Conditions definitives du produit Athena Escalier sur un panier worst-of Credit Agricole / Engie. Detaille le mecanisme en escalier : le coupon augmente a chaque date d'observation non rappelee (ex: 5% an 1, 10% an 2, 15% an 3...). Inclut les niveaux exacts de strike, barrieres, dates d'observation, et le calendrier complet de remboursement anticipe.",
  "Conditions \u2014 Ath\u00e9na Escalier Cr\u00e9dit Agricole & Engie (Jan 2026) v2": "Version revisee des conditions de l'Athena Escalier Credit Agricole & Engie avec ajustements des parametres suite a l'evolution des conditions de marche : modification potentielle des niveaux de barriere, des coupons ou des dates d'observation par rapport a la v1.",
  "Conditions \u2014 Ath\u00e9na Escalier Engie D\u00e9cr\u00e9ment 1.20 (Jan 2026)": "Conditions du produit Athena Escalier sur Engie avec decrementation synthetique de 1.20 EUR (le dividende est reinvesti dans le produit via un ajustement du niveau de reference, reduisant l'impact de la politique de dividende sur la performance du produit). Structure escalier avec coupon croissant et autocall periodique.",
  "Conditions \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks \u2014 XS3170663259": "Conditions contractuelles completes de l'Opportunite Autocall Euro Stoxx Banks. Document juridique detaillant les definitions (jour ouvre, agent de calcul, evenement de marche perturbateur), les modalites de calcul du remboursement, les clauses de substitution de l'indice, et les conditions de defaut de l'emetteur.",

  // 05_Produits_Cardif - Fiches Rapides
  "Fiche Rapide \u2014 Ath\u00e9na Escalier Engie D\u00e9cr\u00e9ment 1.20 (Jan 2026)": "Synthese d'une page du produit Athena Escalier Engie Decrement 1.20. Resume les caracteristiques essentielles : sous-jacent (Engie decrement 1.20 EUR), mecanisme (escalier avec coupons croissants), autocall annuel, barriere de protection a 50% du strike, duree maximale 10 ans, et indicateur de risque SRI.",
  "Fiche Rapide \u2014 HIS CMS Phoenix Trimestriel In Fine (F\u00e9v 2026)": "Fiche d'une page du HIS CMS Phoenix In Fine. Presente en un coup d'oeil : coupon trimestriel conditionnel avec memoire, pas d'autocall (remboursement a maturite uniquement), barriere de protection, scenarios simplifie (cas favorable, median, defavorable), et frais.",
  "Fiche Rapide \u2014 Horizon Taux (Mars 2026)": "Resume rapide du produit Horizon Taux : coupon fixe garanti + coupon variable sur ecart de taux, capital garanti a maturite, duree 5-8 ans, profil de risque faible (SRI 1-2), adapte aux investisseurs prudents cherchant un rendement superieur au fonds euros.",
  "Fiche Rapide \u2014 K Taux Euribor (F\u00e9v 2026)": "Synthese du K Taux Euribor : coupon indexe sur l'Euribor 3M dans un corridor, capital garanti, duree 5-7 ans, risque principal lie a un maintien prolonge de l'Euribor en dehors du corridor (coupon nul mais capital preserve).",
  "Fiche Rapide \u2014 Monthly Step Transat (F\u00e9v 2026)": "Fiche rapide du Monthly Step Transat : autocall mensuel, coupon step-up progressif, sous-jacent transatlantique, barriere de protection a 60-65%, duree max 5-8 ans. Points cles : observation mensuelle (opportunites de sortie frequentes) et coupon croissant.",
  "Fiche Rapide \u2014 Objectif Distribution Trimestrielle (F\u00e9v 2026)": "Synthese d'une page de l'Objectif Distribution Trimestrielle : distribution reguliere chaque trimestre, sous-jacent indice large, protection conditionnelle du capital, profil de rendement stable et previsible pour les investisseurs en quete de revenus.",
  "Fiche Rapide \u2014 Odyss\u00e9e Tempo D\u00e9gressif TotalEnergies (Jan 2026)": "Fiche rapide de l'Odyssee Tempo Degressif TotalEnergies : autocall degressif sur action TotalEnergies, coupon conditionnel avec memoire, barriere de protection a 50% du strike, mecanisme tempo adaptant la frequence d'observation. Points cles : exposition mono-action (risque plus concentre mais coupon plus eleve).",
  "Fiche Rapide \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks": "Synthese d'une page de l'Opportunite Autocall Euro Stoxx Banks : autocall sur indice sectoriel bancaire europeen, coupon de 6-8% p.a., observation annuelle ou trimestrielle, barriere a 60% du strike. Point d'attention : concentration sectorielle sur les bancaires europeennes.",
  "Fiche Rapide \u2014 Opti Strike Netflix ASML (F\u00e9v 2026)": "Fiche rapide de l'Opti Strike Netflix/ASML : worst-of sur deux actions tech/semi-conducteurs, mecanisme de strike optimise (fixation retardee), coupon trimestriel conditionnel de 10% p.a., barriere a 50% du strike. Risque principal : correlation entre Netflix et ASML.",
  "Fiche Rapide \u2014 Phoenix Autocall Fl\u00e8che (Mars 2026)": "Synthese du Phoenix Autocall Fleche : coupon periodique avec effet fleche (bonus si le sous-jacent depasse un seuil eleve), autocall avec observation trimestrielle, memoire de coupon, barriere de protection a 50-60%. Produit offrant un potentiel de rendement amplifie en cas de hausse forte du sous-jacent.",
  "Fiche Rapide \u2014 Rendement M\u00e9moire D\u00e9gressif BNP (F\u00e9v 2026)": "Fiche d'une page du Rendement Memoire Degressif BNP : triple mecanisme (memoire + degressif + autocall), coupon de 7-9% p.a., barriere a 50% du strike. Points cles : la memoire cumule les coupons non verses, la degressivite facilite le remboursement anticipe au fil du temps.",
  "Fiche Rapide \u2014 Rendement Taux In Fine (Mars 2026)": "Synthese du Rendement Taux In Fine : produit sur taux sans autocall, coupon fixe ou indexe, capital garanti a maturite. Profil tres defensif adapte aux investisseurs prudents. Rendement attendu superieur de 50-100 bps au fonds euros de reference.",
  "Fiche Rapide \u2014 Tempo Taux Italie 10 Ans (Mars 2026)": "Fiche rapide du Tempo Taux Italie 10 Ans : coupon conditionnel lie au taux souverain italien a 10 ans, capital garanti par BNP Paribas, mecanisme tempo. Point cle : pari sur le maintien des taux italiens dans un corridor raisonnable.",
  "Fiche Rapide Cardif \u2014 Daily D\u00e9gressif (F\u00e9v 2026)": "Fiche rapide Cardif du Daily Degressif : observation quotidienne (vs trimestrielle pour la plupart des autocalls), seuil d'autocall degressif, coupon memoire de 8% p.a. Le format quotidien multiplie les chances de remboursement anticipe, rendant le produit statistiquement plus favorable pour l'investisseur.",

  // 05_Produits_Cardif - KIDs
  "KID \u2014 BBVA Opti Strike Netflix ASML (F\u00e9v 2026) \u2014 XS3184672429": "Document d'informations cles (KID) reglementaire PRIIPs pour l'Opti Strike BBVA Netflix/ASML. Contient l'indicateur de risque SRI (probablement 5-6/7), les 4 scenarios de performance (stress, defavorable, intermediaire, favorable) a 1 an et a maturite, le detail des couts (entree 0-2%, sortie 0%, recurrents), et la duree de detention recommandee. Avertissement sur le risque de perte en capital.",
  "KID \u2014 Daily D\u00e9gressif (F\u00e9v 2026)": "KID du Daily Degressif conforme PRIIPs. Indicateur de risque, scenarios de performance base sur des simulations historiques du sous-jacent, decomposition des couts sur la duree de detention recommandee, et description du mecanisme de remboursement quotidien degressif en termes accessibles pour l'investisseur non professionnel.",
  "KID \u2014 HIS CMS Phoenix Trimestriel (F\u00e9v 2026) \u2014 FR0014013OB6": "Document d'informations cles du HIS CMS Phoenix Trimestriel (ISIN FR0014013OB6). Scenarios de performance specifiques au mecanisme Phoenix (coupon conditionnel + memoire), indicateur SRI, couts detailles, et avertissement sur l'absence d'autocall (remboursement in fine uniquement).",
  "KID \u2014 HIS CMS Phoenix Trimestriel In Fine (F\u00e9v 2026)": "KID du HIS CMS Phoenix In Fine avec scenarios de performance adaptes au remboursement in fine : pas de scenario d'autocall a simuler, focus sur la performance a maturite et les coupons cumules verses. Indicateur SRI potentiellement different du Phoenix classique autocallable.",
  "KID \u2014 Horizon Taux (Mars 2026)": "KID du produit Horizon Taux. Scenarios de performance bases sur des simulations de courbe de taux (et non d'indices actions). Indicateur SRI faible (1-3/7) refletant la garantie du capital. Couts reduits par rapport aux produits actions. Duree recommandee correspondant a la maturite du produit.",
  "KID \u2014 K Taux Euribor (F\u00e9v 2026)": "Document d'informations cles du K Taux Euribor. Scenarios de performance simules sur differentes trajectoires de l'Euribor 3M. Le scenario 'stress' correspond a un Euribor durablement hors du corridor (coupon nul mais capital rembourse). Indicateur SRI faible grace a la garantie du capital.",
  "KID \u2014 Monthly Step Transat (F\u00e9v 2026)": "KID du Monthly Step Transat avec scenarios integrant la probabilite d'autocall mensuel et le step-up du coupon. Les scenarios intermediaire et favorable montrent un remboursement anticipe avec coupon cumule ; le scenario defavorable montre une perte en capital a maturite.",
  "KID \u2014 Objectif Distribution Trimestrielle (F\u00e9v 2026)": "KID de l'Objectif Distribution Trimestrielle. Focus sur le rendement attendu des distributions trimestrielles dans chaque scenario. Couts transparents incluant les frais de distribution Cardif. Indicateur SRI modere.",
  "KID \u2014 Odyss\u00e9e Tempo D\u00e9gressif (Jan 2026)": "Document d'informations cles de l'Odyssee Tempo Degressif TotalEnergies. Scenarios de performance bases sur les simulations historiques de l'action TotalEnergies. Avertissement specifique sur le risque de concentration mono-action. Indicateur SRI probablement 5-6/7.",
  "KID \u2014 Opportunit\u00e9 Autocall Euro Stoxx Banks (F\u00e9v 2026)": "KID de l'Opportunite Autocall Euro Stoxx Banks. Scenarios bases sur l'historique de l'indice Euro Stoxx Banks (plus volatil que l'Euro Stoxx 50). Indicateur SRI eleve (5-6/7) refletant la volatilite du secteur bancaire europeen. Duree recommandee correspondant a la maturite maximale.",
  "KID \u2014 Phoenix Autocall Fl\u00e8che (Mars 2026)": "KID du Phoenix Autocall Fleche avec scenarios integrant l'effet fleche (bonus de coupon). Le scenario favorable montre le potentiel amplifie ; le scenario defavorable illustre la perte en capital si le sous-jacent chute sous la barriere a maturite.",
  "KID \u2014 Rendement M\u00e9moire D\u00e9gressif BNP (F\u00e9v 2026)": "Document d'informations cles du Rendement Memoire Degressif BNP. Scenarios de performance detaillant l'impact de la memoire de coupon et de la degressivite du seuil d'autocall. Le scenario intermediaire montre typiquement un autocall en annee 3-5 avec cumul de coupons.",
  "KID \u2014 Rendement Taux In Fine (Mars 2026)": "KID du Rendement Taux In Fine. Scenarios simplifies pour un produit a capital garanti : le rendement varie selon l'evolution des taux mais le capital est toujours rembourse a 100%. Indicateur SRI tres faible (1-2/7). Couts faibles.",
  "KID \u2014 Tempo Taux Italie 10 Ans (Mars 2026)": "KID du Tempo Taux Italie 10 Ans (BNP). Scenarios bases sur des simulations du taux souverain italien. Indicateur SRI faible grace a la garantie du capital. Avertissement sur le risque de credit de l'emetteur (BNP Paribas) et le risque de taux.",

  // 05_Produits_Cardif - Mode operatoire
  "Mode Op\u00e9ratoire \u2014 Commissions Assurance Cardif": "Guide operationnel detaillant le processus de commissionnement pour les produits distribues via Cardif : calcul des commissions (upfront + trailer), calendrier de versement, conditions de retrocession, rapprochement comptable, et procedures de regularisation. Document interne a usage des equipes commerciales et back-office.",

  // 06_Produits_MeilleurTaux
  "KID MeilleurTaux \u2014 Produit MT3 (FR0014013A96)": "Document d'informations cles du produit MeilleurTaux MT3 (ISIN FR0014013A96). Produit structure distribue via la plateforme MeilleurTaux Placement. Contient les objectifs d'investissement, le profil de risque (indicateur SRI), les 4 scenarios de performance reglementes, la decomposition des couts sur la duree de detention recommandee, et les informations pratiques (depositaire, valorisation, reclamations).",
  "KID MeilleurTaux \u2014 Produit MT4": "KID du produit MT4 de la gamme MeilleurTaux. Document reglementaire PRIIPs presentant les caracteristiques specifiques de ce produit : structure de rendement, sous-jacent de reference, barriere de protection, scenarios de performance, et profil de risque adapte a la clientele MeilleurTaux (investisseurs particuliers via courtage en ligne).",
  "KID MeilleurTaux \u2014 Produit MT5 (FR0014013AB5)": "Document d'informations cles du MT5 (ISIN FR0014013AB5). KID conforme PRIIPs avec scenarios de performance calibres sur le sous-jacent du produit. Information sur la liquidite (marche secondaire), les couts, et la duree de detention recommandee.",
  "KID MeilleurTaux \u2014 Produit MT6": "KID du produit MT6 MeilleurTaux. Informations cles reglementaires incluant l'objectif du produit, le mecanisme de remuneration, les risques (marche, credit emetteur, liquidite), et les frais totaux sur la duree de detention.",
  "KID MeilleurTaux \u2014 Produit MT7": "Document d'informations cles du MT7. Presentation des scenarios de performance (stress, defavorable, intermediaire, favorable) avec montants en euros pour un investissement de 10 000 EUR. Indicateur de risque et duree recommandee.",
  "KID MeilleurTaux \u2014 Produit MT8": "KID du MT8 conforme a la reglementation PRIIPs. Detail du mecanisme de rendement specifique a ce produit, des conditions de remboursement anticipe eventuel, et des couts cumules sur 1 an et a la duree recommandee.",
  "KID MeilleurTaux \u2014 Produit MT9": "Document d'informations cles du MT9. Scenarios de performance et decomposition des couts. Information sur les procedures de reclamation et de mediation en cas de litige.",
  "KID MeilleurTaux \u2014 S\u00e9lection Souverainet\u00e9 Europe (MT10)": "KID du produit MT10 'Selection Souverainete Europe'. Produit structure indexe sur un panier de taux souverains europeens ou sur un indicateur de spreads de credit souverains. Offre une exposition au risque souverain diversifie (France, Italie, Espagne). Scenarios de performance specifiques aux produits de taux souverains.",
  "KID MeilleurTaux \u2014 Produit MT11": "KID du MT11, produit de la gamme MeilleurTaux Placement. Scenarios de performance, indicateur SRI, couts et duree recommandee conformes PRIIPs.",
  "KID MeilleurTaux \u2014 Produit MT12": "Document d'informations cles du MT12. Detail du mecanisme de rendement, profil de risque, et information precontractuelle complete pour les investisseurs particuliers.",
  "KID MeilleurTaux \u2014 Produit MT13": "KID du produit MT13 MeilleurTaux. Information reglementaire PRIIPs avec focus sur les specificites de ce produit dans la gamme.",
  "KID MeilleurTaux \u2014 Produit MT14": "Document d'informations cles du MT14. Scenarios de performance, risques identifies, couts totaux et duree de detention recommandee.",
  "KID MeilleurTaux \u2014 Produit MT15": "KID du MT15 conforme PRIIPs. Presentation standardisee des objectifs, risques, scenarios de performance et couts pour permettre la comparaison entre produits.",
  "KID MeilleurTaux \u2014 Produit MT17": "Document d'informations cles du MT17. Note : les numeros MT16 n'apparaissent pas dans la base, suggerant un produit abandonne ou renomme. Le MT17 presente ses propres specificites de structure et de rendement.",
  "KID MeilleurTaux \u2014 Produit MT18": "KID du MT18. Information reglementaire complete pour les souscripteurs via la plateforme MeilleurTaux Placement.",
  "KID MeilleurTaux \u2014 Produit MT19": "Document d'informations cles du MT19 avec scenarios de performance actualises et detail des couts.",
  "KID MeilleurTaux \u2014 Produit MT20": "KID du MT20, l'un des produits les plus recents de la gamme MeilleurTaux. Scenarios de performance calibres sur les conditions de marche les plus recentes.",
  "KID MeilleurTaux \u2014 Produit MT21": "Document d'informations cles du MT21, derniere emission en date de la gamme MeilleurTaux Placement. Integre les dernieres evolutions reglementaires PRIIPs.",

  // 07_Marex
  "HSBC \u2014 Final Terms Recovery Coupon Autocall (Jan 2036) \u2014 FR0014013546": "Conditions definitives (Final Terms) emises par HSBC pour un produit Recovery Coupon Autocall a maturite janvier 2036 (ISIN FR0014013546). Document juridique officiel depose aupres du regulateur, detaillant tous les parametres contractuels : sous-jacent, dates d'observation (10 ans de dates autocall), niveaux de barriere, coupon de 'recovery' (verse si le sous-jacent remonte au-dessus d'un seuil apres une chute), et conditions de remboursement a maturite.",
  "Marex \u2014 Autocallable & BRC (Produit MD, 12 mois, USD)": "Term sheet Marex Solutions pour un produit combinant une structure Autocallable et un Barrier Reverse Convertible (BRC) en USD sur 12 mois. Produit denomme 'MD' en phase de test. Le BRC offre un coupon garanti mais expose l'investisseur a une livraison du sous-jacent si la barriere est franchie. Structure en dollars americains pour une clientele internationale.",
  "Marex \u2014 Autocallable & BRC (Produit Toxic, 12 mois, USD)": "Test de structuration Marex pour un produit pousse aux limites ('Toxic') : parametres extremes avec barrieres basses, coupons eleves, et sous-jacents tres volatils. Document de travail interne utilise pour tester les bornes du moteur de pricing Marex et evaluer les limites de risque acceptables. Non destine a la commercialisation.",
  "Marex \u2014 Autocallable & BRC Bitcoin (12 mois, EUR) v2": "Deuxieme version de la term sheet pour un Autocallable/BRC sur Bitcoin en EUR sur 12 mois. Structure crypto innovante avec les specificites du Bitcoin comme sous-jacent : volatilite implicite tres elevee (80-120%), trading 24/7 (impact sur les dates d'observation), et risques specifiques (fork, regulation). Coupon potentiel tres eleve en contrepartie d'un risque de perte significatif.",
  "Marex \u2014 Autocallable & BRC DAX (17 mois, EUR) \u2014 Test 4": "Quatrieme iteration de test pour un Autocallable/BRC sur le DAX en EUR sur 17 mois. La duree de 17 mois est atypique, suggerant un ajustement pour optimiser le pricing en fonction de la structure de volatilite du DAX. Barriere autocall et barriere knock-in ajustees par rapport aux tests precedents.",
  "Marex \u2014 Autocallable & BRC Euro Stoxx 50 (12 mois, EUR) \u2014 Test 5": "Cinquieme test de structuration sur Euro Stoxx 50 (12 mois, EUR). Benchmark classique pour valider le pricing Marex vs concurrence (BNP, SG, HSBC). L'Euro Stoxx 50 etant l'indice de reference en Europe pour les produits structures, ce test permet de comparer les conditions obtenues avec les standards du marche.",
  "Marex \u2014 Autocallable & BRC Euro Stoxx 50 (18 mois, EUR) \u2014 Test 6": "Sixieme test avec maturite allongee a 18 mois sur Euro Stoxx 50. La maturite plus longue permet d'obtenir un coupon plus eleve ou une barriere plus protectrice. Comparaison du rapport rendement/risque entre les durees 12 et 18 mois pour calibrer l'offre commerciale.",
  "Marex \u2014 Autocallable & BRC MSFT (12 mois, EUR) \u2014 Test 8": "Test de structuration sur l'action Microsoft (MSFT) en EUR sur 12 mois. Structure mono-action offrant un coupon plus eleve que sur indice (prime de risque de concentration). Test des parametres optimaux pour un sous-jacent tech a forte capitalisation avec volatilite moderee.",
  "Marex \u2014 Autocallable Standard (12 mois, EUR) \u2014 Test 1": "Premier test de structuration Marex : Autocallable standard (sans composante BRC) sur 12 mois en EUR. Produit de reference pour valider le flux de travail entre Strick'in et Marex Solutions. Parametres conservateurs : sous-jacent indice, barriere autocall a 100%, barriere de protection a 60%, coupon de 6-8% p.a.",
  "Marex \u2014 BRC Bitcoin (12 mois, EUR) \u2014 Test 2": "Deuxieme test : Barrier Reverse Convertible pur sur Bitcoin (sans composante autocall). Structure offrant un coupon garanti eleve (15-25% p.a.) en contrepartie d'une exposition a la baisse du Bitcoin sous la barriere. Test de la capacite de Marex a pricer des sous-jacents crypto.",
  "Marex \u2014 BRC Bitcoin (12 mois, EUR) \u2014 Test 3": "Troisieme test : BRC Bitcoin avec parametres ajustes par rapport au Test 2. Modification potentielle de la barriere, du coupon ou de la devise de settlement. Comparaison des conditions pour affiner l'offre de produits crypto via Strick'in.",
  "Marex \u2014 NewCo Brief Business Plan Go/No Go": "Document strategique evaluant l'opportunite de creer une entite commune (NewCo) entre Strick'in et Marex Solutions. Analyse du business plan, de la structure juridique, des apports de chaque partie, du modele de gouvernance, et de la decision go/no go. Document confidentiel de niveau strategique.",
  "Marex \u2014 Term Sheet Autocall Worst-of (BNP, TotalEnergies) \u2014 Test 10": "Test de term sheet pour un Autocall worst-of sur BNP Paribas et TotalEnergies. Deux actions francaises de secteurs differents (finance et energie) offrant une decorrelation interessante. Le mecanisme worst-of augmente le coupon mais expose l'investisseur a la performance de l'action la plus faible.",
  "Marex \u2014 Term Sheet Autocall Worst-of (Cr\u00e9dit Agricole, Engie) \u2014 Test 11": "Test de term sheet Autocall worst-of sur Credit Agricole et Engie. Panier francais finance/utilities avec une decorrelation differente du test 10. Comparaison des conditions de pricing entre differents paniers worst-of pour determiner les combinaisons les plus attractives.",
  "Marex \u2014 Term Sheet Autocall Worst-of (DAX, Euro Stoxx 50, ASML) \u2014 Test 13": "Test de term sheet sur un panier worst-of a 3 sous-jacents : DAX (indice), Euro Stoxx 50 (indice) et ASML (action). Combinaison mixte indices/action offrant un coupon amplifie. Le worst-of a 3 sous-jacents augmente significativement le rendement mais aussi le risque de declenchement de la barriere.",
  "Marex \u2014 Term Sheet Autocall Worst-of (Netflix, DAX) \u2014 Test 12": "Test de structuration worst-of Netflix et DAX. Panier original combinant une action tech US et un indice europeen. Decorrelation elevee entre les deux sous-jacents (geographies et secteurs differents) permettant un coupon tres attractif. Test des limites de pricing inter-marches.",
  "Marex \u2014 Term Sheet Phoenix Autocall Worst-of (Engie, BNP) \u2014 Test 9": "Test de Phoenix Autocall worst-of Engie et BNP Paribas. Structure Phoenix (coupon conditionnel periodique avec memoire) combinee a un mecanisme autocall et worst-of. Coupon trimestriel de 2-3% (8-12% p.a.) conditionnel au maintien des deux actions au-dessus du seuil de coupon.",
  "Marex \u2014 Term Sheet Phoenix BRC 1Y EUR \u2014 Test 7": "Test de Phoenix BRC (Barrier Reverse Convertible avec coupons conditionnels Phoenix) sur 1 an en EUR. Combine le coupon garanti du BRC avec les coupons conditionnels du Phoenix. Structure hybride offrant un plancher de rendement (coupon BRC) et un potentiel supplementaire (coupon Phoenix).",
  "Marex \u2014 Term Sheet Phoenix Worst-of (BNP, TotalEnergies, ASML) \u2014 Test 14": "Test de Phoenix worst-of sur un panier de 3 actions : BNP Paribas, TotalEnergies et ASML. Le panier a 3 sous-jacents offre le rendement le plus eleve de la serie de tests Marex mais aussi le risque le plus important. Coupon conditionnel trimestriel avec memoire, autocall periodique.",
  "Marex \u2014 Term Sheet Phoenix Worst-of (DAX, Netflix, BNP, TotalEnergies) \u2014 Test 15": "Test le plus ambitieux de la serie : Phoenix worst-of a 4 sous-jacents (DAX, Netflix, BNP, TotalEnergies). Diversification maximale mais complexite elevee. Le coupon potentiel est tres eleve (15%+ p.a.) mais la probabilite de declenchement de la barriere augmente fortement avec 4 sous-jacents.",
  "Marex \u2014 Term Sheet Phoenix Worst-of (Netflix, BNP, TotalEnergies) \u2014 Test 16": "Seizieme et dernier test de la serie : Phoenix worst-of a 3 sous-jacents (Netflix, BNP, TotalEnergies). Variante du test 14 remplacant ASML par Netflix. Comparaison de l'impact sur le pricing d'un sous-jacent tech US vs semi-conducteur europeen dans un panier worst-of.",
  "Marex \u2014 Term Sheet Phoenix Worst-of (Netflix, ASML) \u2014 Test 17": "Term sheet Phoenix worst-of sur Netflix et ASML. Panier 100% tech/croissance offrant une exposition a deux leaders mondiaux de leurs secteurs respectifs. Volatilite elevee des deux sous-jacents generant un coupon attractif mais un risque de barriere important.",
};




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
                              <th className="text-left px-4 py-2 font-medium w-20">Type</th>
                              <th className="text-left px-3 py-2 font-medium" colSpan={2}>Document</th>
                              <th className="text-center px-2 py-2 font-medium w-16 no-print">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.docs.map((doc, idx) => (
                              <tr key={doc.id + "-main"} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                                <td className="px-4 pt-2.5 pb-0 align-top"><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">{getDocType(doc.name)}</span></td>
                                <td className="px-3 pt-2.5 pb-0" colSpan={2}>
                                  <p className="text-xs font-medium text-gray-800 leading-snug">{doc.name}</p>
                                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{(FILE_SUMMARIES[doc.name] || "Document de la base Strick\'in.")}</p>
                                  <div className="flex items-center gap-3 text-xs text-gray-300 mt-1 pb-2">
                                    <span>{formatDate(doc.created_at)}</span>
                                    {doc.name.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/) && <span className="font-mono text-emerald-400">{doc.name.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/)?.[0]}</span>}
                                  </div>
                                </td>
                                <td className="px-2 pt-2.5 pb-0 text-center align-top no-print">
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
