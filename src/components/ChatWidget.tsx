"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { verifyAdminPassword, supabase, CATEGORIES } from "@/lib/supabase";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface StorageFile {
  name: string;
  id: string;
  metadata: { size: number; mimetype: string };
  created_at: string;
}

function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-green-300 rounded-lg p-3 my-2 text-xs overflow-x-auto"><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 text-violet px-1.5 py-0.5 rounded text-xs">$1</code>');
  html = html.replace(/^### (.*$)/gm, '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.*$)/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>');
  html = html.replace(/^# (.*$)/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>');
  html = html.replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-sm">$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal text-sm">$2</li>');
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileEmoji(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "\u{1F4C4}", pptx: "\u{1F4CA}", docx: "\u{1F4DD}", xlsx: "\u{1F4C8}",
    html: "\u{1F310}", png: "\u{1F5BC}", jpg: "\u{1F5BC}", svg: "\u{1F3A8}",
    json: "\u{1F4CB}", ts: "\u{1F4BB}", js: "\u{1F4BB}", csv: "\u{1F4CA}",
  };
  return map[ext] || "\u{1F4C1}";
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  // Chat file attachment state
  const [attachedFiles, setAttachedFiles] = useState<{name: string; path: string; size: number}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // File management state
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && isAuthenticated && activeTab === "chat" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isAuthenticated, activeTab]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("strickin_admin");
      if (saved === "true") setIsAuthenticated(true);
    } catch {}
  }, []);

  // Load files when files tab is opened
  useEffect(() => {
    if (activeTab === "files" && isAuthenticated) {
      loadFiles();
    }
  }, [activeTab, isAuthenticated, selectedCategory]);

  async function loadFiles() {
    setFilesLoading(true);
    try {
      const folder = selectedCategory || "";
      const { data, error } = await supabase.storage
        .from("strickin-docs")
        .list(folder, { limit: 200, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      // Filter out .emptyFolderPlaceholder and folders
      const fileList = (data || []).filter(
        (f) => f.name !== ".emptyFolderPlaceholder" && f.id
      );
      setFiles(fileList as StorageFile[]);
    } catch (err) {
      console.error("Error loading files:", err);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploadingFile(true);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const folder = selectedCategory || "uploads";
        const path = `${folder}/${file.name}`;

        const { error } = await supabase.storage
          .from("strickin-docs")
          .upload(path, file, { upsert: true });

        if (error) {
          console.error(`Upload error for ${file.name}:`, error);
          alert(`Erreur upload: ${file.name} — ${error.message}`);
        }
      }
      // Reload files
      await loadFiles();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileName: string) {
    const folder = selectedCategory || "";
    const path = folder ? `${folder}/${fileName}` : fileName;
    try {
      const { error } = await supabase.storage
        .from("strickin-docs")
        .remove([path]);
      if (error) throw error;

      // Also delete from documents table if exists
      await supabase.from("documents").delete().eq("storage_path", path);

      setDeleteConfirm(null);
      await loadFiles();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Erreur lors de la suppression");
    }
  }

  function handleDownload(fileName: string) {
    const folder = selectedCategory || "";
    const path = folder ? `${folder}/${fileName}` : fileName;
    const { data } = supabase.storage.from("strickin-docs").getPublicUrl(path);
    if (data?.publicUrl) {
      const a = document.createElement("a");
      a.href = data.publicUrl;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (verifyAdminPassword(password)) {
      setIsAuthenticated(true);
      setPasswordError(false);
      try { localStorage.setItem("strickin_admin", "true"); } catch {}
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Bonjour ! Je suis l'assistant IA de **Strick'in**. Je peux vous aider sur :\n\n- **Questions sur les produits structurés** (Autocall, Phoenix, KIDs, etc.)\n- **Génération de business plans** pour la distribution\n- **Gestion des fichiers** (lister, supprimer, organiser)\n- **Génération de documents** (demandez-moi de créer un fichier !)\n\nComment puis-je vous aider ?",
        timestamp: new Date(),
      }]);
    } else {
      setPasswordError(true);
      setPassword("");
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;
    if (isLoading) return;

    // Build message content with attached file info
    let fullContent = text;
    if (attachedFiles.length > 0) {
      const fileInfo = attachedFiles.map(f => `- ${f.name} (${formatSize(f.size)}) → uploads/${f.name}`).join("\n");
      fullContent = text
        ? `${text}\n\n📎 Fichiers joints :\n${fileInfo}`
        : `📎 Fichiers uploadés :\n${fileInfo}`;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: fullContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const apiMessages = [...messages.filter(m => m.id !== "welcome"), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          adminPassword: "strickin2026",
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);

      // If the assistant performed file operations, refresh files
      if (text.toLowerCase().match(/suppr|delete|déplace|move|ajout|upload|créer|générer|fichier/)) {
        if (activeTab === "files") loadFiles();
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Erreur : ${err instanceof Error ? err.message : "Impossible de contacter l'assistant."}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChatAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const folder = "uploads";
        const path = `${folder}/${file.name}`;

        const { error } = await supabase.storage
          .from("strickin-docs")
          .upload(path, file, { upsert: true });

        if (error) {
          console.error(`Upload error for ${file.name}:`, error);
          alert(`Erreur upload: ${file.name} — ${error.message}`);
        } else {
          setAttachedFiles(prev => [...prev, { name: file.name, path, size: file.size }]);
        }
      }
    } catch (err) {
      console.error("Chat attach error:", err);
    } finally {
      setIsUploading(false);
      if (chatFileRef.current) chatFileRef.current.value = "";
    }
  }

  function removeAttachment(name: string) {
    setAttachedFiles(prev => prev.filter(f => f.name !== name));
  }

  // Drag & drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i];
        const folder = "uploads";
        const path = `${folder}/${file.name}`;
        const { error } = await supabase.storage
          .from("strickin-docs")
          .upload(path, file, { upsert: true });
        if (error) {
          console.error(`Upload error for ${file.name}:`, error);
          alert(`Erreur upload: ${file.name} — ${error.message}`);
        } else {
          setAttachedFiles(prev => [...prev, { name: file.name, path, size: file.size }]);
        }
      }
    } catch (err) {
      console.error("Drop upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const filteredFiles = files.filter(f =>
    !fileSearch || f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  // Get categories that have content (use CATEGORIES from supabase lib)
  const categoryOptions = CATEGORIES.map(c => ({ id: c.id, label: c.label }));

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setShowPulse(false); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-violet text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center group"
        title="Assistant Strick'in"
      >
        {showPulse && !isOpen && (
          <span className="absolute inset-0 rounded-full bg-violet animate-ping opacity-30" />
        )}
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[650px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in">
          {/* Header */}
          <div className="bg-violet px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">Assistant Strick&apos;in</h3>
              <p className="text-white/70 text-xs">IA &middot; Produits structurés</p>
            </div>
            {isAuthenticated && messages.length > 1 && activeTab === "chat" && (
              <button
                onClick={() => setMessages([messages[0]])}
                className="text-white/60 hover:text-white transition-colors"
                title="Nouvelle conversation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            /* Auth form */
            <div className="flex-1 flex items-center justify-center p-6">
              <form onSubmit={handleAuth} className="w-full space-y-4">
                <div className="text-center mb-4">
                  <div className="w-14 h-14 bg-violet/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">{"\u{1F510}"}</span>
                  </div>
                  <h3 className="font-bold text-gray-800">Accès administrateur</h3>
                  <p className="text-xs text-gray-500 mt-1">Entrez le mot de passe pour accéder à l&apos;assistant IA</p>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError(false); }}
                  placeholder="Mot de passe admin"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${
                    passwordError
                      ? "border-red-400 bg-red-50"
                      : "border-gray-200 focus:border-violet focus:ring-2 focus:ring-violet/20"
                  }`}
                  autoFocus
                />
                {passwordError && <p className="text-red-500 text-xs">Mot de passe incorrect</p>}
                <button
                  type="submit"
                  disabled={!password}
                  className="w-full py-3 rounded-xl bg-violet text-white text-sm font-medium hover:bg-violet/90 disabled:opacity-40 transition-all"
                >
                  Déverrouiller
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex border-b border-gray-100 shrink-0">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "chat"
                      ? "text-violet border-b-2 border-violet bg-violet/5"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                  Chat IA
                </button>
                <button
                  onClick={() => setActiveTab("files")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "files"
                      ? "text-violet border-b-2 border-violet bg-violet/5"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  Fichiers
                </button>
              </div>

              {activeTab === "chat" ? (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-violet text-white rounded-br-md"
                            : "bg-gray-50 text-gray-800 rounded-bl-md border border-gray-100"
                        }`}>
                          {msg.role === "assistant" ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex gap-1.5">
                            <span className="w-2 h-2 bg-violet/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-violet/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-violet/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div
                    className={`shrink-0 border-t border-gray-100 px-4 py-3 bg-white relative transition-colors ${isDragging ? "bg-violet/5 border-violet" : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {/* Drag overlay */}
                    {isDragging && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-violet/10 border-2 border-dashed border-violet rounded-xl pointer-events-none">
                        <div className="flex flex-col items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                          <span className="text-xs font-medium text-violet">Déposez vos fichiers ici</span>
                        </div>
                      </div>
                    )}
                    {/* Attached files preview */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachedFiles.map(f => (
                          <div key={f.name} className="flex items-center gap-1.5 bg-violet/10 text-violet rounded-lg px-2.5 py-1.5 text-xs">
                            <span>{getFileEmoji(f.name)}</span>
                            <span className="max-w-[120px] truncate">{f.name}</span>
                            <button onClick={() => removeAttachment(f.name)} className="hover:text-red-500 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chat input area */}
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => chatFileRef.current?.click()}
                        disabled={isUploading}
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet hover:bg-violet/10 transition-all"
                        title="Joindre un fichier"
                      >
                        {isUploading ? (
                          <span className="w-4 h-4 border-2 border-violet border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        )}
                      </button>
                      <input ref={chatFileRef} type="file" multiple className="hidden" onChange={handleChatAttach} />
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Posez votre question..."
                        rows={1}
                        className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20 transition-all max-h-24"
                      />
                      <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                        className="shrink-0 w-8 h-8 rounded-lg bg-violet text-white flex items-center justify-center hover:bg-violet/90 disabled:opacity-30 transition-all"
                        title="Envoyer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Category select and search */}
                  <div className="px-4 py-3 border-b border-gray-100 space-y-2 shrink-0">
                    <select
                      value={selectedCategory}
                      onChange={e => { setSelectedCategory(e.target.value); setFileSearch(""); }}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20 transition-all"
                    >
                      <option value="">Racine (tous les dossiers)</option>
                      {categoryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <input
                        type="text"
                        value={fileSearch}
                        onChange={e => setFileSearch(e.target.value)}
                        placeholder="Rechercher un fichier..."
                        className="w-full text-xs px-3 py-2 pl-8 rounded-lg border border-gray-200 outline-none focus:border-violet"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 py-2 flex gap-2 shrink-0">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet text-white text-xs font-medium hover:bg-violet/90 disabled:opacity-50 transition-all"
                    >
                      {uploadingFile ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      )}
                      {uploadingFile ? "Upload..." : "Uploader"}
                    </button>
                    <button
                      onClick={loadFiles}
                      disabled={filesLoading}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all"
                      title="Rafraîchir"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={filesLoading ? "animate-spin" : ""}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                    accept=".pdf,.pptx,.docx,.xlsx,.csv,.html,.json,.ts,.js,.png,.jpg,.svg,.txt"
                  />

                  {/* File list */}
                  <div className="flex-1 overflow-y-auto px-4 pb-3">
                    {filesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-violet border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : filteredFiles.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-400 text-sm">{selectedCategory ? "Aucun fichier dans ce dossier" : "Sélectionnez un dossier"}</p>
                        <p className="text-gray-300 text-xs mt-1">Utilisez le menu ci-dessus pour naviguer</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {filteredFiles.map(file => (
                          <div
                            key={file.id || file.name}
                            className="group flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
                          >
                            {/* File emoji */}
                            <span className="text-base shrink-0">{getFileEmoji(file.name)}</span>

                            {/* File info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {formatSize(file.metadata?.size || 0)} • {new Date(file.created_at).toLocaleDateString()}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {/* Download */}
                              <button
                                onClick={() => handleDownload(file.name)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet hover:bg-violet/10 transition-all"
                                title="Télécharger"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                              </button>

                              {/* Delete */}
                              {deleteConfirm === file.name ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(file.name)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] font-bold"
                                    title="Confirmer"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all text-[10px] font-bold"
                                    title="Annuler"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(file.name)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                  title="Supprimer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Files footer */}
                  <div className="shrink-0 border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
                    <p className="text-center text-[10px] text-gray-400">
                      {filteredFiles.length} fichier{filteredFiles.length !== 1 ? "s" : ""} {selectedCategory ? `dans ${categoryOptions.find(c => c.id === selectedCategory)?.label || selectedCategory}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

<style jsx>{`
        @keyframes animate-in {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-in { animation: animate-in 0.2s ease-out; }
      `}</style>
    </>
  );
}
