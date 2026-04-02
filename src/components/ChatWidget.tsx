"use client";

import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { verifyAdminPassword, supabase, CATEGORIES } from "@/lib/supabase";

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

interface StorageFile {
  name: string;
  id: string;
  metadata: { size: number; mimetype: string };
  created_at: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface ActivityLog {
  id: string;
  action: string;
  timestamp: Date;
}

interface FileTag {
  extension: string;
  color: string;
  label: string;
}

// Helper Functions
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
    pdf: "📄", pptx: "📊", docx: "📝", xlsx: "📈",
    html: "🌐", png: "🖼️", jpg: "🖼️", svg: "🎨",
    json: "📋", ts: "💻", js: "💻", csv: "📊",
  };
  return map[ext] || "📁";
}

function getFileTag(name: string): FileTag {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const tags: Record<string, FileTag> = {
    pdf: { extension: "PDF", color: "bg-red-100 text-red-700", label: "PDF" },
    docx: { extension: "DOCX", color: "bg-blue-100 text-blue-700", label: "DOCX" },
    xlsx: { extension: "XLSX", color: "bg-green-100 text-green-700", label: "XLSX" },
    png: { extension: "PNG", color: "bg-purple-100 text-purple-700", label: "IMAGE" },
    jpg: { extension: "JPG", color: "bg-purple-100 text-purple-700", label: "IMAGE" },
    svg: { extension: "SVG", color: "bg-purple-100 text-purple-700", label: "IMAGE" },
    pptx: { extension: "PPTX", color: "bg-orange-100 text-orange-700", label: "PPTX" },
  };
  return tags[ext] || { extension: ext.toUpperCase(), color: "bg-gray-100 text-gray-700", label: "FICHIER" };
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url);
}

function isPdfUrl(url: string): boolean {
  return /\.pdf$/i.test(url);
}

export default function ChatWidget() {
  // Core state
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Conversations history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Chat attachments
  const [attachedFiles, setAttachedFiles] = useState<{name: string; path: string; size: number}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // File management
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePreviewRef = useRef<HTMLDivElement>(null);

  // ============= Toast System =============
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // ============= Activity Logging =============
  const addActivityLog = useCallback((action: string) => {
    setActivityLogs(prev => [
      { id: Date.now().toString(), action, timestamp: new Date() },
      ...prev,
    ].slice(0, 20));
  }, []);

  // ============= Conversation History =============
  useEffect(() => {
    try {
      const saved = localStorage.getItem("strickin_conversations");
      if (saved) setConversations(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("strickin_conversations", JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  const saveCurrentConversation = useCallback(() => {
    if (messages.length <= 1) return;
    const firstUserMsg = messages.find(m => m.role === "user");
    const title = firstUserMsg?.content.slice(0, 50).replace(/\n/g, " ") || "Conversation";

    setConversations(prev => {
      const existing = prev.find(c => c.id === "current");
      if (existing) {
        return prev.map(c => c.id === "current" ? { ...c, messages, timestamp: new Date() } : c);
      } else {
        return [{ id: Date.now().toString(), title, messages, timestamp: new Date() }, ...prev].slice(0, 20);
      }
    });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(saveCurrentConversation, 30000);
    return () => clearInterval(interval);
  }, [saveCurrentConversation]);

  const loadConversation = (conv: Conversation) => {
    setMessages(conv.messages);
    setShowHistory(false);
  };

  // ============= Theme =============
  useEffect(() => {
    try {
      const saved = localStorage.getItem("strickin_dark_mode");
      if (saved) setIsDarkMode(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("strickin_dark_mode", JSON.stringify(isDarkMode));
    } catch {}
  }, [isDarkMode]);

  // ============= Auth & Files =============
  useEffect(() => {
    try {
      const saved = localStorage.getItem("strickin_admin");
      if (saved === "true") setIsAuthenticated(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === "files" && isAuthenticated) {
      loadFiles();
    }
  }, [activeTab, isAuthenticated, selectedCategory]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && isAuthenticated && activeTab === "chat" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isAuthenticated, activeTab]);

  // ============= File Management =============
  async function loadFiles() {
    setFilesLoading(true);
    try {
      const folder = selectedCategory || "";
      const { data, error } = await supabase.storage
        .from("strickin-docs")
        .list(folder, { limit: 200, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const fileList = (data || []).filter(f => f.name !== ".emptyFolderPlaceholder" && f.id);
      setFiles(fileList as StorageFile[]);
    } catch (err) {
      console.error("Error loading files:", err);
      showToast("Erreur lors du chargement des fichiers", "error");
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
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        await new Promise((resolve, reject) => {
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(null);
            } else {
              reject(new Error(xhr.responseText));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        addActivityLog(`Fichier uploadé: ${file.name}`);
        showToast(`${file.name} uploadé avec succès`, "success");
      }
      await loadFiles();
    } catch (err) {
      console.error("Upload error:", err);
      showToast(`Erreur upload: ${err instanceof Error ? err.message : "Erreur inconnue"}`, "error");
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileName: string) {
    const folder = selectedCategory || "";
    const path = folder ? `${folder}/${fileName}` : fileName;
    try {
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirm(null);
      addActivityLog(`Fichier supprimé: ${fileName}`);
      showToast("Fichier supprimé", "success");
      await loadFiles();
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Erreur lors de la suppression", "error");
    }
  }

  function handleDownload(fileName: string) {
    const folder = selectedCategory || "";
    const path = folder ? `${folder}/${fileName}` : fileName;
    const { data } = supabase.storage.from("strickin-docs").getPublicUrl(path);
    if (data?.publicUrl) {
      addActivityLog(`Fichier téléchargé: ${fileName}`);
      const a = document.createElement("a");
      a.href = data.publicUrl;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  function openFilePreview(file: StorageFile) {
    setSelectedFile(file);
  }

  function closeFilePreview() {
    setSelectedFile(null);
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
      showToast("Authentification réussie", "success");
    } else {
      setPasswordError(true);
      setPassword("");
      showToast("Mot de passe incorrect", "error");
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;
    if (isLoading) return;

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
    setIsStreaming(true);

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
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur serveur");
      }

      // Try streaming first
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let fullResponse = "";
          const assistantMsgId = (Date.now() + 1).toString();

          setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
          }]);

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              fullResponse += chunk;
              setMessages(prev =>
                prev.map(m => m.id === assistantMsgId ? { ...m, content: fullResponse } : m)
              );
              scrollToBottom();
            }
          } catch (streamErr) {
            console.error("Streaming error:", streamErr);
          }
        }
      } else {
        // Fallback to JSON response
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }]);
      }

      if (text.toLowerCase().match(/suppr|delete|déplace|move|ajout|upload|créer|générer|fichier/)) {
        if (activeTab === "files") loadFiles();
      }

      saveCurrentConversation();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Impossible de contacter l'assistant.";
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Erreur : ${errorMsg}`,
        timestamp: new Date(),
      }]);
      showToast(errorMsg, "error");
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
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
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        await new Promise((resolve, reject) => {
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(null);
            } else {
              reject(new Error(xhr.responseText));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        setAttachedFiles(prev => [...prev, { name: file.name, path: `${folder}/${file.name}`, size: file.size }]);
        addActivityLog(`Fichier joint: ${file.name}`);
      }
      showToast("Fichiers attachés", "success");
    } catch (err) {
      console.error("Chat attach error:", err);
      showToast("Erreur lors de l'attachement", "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (chatFileRef.current) chatFileRef.current.value = "";
    }
  }

  function removeAttachment(name: string) {
    setAttachedFiles(prev => prev.filter(f => f.name !== name));
  }

  // ============= Drag & Drop =============
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
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(null);
            else reject(new Error(xhr.responseText));
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        setAttachedFiles(prev => [...prev, { name: file.name, path: `${folder}/${file.name}`, size: file.size }]);
      }
      showToast("Fichiers déposés avec succès", "success");
    } catch (err) {
      console.error("Drop upload error:", err);
      showToast("Erreur lors du dépôt", "error");
    } finally {
      setIsUploading(false);
    }
  }

  // ============= Keyboard Shortcuts =============
  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Escape to close
    if (e.key === "Escape" && isOpen) {
      setIsOpen(false);
    }
  }

  // Ctrl+V for clipboard image
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!isOpen || !isAuthenticated || activeTab !== "chat") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.includes("image")) {
          const file = items[i].getAsFile();
          if (file) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            const syntheticEvent = { target: { files: dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>;
            handleChatAttach(syntheticEvent);
          }
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, isAuthenticated, activeTab]);

  // ============= Conversation Export =============
  function exportConversation() {
    const markdown = messages
      .map(m => {
        const role = m.role === "user" ? "Vous" : "Assistant";
        return `## ${role}\n${m.content}`;
      })
      .join("\n\n---\n\n");

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown));
    element.setAttribute("download", `conversation_${Date.now()}.md`);
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addActivityLog("Conversation exportée");
    showToast("Conversation exportée", "success");
  }

  // ============= Helpers =============
  const filteredFiles = files.filter(f =>
    !fileSearch || f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );
  const categoryOptions = CATEGORIES.map(c => ({ id: c.id, label: c.label }));

  // ============= Render File Preview Modal =============
  function renderFilePreview(): ReactNode {
    if (!selectedFile) return null;
    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "";
    const { data } = supabase.storage.from("strickin-docs").getPublicUrl(
      selectedCategory ? `${selectedCategory}/${selectedFile.name}` : selectedFile.name
    );
    const url = data?.publicUrl;

    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${isDarkMode ? "bg-black/50" : "bg-black/50"}`}>
        <div ref={filePreviewRef} className={`rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
            <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{selectedFile.name}</h3>
            <button onClick={closeFilePreview} className={`p-1 hover:bg-gray-200 rounded ${isDarkMode ? "hover:bg-gray-700" : ""}`}>
              ✕
            </button>
          </div>
          <div className="p-4">
            {(ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "svg") && url && (
              <img src={url} alt={selectedFile.name} className="max-w-full h-auto rounded" />
            )}
            {ext === "pdf" && url && (
              <iframe src={url} className="w-full h-[70vh] rounded border border-gray-300" />
            )}
            {!["png", "jpg", "jpeg", "gif", "svg", "pdf"].includes(ext) && url && (
              <div className="text-center py-8">
                <p className={`mb-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Aperçu non disponible</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-violet text-white rounded-lg hover:bg-violet/90">
                  Télécharger le fichier
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============= Main Render =============
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
        <div className={`fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[650px] max-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in sm:bottom-24 sm:right-6 mobile:fixed mobile:inset-4 mobile:bottom-4 mobile:right-4 mobile:rounded-2xl mobile:h-auto mobile:max-w-none ${
          isDarkMode
            ? "bg-gray-900 border-gray-700"
            : "bg-white border-gray-200"
        }`}>
          {/* Header */}
          <div className={`px-5 py-4 flex items-center justify-between shrink-0 ${isDarkMode ? "bg-violet" : "bg-violet"}`}>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Assistant Strick&apos;in</h3>
                <p className="text-white/70 text-xs">IA · Produits structurés</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAuthenticated && (
                <>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-white/60 hover:text-white transition-colors"
                    title={isDarkMode ? "Mode clair" : "Mode sombre"}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </button>
                  {messages.length > 1 && activeTab === "chat" && (
                    <button
                      onClick={exportConversation}
                      className="p-2 text-white/60 hover:text-white transition-colors"
                      title="Exporter"
                    >
                      ↓
                    </button>
                  )}
                  {messages.length > 1 && activeTab === "chat" && (
                    <button
                      onClick={() => setShowHistory(!showHistory) }
                      className="p-2 text-white/60 hover:text-white transition-colors"
                      title="Historique"
                    >
                      📜
                    </button>
                  )}
                  {messages.length > 1 && activeTab === "chat" && (
                    <button
                      onClick={() => setMessages([messages[0]])}
                      className="p-2 text-white/60 hover:text-white transition-colors"
                      title="Nouvelle conversation"
                    >
                      ↻

                    </button>
                  )}
                </>
              }
            </div>
          </div>

          {/* History dropdown */}
          {showHistory && conversations.length > 0 && (
            <div className={`border-b ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-gray-50"} p-3 max-h-40 overflow-y-auto`}>
              <p className={`text-xs font-semibold mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Historique ({conversations.length})</p>
              <div className="space-y-1.5">
                {conversations.map(conv => (
                  <button
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className={`w-full text-left px-3 py-2 rounded text-xs hover:opacity-80 transition ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-white"}`}
                    >
                      <div className={isDarkMode ? "text-gray-300" : "text-gray-700"}>{conv.title}</div>
                      <div className={`text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{new Date(conv.timestamp).toLocaleString()}</div>
                     </button>
                  ))}
              </div>
            </div>
          )}

          {!isAuthenticated ? (
            /* Auth form */
            <div className={`flex-1 flex items-center justify-center p-6 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
              <form onSubmit={handleAuth} className="w-full space-y-4">
                <div className="text-center mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isDarkMode ? "bg-violet/20" : "bg-violet/10"}`}>
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className={`font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>Accès administrateur</h3>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>Entrez le mot de passe</p>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError(false); }}
                  placeholder="Mot de passe admin"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${
                    passwordError
                      ? isDarkMode ? "border-red-500 bg-red-900/20" : "border-red-400 bg-red-50"
                      : isDarkMode ? "border-gray-700 bg-gray-800 text-white focus:border-violet" : "border-gray-200 focus:border-violet"
                  }`}
                  autoFocus
                />
                {passwordError && <p className="text-red-500 text-xs">Mot de passe incorrect</p>}
                <button
                  type="submit"
                  disabled={!password}
                  className="w-full py-3 rounded-xl bg-violet text-white text-sm font-medium hover:bg-violet/90 disabled:opacity-40 transition-all"
                >
                  Dåverrouiller
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className={`flex border-b shrink-0 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "chat"
                      ? isDarkMode ? "text-violet border-b-2 border-violet bg-violet/10" : "text-violet border-b-2 border-violet bg-violet/5"
                      : isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                  Chat IA
                </button>
                <button
                  onClick={() => setActiveTab("files")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "files"
                      ? isDarkMode ? "text-violet border-b-2 border-violet bg-violet/10" : "text-violet border-b-2 border-violet bg-violet/5"
                      : isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  Fichiers
                </button>
              </div>

              {activeTab === "chat" ? (
                <>
                  {/* Messages */}
                  <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-violet text-white rounded-br-md"
                            : isDarkMode ? "bg-gray-800 text-gray-100 rounded-bl-md border border-gray-700" : "bg-gray-50 text-gray-800 rounded-bl-md border border-gray-100"
                        }`}>
                          {msg.role === "assistant" ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {attachedFiles.length > 0 && !isLoading && (
                      <div className={`text-xs px-1 py-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                        💡 Demandez-moi un résumé de ce fichier
                      </div>
                    )}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className={`rounded-2xl rounded-bl-md px-4 py-3 border ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
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
                    className={`shrink-0 border-t px-4 py-3 relative transition-colors ${
                      isDarkMode
                        ? `bg-gray-800 border-gray-700 ${isDragging ? "bg-violet/10 border-violet" : ""}`
                        : `bg-white border-gray-100 ${isDragging ? "bg-violet/5 border-violet" : ""}`
                    }`}
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
                          <div key={f.name} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${isDarkMode ? "bg-violet/20 text-violet" : "bg-violet/10 text-violet"}`}>
                            <span>{getFileEmoji(f.name)}</span>
                            <span className="max-w-[120px] truncate">{f.name}</span>
                            <button onClick={() => removeAttachment(f.name)} className="hover:text-red-500 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload progress */}
                    {isUploading && uploadProgress > 0 && (
                      <div className="mb-2">
                        <div className="w-full h-1.5 bg-gray-300 rounded-full overflow-hidden">
                          <div style={{ width: `${uploadProgress}%` }} className="h-full bg-violet transition-all" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
                      </div>
                    )}

                    {/* Chat input area */}
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => chatFileRef.current?.click()}
                        disabled={isUploading}
                        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isDarkMode
                            ? "text-gray-500 hover:text-violet hover:bg-violet/10"
                            : "text-gray-400 hover:text-violet hover:bg-violet/10"
                        }`}
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
                        className={`flex-1 resize-none text-sm px-3 py-2 rounded-xl border outline-none transition-all max-h-24 ${
                          isDarkMode
                            ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-violet focus:ring-2 focus:ring-violet/20"
                            : "border-gray-200 focus:border-violet focus:ring-2 focus:ring-violet/20"
                        }`}
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
                <div className={`flex-1 flex flex-col overflow-hidden ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                  {/* Category select and search */}
                  <div className={`px-4 py-3 border-b space-y-2 shrink-0 ${isDarkMode ? "border-gray-700" : "border-gray-100"}`}>
                    <select
                      value={selectedCategory}
                      onChange={e => { setSelectedCategory(e.target.value); setFileSearch(""); }}
                      className={`w-full text-xs px-3 py-2 rounded-lg border outline-none transition-all ${
                        isDarkMode
                          ? "border-gray-600 bg-gray-800 text-white focus:border-violet focus:ring-2 focus:ring-violet/20"
                          : "border-gray-200 focus:border-violet focus:ring-2 focus:ring-violet/20"
                      }`}
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
                        placeholder="Rechercher un fichier ..."
                        className={`w-full text-xs px-3 py-2 pl-8 rounded-lg border outline-none transition-all ${
                          isDarkMode
                            ? "border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:border-violet"
                            : "border-gray-200 focus:border-violet"
                        }`}
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                   </div>

                  {/* Action buttons */}
                  <div className="px-4 py-2 flex gap-2 shrink-0">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet text-white text-xs font-medium hover:bg-violet-90 disabled:opacity-50 transition-all"
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
                        className={`px-3 py-2 rounded-lg text-xs transition-all ${
                          isDarkMode
                            ? "border border-gray-600 text-gray-400 hover:bg-gray-800"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Rafraëchir"
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
                        <p className={`text-sm ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{selectedCategory ? "Aucun fichier dans ce dossier" : "Sélectionnez un dossier"}</p>
                        <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`}>Utilisez le menu ci-dessus pour naviguer</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {filteredFiles.map(file => (
                          <div
                            key={file.id || file.name}
                            className={`group flex items-center gap-2.5 p-2.5 rounded-xl transition-all border cursor-pointer ${
                              isDarkMode
                                ? "hover:bg-gray-800 border-transparent hover:border-gray-700"
                                : "hover:bg-gray-50 border-transparent hover:border-gray-100"
                            }`}
                            onClick={() => openFilePreview(file)}
                          >
                            {/* File emoji */}
                            <span className="text-base shrink-0">{getFileEmoji(file.name)}</span>

                            {/* File info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{file.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className={`text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                                  {formatSize(file.metadata?.size || 0)} · {new Date(file.created_at).toLocaleDateString()}
                                </p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getFileTag(file.name).color}`}>
                                  {getFileTag(file.name).label}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {/* Download */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownload(file.name); }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                  isDarkMode
                                    ? "text-gray-500 hover:text-violet hover:bg-violet/10"
                                    : "text-gray-400 hover:text-violet hover:bg-violet/10"
                                }`}
                                title="Télécharger"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                              </button>

                              {/* Delete */}
                              {deleteConfirm === file.name ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] font-bold"
                                    title="Confirmer"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold ${
                                      isDarkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                                    title="Annuler"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.name); }}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                    isDarkMode
                                      ? "text-gray-500 hover:text-red-500 hover:bg-red-500/10"
                                      : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                  }`}
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

                  {/* Activity logs */}
                  {activityLogs.length > 0 && (
                    <div className={`shrink-0 border-t px-4 py-2.5 max-h-24 overflow-y-auto ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-gray-50/50"}`}>
                      <p className={`text-[10px] font-semibold mb-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Activité</p>
                      <div className="space-y-0.5">
                        {activityLogs.slice(0, 5).map(log => (
                          <p key={log.id} className={`text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                            {log.action} · {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files footer */}
                  <div className={`shrink-0 border-t px-4 py-2.5 ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-gray-50/50"}`}>
                    <p className={`text-center text-[10px] ${isDarkMode ? "text-gray-500" : "             <span className="text-base shrink-0">{getFileEmoji(file.name)}</span>

                            {/* File info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{file.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className={`text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                                  {formatSize(file.metadata?.size || 0)} · {new Date(file.created_at).toLocaleDateString()}
                                </p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getFileTag(file.name).color}`}>
                                  {getFileTag(file.name).label}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {/* Download */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownload(file.name); }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                  isDarkMode
                                    ? "text-gray-500 hover:text-violet hover:bg-violet/10"
                                    : "text-gray-400 hover:text-violet hover:bg-violet/10"
                                }`}
                                title="Télécharger"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                              </button>

                              {/* Delete */}
                              {deleteConfirm === file.name ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] font-bold"
                                    title="Confirmer"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold ${
                                      isDarkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                                    title="Annuler"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.name); }}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                    isDarkMode
                                      ? "text-gray-500 hover:text-red-500 hover:bg-red-500/10"
                                      : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                  }`}
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

                  {/* Activity logs */}
                  {activityLogs.length > 0 && (
                    <div className={`shrink-0 border-t px-4 py-2.5 max-h-24 overflow-y-auto ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-gray-50/50"}`}>
                      <p className={`text-[10px] font-semibold mb-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Activité</p>
                      <div className="space-y-0.5">
                        {activityLogs.slice(0, 5).map(log => (
                          <p key={log.id} className={`text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                            {log.action} · {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files footer */}
                  <div className={`shrink-0 border-t px-4 py-2.5 ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-gray-50/50"}`}>
                    <p className={`text-center text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                      {filteredFiles.length} fichier{filteredFiles.length !== 1 ? "s" : ""} {selectedCategory ? `dans ${categoryOptions.find(c => c.id === selectedCategory)?.label || selectedCategory}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      }

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[110] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg text-sm font-medium text-white shadow-lg animate-in pointer-events-auto ${
              toast.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* File Preview Modal */}
      {=selectedFile && renderFilePreview()}

      <style jsx>{`
        @keyframes animate-in {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-in { animation: animate-in 0.2s ease-out; }

        @media (max-width: 640px) {
          .mobile:fixed { position: fixed !important; }
          .mobile:inset-4 { inset: 1rem !important; }
        }
      `}</style>
    </>
  );
}
