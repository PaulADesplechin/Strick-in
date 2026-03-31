"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { verifyAdminPassword } from "@/lib/supabase";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-green-300 rounded-lg p-3 my-2 text-xs overflow-x-auto"><code>$1</code></pre>');
  // Inline code
  html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 text-violet px-1.5 py-0.5 rounded text-xs">$1</code>');
  // Headers
  html = html.replace(/^### (.*$)/gm, '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.*$)/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>');
  html = html.replace(/^# (.*$)/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>');
  // Bullet points
  html = html.replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-sm">$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal text-sm">$2</li>');
  // Line breaks
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  return html;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && isAuthenticated && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isAuthenticated]);

  // Check localStorage for saved admin state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("strickin_admin");
      if (saved === "true") setIsAuthenticated(true);
    } catch {}
  }, []);

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (verifyAdminPassword(password)) {
      setIsAuthenticated(true);
      setPasswordError(false);
      try { localStorage.setItem("strickin_admin", "true"); } catch {}
      // Add welcome message
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Bonjour ! Je suis l'assistant IA de **Strick'in**. Je peux vous aider sur :\n\n- **Questions sur les produits structurés** (Autocall, Phoenix, KIDs, etc.)\n- **Génération de business plans** pour la distribution\n- **Informations sur le marché** français des produits structurés\n- **Aspects réglementaires** (MiFID II, PRIIPs, DDA)\n\nComment puis-je vous aider ?",
        timestamp: new Date(),
      }]);
    } else {
      setPasswordError(true);
      setPassword("");
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
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

      if (!res.ok) {
        throw new Error(data.error || "Erreur serveur");
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

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
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in">
          {/* Header */}
          <div className="bg-violet px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">Assistant Strick&apos;in</h3>
              <p className="text-white/70 text-xs">IA &middot; Produits structurés</p>
            </div>
            {isAuthenticated && messages.length > 1 && (
              <button
                onClick={() => {
                  setMessages([messages[0]]);
                }}
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
                    <span className="text-2xl">🔐</span>
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
              <div className="shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Posez votre question..."
                    rows={1}
                    className="flex-1 resize-none text-sm px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20 transition-all max-h-24 overflow-y-auto"
                    style={{ minHeight: "42px" }}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="w-10 h-10 rounded-xl bg-violet text-white flex items-center justify-center hover:bg-violet/90 disabled:opacity-40 transition-all shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                </div>
                <p className="text-center text-xs text-gray-300 mt-2">Propulsé par Claude &middot; Strick&apos;in AI</p>
              </div>
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
