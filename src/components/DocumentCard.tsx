"use client";

import { type Document, CATEGORIES, supabase } from "@/lib/supabase";

interface DocumentCardProps {
  document: Document;
  mode: "grid" | "list";
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

async function handleDownload(doc: Document) {
  const { data } = await supabase.storage
    .from("strickin-docs")
    .createSignedUrl(doc.storage_path, 3600);
  if (data?.signedUrl) {
    window.open(data.signedUrl, "_blank");
  }
}

async function handlePreview(doc: Document) {
  if (doc.file_type !== "pdf") {
    handleDownload(doc);
    return;
  }
  const { data } = await supabase.storage
    .from("strickin-docs")
    .createSignedUrl(doc.storage_path, 3600);
  if (data?.signedUrl) {
    window.open(data.signedUrl, "_blank");
  }
}

export function DocumentCard({ document: doc, mode }: DocumentCardProps) {
  const color = getCategoryColor(doc.category);

  if (mode === "list") {
    return (
      <div className="card p-4 flex items-center gap-4 cursor-pointer hover:border-violet/30" onClick={() => handlePreview(doc)}>
        <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{doc.name}</p>
          <div className="flex items-center gap-3 mt-1">
            <span
              className="badge text-xs"
              style={{ backgroundColor: color + "15", color }}
            >
              {getCategoryLabel(doc.category)}
            </span>
            <span className="text-xs text-gray-400">{doc.file_type.toUpperCase()}</span>
            <span className="text-xs text-gray-400">{formatSize(doc.file_size)}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Télécharger
        </button>
      </div>
    );
  }

  return (
    <div className="card cursor-pointer hover:border-violet/30 group" onClick={() => handlePreview(doc)}>
      {/* File icon header */}
      <div
        className="h-24 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-105"
        style={{ backgroundColor: color + "10" }}
      >
        <span className="text-4xl">{getFileIcon(doc.file_type)}</span>
      </div>
      {/* Title */}
      <h3 className="font-medium text-sm text-gray-900 truncate mb-2" title={doc.name}>
        {doc.name}
      </h3>
      {/* Meta */}
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
      {/* Actions */}
      <div className="flex gap-2 mt-4">
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
      </div>
    </div>
  );
}
