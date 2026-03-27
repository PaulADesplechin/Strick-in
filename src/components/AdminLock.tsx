"use client";

import { useState } from "react";
import { verifyAdminPassword } from "@/lib/supabase";

interface AdminLockProps {
  onUnlock: () => void;
  onClose: () => void;
}

export function AdminLock({ onUnlock, onClose }: AdminLockProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyAdminPassword(password)) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={`bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 transition-transform ${
          shake ? "animate-shake" : ""
        }`}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="font-display font-bold text-xl text-gray-900">
            Accès restreint
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Ce document est protégé. Entrez le mot de passe administrateur pour y accéder.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Mot de passe admin"
              className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium outline-none transition-all ${
                error
                  ? "border-red-400 bg-red-50 text-red-700 placeholder-red-300"
                  : "border-grey-border bg-white text-gray-900 placeholder-gray-400 focus:border-violet focus:ring-2 focus:ring-violet/20"
              }`}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-xs mt-2 font-medium">
                Mot de passe incorrect. Réessayez.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 text-sm"
              disabled={!password}
            >
              Déverrouiller
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Contactez l'administrateur si vous n'avez pas le mot de passe
        </p>
      </div>
    </div>
  );
}
