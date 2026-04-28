import { Check, Crosshair, MapPin, ShieldCheck, X } from "lucide-react";
import type { ContributionType } from "~/api/ohm-api";

const OPTIONS: Record<ContributionType, Array<{ value: string; label: string }>> = {
  access: [
    { value: "accessible", label: "Accessible" },
    { value: "difficult", label: "Difficile" },
    { value: "seasonal_blocked", label: "Bloqué en saison" },
    { value: "inaccessible", label: "Inaccessible" },
  ],
  water: [
    { value: "functional", label: "Fonctionnel" },
    { value: "dry", label: "Sec" },
    { value: "seasonal", label: "Saisonnier" },
    { value: "broken", label: "Cassé" },
  ],
  road: [
    { value: "truck_ok", label: "Camion OK" },
    { value: "moto_only", label: "Moto seulement" },
    { value: "walk_only", label: "À pied seulement" },
    { value: "unusable", label: "Inutilisable" },
  ],
  ngo_presence: [
    { value: "active", label: "Présence active" },
    { value: "partial", label: "Présence partielle" },
    { value: "none", label: "Aucune présence" },
    { value: "unknown", label: "Inconnu" },
  ],
  alert: [{ value: "food_crisis", label: "Alerte crise alimentaire" }],
};

function ContributionForm({
  selectedCoordinate,
  type,
  value,
  loading,
  onTypeChange,
  onValueChange,
  onSubmit,
  onCancelPoint,
}: {
  selectedCoordinate: [number, number] | null;
  type: ContributionType;
  value: string;
  loading: boolean;
  onTypeChange: (value: ContributionType) => void;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onCancelPoint: () => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-[#a9bfd0]">
        <Crosshair className="h-4 w-4 shrink-0 text-[#f0c170]" />
        <span className="min-w-0 truncate">
          {selectedCoordinate
            ? `${selectedCoordinate[1].toFixed(4)}, ${selectedCoordinate[0].toFixed(4)}`
            : "Clique sur la carte pour choisir le point."}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={type}
          onChange={(event) => onTypeChange(event.target.value as ContributionType)}
          className="min-w-0 rounded-2xl border border-white/10 bg-[#111f2d] px-3 py-2 text-sm text-[#edf5fb] outline-none"
        >
          <option value="access">Accès</option>
          <option value="water">Eau</option>
          <option value="road">Route</option>
          <option value="ngo_presence">Présence ONG</option>
          <option value="alert">Alerte</option>
        </select>

        <select
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="min-w-0 rounded-2xl border border-white/10 bg-[#111f2d] px-3 py-2 text-sm text-[#edf5fb] outline-none"
        >
          {OPTIONS[type].map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          disabled={!selectedCoordinate || loading}
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f0c170] px-4 py-2.5 text-sm font-bold text-[#102031] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Envoi..." : "Envoyer"}
        </button>
        <button
          type="button"
          onClick={onCancelPoint}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#edf5fb]"
        >
          Effacer
        </button>
      </div>
    </div>
  );
}

export function ContributionControls({
  isAuthenticated,
  contributionMode,
  selectedCoordinate,
  type,
  value,
  feedback,
  loading,
  onOpenAuth,
  onToggleMode,
  onTypeChange,
  onValueChange,
  onSubmit,
  onCancelPoint,
}: {
  isAuthenticated: boolean;
  contributionMode: boolean;
  selectedCoordinate: [number, number] | null;
  type: ContributionType;
  value: string;
  feedback: string | null;
  loading: boolean;
  onOpenAuth: () => void;
  onToggleMode: () => void;
  onTypeChange: (value: ContributionType) => void;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onCancelPoint: () => void;
}) {
  const toggle = () => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    onToggleMode();
  };

  return (
    <>
      <div className="absolute left-3 top-[254px] z-30 md:left-4 md:top-[264px]">
        <button
          type="button"
          onClick={toggle}
          className={[
            "flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_12px_34px_rgba(2,6,12,0.3)] backdrop-blur-xl transition",
            contributionMode
              ? "border-[#f0c170] bg-[#d98a35]/95 text-[#102031]"
              : "border-white/10 bg-[#08131e]/88 text-[#d7e4ee] hover:bg-[#0f1b28]/92",
          ].join(" ")}
          aria-label="Contribuer"
          title={isAuthenticated ? "Contribuer" : "Connexion requise"}
        >
          {contributionMode ? <X className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        </button>
      </div>

      {contributionMode ? (
        <aside className="absolute left-[76px] top-[264px] z-40 hidden w-[320px] rounded-[24px] border border-white/10 bg-[#0a1420]/94 p-3 text-[#edf5fb] shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl md:block">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#85b8e5]">
                Contribution terrain
              </div>
              <p className="mt-1 text-xs leading-5 text-[#9fb4c4]">
                Réponds à une question structurée. Rien n'est public avant validation.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleMode}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ContributionForm
            selectedCoordinate={selectedCoordinate}
            type={type}
            value={value}
            loading={loading}
            onTypeChange={onTypeChange}
            onValueChange={onValueChange}
            onSubmit={onSubmit}
            onCancelPoint={onCancelPoint}
          />
        </aside>
      ) : null}

      {contributionMode ? (
        <div className="fixed inset-x-2 bottom-2 z-50 rounded-[22px] border border-white/10 bg-[#08131e]/98 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[#edf5fb] shadow-[0_-20px_80px_rgba(2,6,12,0.42)] md:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#85b8e5]">
                Contribution terrain
              </div>
              <div className="text-xs text-[#9fb4c4]">
                {selectedCoordinate ? "Vérifie puis envoie." : "Touche la carte pour placer le point."}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleMode}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ContributionForm
            selectedCoordinate={selectedCoordinate}
            type={type}
            value={value}
            loading={loading}
            onTypeChange={onTypeChange}
            onValueChange={onValueChange}
            onSubmit={onSubmit}
            onCancelPoint={onCancelPoint}
          />
        </div>
      ) : null}

      {feedback ? (
        <div className="pointer-events-none fixed inset-x-3 top-[92px] z-[65] mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-[#0a1420]/94 px-3 py-2 text-sm text-[#dcebf6] shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl md:top-[104px]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#8bd7a6]" />
          <span>{feedback}</span>
        </div>
      ) : null}

    </>
  );
}
