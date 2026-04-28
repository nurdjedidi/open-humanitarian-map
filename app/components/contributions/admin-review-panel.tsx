import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  getPendingAdminContributions,
  reviewContribution,
  type AdminContribution,
  type AuthState,
} from "~/api/ohm-api";

export function AdminReviewPanel({
  auth,
  onReviewed,
}: {
  auth: AuthState | null;
  onReviewed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminContribution[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = auth?.profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin || !open) return;
    setLoading(true);
    getPendingAdminContributions()
      .then((response) => setItems(response.contributions))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isAdmin, open]);

  if (!isAdmin) return null;

  const review = async (id: string, decision: "validate" | "reject") => {
    await reviewContribution(id, decision);
    setItems((current) => current.filter((item) => item.id !== id));
    onReviewed();
  };

  return (
    <div className="absolute bottom-5 right-4 z-30 w-[min(360px,calc(100vw-2rem))]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ml-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a1420]/92 px-4 py-3 font-semibold text-[#edf5fb] shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl"
      >
        <ShieldCheck className="h-4 w-4 text-[#f0c170]" />
        Modération
      </button>

      {open ? (
        <div className="panel-scroll mt-2 max-h-[42vh] overflow-y-auto rounded-[24px] border border-white/10 bg-[#0a1420]/94 p-3 text-[#edf5fb] shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#85b8e5]">
            Contributions en attente
          </div>
          {loading ? <p className="text-sm text-[#9fb4c4]">Chargement...</p> : null}
          {!loading && !items.length ? (
            <p className="text-sm text-[#9fb4c4]">Aucune contribution en attente.</p>
          ) : null}
          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <div className="font-semibold">{item.type}</div>
                <div className="text-sm text-[#b8c8d6]">{item.value}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => review(item.id, "validate")}
                    className="rounded-xl bg-[#8bd7a6] px-3 py-2 text-sm font-bold text-[#082015]"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => review(item.id, "reject")}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
