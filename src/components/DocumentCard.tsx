"use client";

import { type Document, CATEGORIES, getPublicUrl, isProtectedDoc } from "@/lib/supabase";

interface DocumentCardProps {
  document: Document;
  mode: "grid" | "list";
  isUnlocked: boolean;
  onLockClick: () => void;
}

const FILE_ICONS: Record<string, string> = {
  pdf: "📄",
  pptx: "📊",
  docx: "📝",
  xlsx: "📈",
  html: "🌐",
  png: "🖼️",
  jpg: "🖼️",
  svg: "🎨",
  json: "📋",
  ts: "💻",
  default: "📁",
};

function getFileIcon(type: string): string {
  return FILE_ICONS[type.toLowerCase()] || FILE_ICONS.default;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryColor(categoryId: string): string {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat?.color || "#3B28CC";
}

function getCategoryLabel(categoryId: string): string {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat?.label || categoryId;
}

function handleDownload(doc: Document) {
  const url = getPublicUrl(doc.storage_path);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = doc.name + "." + doc.file_type;
  a.target = "_blank";
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
}

function handlePreview(doc: Document) {
  const url = getPublicUrl(doc.storage_path);
  window.open(url, "_blank");
}
export function DocumentCard({ document: doc, mode, isUnlocked, onLockClick }: DocumentCardProps) {
  const color = getCategoryColor(doc.category);
  const locked = isProtectedDoc(doc.category) && !isUnlocked;

  if (mode === "list") {
    return (
      <div
        className={`card p-4 flex items-center gap-4 cursor-pointer hover:border-violet/30 ${locked ? "opacity-70" : ""}`}
        onClick={() => locked ? onLockClick() : handlePreview(doc)}
      >
        <span className="text-2xl relative">
          {getFileIcon(doc.file_type)}
          {locked && <span className="absolute -bottom-1 -right-1 text-sm">🔒</span>}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm truncate ${locked ? "text-gray-400" : "text-gray-900"}`}>
            {locked ? doc.name.substring(0, 20) + "•••" : doc.name}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span
              className="badge text-xs"
              style={{ backgroundColor: color + "15", color }}
            >
              {getCategoryLabel(doc.category)}
            </span>
            <span className="text-xs text-gray-400">{doc.file_type.toUpperCase()}</span>
            <span className="text-xs text-gray-400">{formatSize(doc.file_size)}</span>
            {locked && (
              <span className="badge text-xs bg-red-50 text-red-600">Protégé</span>
            )}
          </div>
        </div>
        {locked ? (
          <button
            onClick={(e) => { e.stopPropagation(); onLockClick(); }}
            className="btn-secondary text-xs px-3 py-1.5 border-red-200 text-red-600 hover:bg-red-50"
          >
            🔒 Déverrouiller
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Télécharger
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`card cursor-pointer hover:border-violet/30 group relative ${locked ? "opacity-80" : ""}`}
      onClick={() => locked ? onLockClick() : handlePreview(doc)}
    >
      {locked && (
        <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-center">
            <span className="text-4xl">🔒</span>
            <p className="text-sm font-medium text-gray-700 mt-2">Accès admin requis</p>
          </div>
        </div>
      )}
      {locked && (
        <div className="absolute top-3 right-3 z-20">
          <span className="badge text-xs bg-red-50 text-red-600 border border-red-200">
            🔒 Protégé
          </span>
        </div>
      )}
      <div
        className={`h-24 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-105 ${locked ? "blur-[1px]" : ""}`}
        style={{ backgroundColor: color + "10" }}
      >
        <span className="text-4xl">{getFileIcon(doc.file_type)}</span>
      </div>
      <h3 className={`font-medium text-sm truncate mb-2 ${locked ? "text-gray-400" : "text-gray-900"}`} title={locked ? "Document protégé" : doc.name}>
        {locked ? doc.name.substring(0, 25) + "•••" : doc.name}
      </h3>
      <div className="flex items-center justify-between">
        <span
          className="badge text-xs"
          style={{ backgroundColor: color + "15", color }}
        >
          {getCategoryLabel(doc.category)}
        </span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{doc.file_type.toUpperCase()}</span>
          <span>{formatSize(doc.file_size)}</span>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        {locked ? (
          <button
            onClick={(e) => { e.stopPropagation(); onLockClick(); }}
            className="btn-primary text-xs flex-1 py-2 !bg-red-600 hover:!bg-red-700"
          >
            🔒 Déverrouiller
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePreview(doc); }}
              className="btn-primary text-xs flex-1 py-2"
            >
              Voir
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
              className="btn-secondary text-xs flex-1 py-2"
            >
              Télécharger
            </button>
          </>
        )}
      </div>
    </div>
  );
}
