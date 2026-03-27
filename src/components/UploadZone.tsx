"use client";

import { useState, useRef, useCallback } from "react";
import { supabase, CATEGORIES } from "@/lib/supabase";

interface UploadZoneProps {
  onUploadComplete: () => void;
}

const EXT_TO_CATEGORY: Record<string, string> = {
  pdf: "02_Documents",
  doc: "02_Documents",
  docx: "02_Documents",
  txt: "02_Documents",
  rtf: "02_Documents",
  xlsx: "03_Tableurs",
  xls: "03_Tableurs",
  csv: "03_Tableurs",
  pptx: "01_Presentations",
  ppt: "01_Presentations",
  png: "04_Branding_Strikin",
  jpg: "04_Branding_Strikin",
  jpeg: "04_Branding_Strikin",
  svg: "04_Branding_Strikin",
  gif: "04_Branding_Strikin",
  zip: "02_Documents",
};

function detectCategory(fileName: string): { id: string; label: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const catId = EXT_TO_CATEGORY[ext] || "02_Documents";
  const cat = CATEGORIES.find((c) => c.id === catId);
  return { id: catId, label: cat?.label || "Documents" };
}

function getFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    pdf: "PDF",
    doc: "Word",
    docx: "Word",
    xlsx: "Excel",
    xls: "Excel",
    csv: "CSV",
    pptx: "PowerPoint",
    ppt: "PowerPoint",
    png: "Image",
    jpg: "Image",
    jpeg: "Image",
    svg: "SVG",
    gif: "Image",
    txt: "Texte",
    zip: "Archive",
  };
  return types[ext] || ext.toUpperCase();
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileUpload {
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  category: { id: string; label: string };
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  async function uploadFile(fileUpload: FileUpload, index: number) {
    const { file } = fileUpload;
    const category = fileUpload.category;
    const storagePath = category.id + "/" + file.name;

    try {
      // Update status to uploading
      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, status: "uploading" as UploadStatus, progress: 30 } : u))
      );

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("strickin-docs")
        .upload(storagePath, file, { upsert: true });

      if (storageError) throw storageError;

      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, progress: 70 } : u))
      );

      // Insert into documents table
      const { error: dbError } = await supabase.from("documents").insert({
        name: file.name,
        category: category.id,
        category_label: category.label,
        file_type: getFileType(file.name),
        file_size: file.size,
        storage_path: storagePath,
      });

      if (dbError) throw dbError;

      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, status: "success" as UploadStatus, progress: 100 } : u))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setUploads((prev) =>
        prev.map((u, i) => (i === index ? { ...u, status: "error" as UploadStatus, error: message } : u))
      );
    }
  }

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const newUploads: FileUpload[] = fileArray.map((file) => ({
      file,
      status: "idle" as UploadStatus,
      progress: 0,
      category: detectCategory(file.name),
    }));

    setUploads(newUploads);
    setIsOpen(true);

    // Upload all files
    for (let i = 0; i < newUploads.length; i++) {
      await uploadFile(newUploads[i], i);
    }

    // Refresh document list after all uploads
    setTimeout(() => {
      onUploadComplete();
    }, 500);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const allDone = uploads.length > 0 && uploads.every((u) => u.status === "success" || u.status === "error");
  const successCount = uploads.filter((u) => u.status === "success").length;

  return (
    <>
      {/* Upload Button */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`card cursor-pointer transition-all duration-300 border-2 border-dashed ${
          isDragging
            ? "border-violet bg-violet/5 scale-[1.02]"
            : "border-gray-200 hover:border-violet/50 hover:bg-gray-50"
        } text-center py-8`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
            isDragging ? "bg-violet/10" : "bg-gray-100"
          }`}>
            {isDragging ? "\u{1F4E5}" : "\u{2795}"}
          </div>
          <div>
            <p className={`font-semibold ${isDragging ? "text-violet" : "text-gray-700"}`}>
              {isDragging ? "Relacher pour uploader" : "Glisser-deposer ou cliquer pour ajouter"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              PDF, Word, Excel, PowerPoint, Images...
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress Modal */}
      {isOpen && uploads.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">
                Upload {allDone ? "termine" : "en cours..."}
              </h2>
              {allDone && (
                <button
                  onClick={() => { setIsOpen(false); setUploads([]); }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  \u{2716}
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {uploads.map((u, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="text-xl">
                    {u.status === "success" ? "\u{2705}" : u.status === "error" ? "\u{274C}" : u.status === "uploading" ? "\u{23F3}" : "\u{1F4C4}"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{u.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                        {u.category.label}
                      </span>
                      {u.error && <span className="text-xs text-red-500">{u.error}</span>}
                    </div>
                    {u.status === "uploading" && (
                      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet rounded-full transition-all duration-500"
                          style={{ width: u.progress + "%" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allDone && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  {successCount}/{uploads.length} fichier(s) ajoute(s) avec succes
                </p>
                <button
                  onClick={() => { setIsOpen(false); setUploads([]); }}
                  className="mt-3 px-6 py-2.5 bg-violet text-white rounded-xl font-medium hover:bg-violet/90 transition-all"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
