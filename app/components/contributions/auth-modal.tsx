import { useState } from "react";
import { X } from "lucide-react";
import { login, signup, type AuthState } from "~/api/ohm-api";

export function AuthModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (auth: AuthState) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const response = await signup({ email, password, displayName: displayName || undefined });
        if (response.needsEmailConfirmation) {
          setError("Compte créé. Confirme l'email avant de te connecter.");
          return;
        }
      } else {
        await login({ email, password });
      }
      onAuthenticated({
        user: { id: "", email },
        profile: null,
      });
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#02060bcc] px-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0a1420]/98 p-5 text-[#edf5fb] shadow-[0_28px_90px_rgba(2,6,12,0.48)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#85b8e5]">
              Compte OHM
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {mode === "login" ? "Se connecter" : "Créer un compte"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.04] p-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          {mode === "signup" ? (
            <label className="grid gap-1.5 text-sm text-[#b6c8d8]">
              Nom affiché
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[#f4f8fb] outline-none focus:border-[#d98a35]"
              />
            </label>
          ) : null}

          <label className="grid gap-1.5 text-sm text-[#b6c8d8]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[#f4f8fb] outline-none focus:border-[#d98a35]"
            />
          </label>

          <label className="grid gap-1.5 text-sm text-[#b6c8d8]">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[#f4f8fb] outline-none focus:border-[#d98a35]"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-2xl border border-[#f0c170] bg-[#f0c170] px-4 py-3 font-bold text-[#102031] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "Connexion..." : mode === "login" ? "Se connecter" : "Créer le compte"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-3 w-full text-sm text-[#9ec4e7] transition hover:text-white"
        >
          {mode === "login" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </button>
      </form>
    </div>
  );
}
