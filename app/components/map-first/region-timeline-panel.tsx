import { X } from "lucide-react";

import type { RegionDetail, RegionTimelineEntry } from "~/data/datasets";
import { useI18n } from "~/i18n/use-i18n";

function phaseTone(phase: number | null) {
  if (phase === null) return "bg-[#3d4957] text-[#dbe4eb]";
  if (phase >= 5) return "bg-[#441014] text-[#ffd7d7]";
  if (phase >= 4) return "bg-[#6b1f18] text-[#ffe2d4]";
  if (phase >= 3) return "bg-[#a33d20] text-[#fff1e7]";
  if (phase >= 2) return "bg-[#c47d28] text-[#fff5dc]";
  return "bg-[#3a5a2a] text-[#eef8e8]";
}

function compactNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("fr-FR", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function TimelineRow({ item }: { item: RegionTimelineEntry }) {
  const share =
    item.shareP3Plus !== null
      ? new Intl.NumberFormat("fr-FR", {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(item.shareP3Plus)
      : "n/a";

  return (
    <div className="grid grid-cols-[56px_72px_1fr] items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
      <div className="pt-1 text-sm font-semibold text-[#f6efe6]">
        {item.year ?? "n/a"}
      </div>
      <div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${phaseTone(item.phase)}`}
        >
          IPC {item.phase ?? "n/a"}
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs uppercase tracking-[0.18em] text-[#8fb7da]">
          {item.type || "n/a"}
        </div>
        <div className="mt-1 text-sm text-[#dfe8ef]">
          P3+ {compactNumber(item.p3plus)} · Pop {compactNumber(item.population)} · {share}
        </div>
      </div>
    </div>
  );
}

export function RegionTimelinePanel({
  region,
  onClose,
}: {
  region: RegionDetail | null;
  onClose: () => void;
}) {
  const { locale } = useI18n();

  if (!region) return null;

  return (
    <aside className="pointer-events-auto absolute bottom-14 left-4 z-30 w-[360px] max-w-[calc(100vw-32px)] rounded-[26px] border border-white/10 bg-[#0a1420]/94 p-4 shadow-[0_24px_80px_rgba(2,6,12,0.38)] backdrop-blur-xl md:bottom-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8fb7da]">
            {locale === "fr" ? "Timeline IPC" : "IPC timeline"}
          </div>
          <h3 className="mt-1 text-xl font-semibold text-[#f7f2eb]">{region.name}</h3>
          <p className="mt-1 text-sm text-[#9db1c1]">
            {region.countryName} · {region.adm1Name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-[#dde7ef] transition hover:bg-white/[0.1]"
          aria-label={locale === "fr" ? "Fermer" : "Close"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 rounded-2xl border border-[#d98a35]/25 bg-[#1a2532]/70 px-3 py-2.5 text-sm text-[#e6edf3]">
        {locale === "fr"
          ? "Historique IPC trié chronologiquement pour cette région. La carte reste scorée sur la période la plus récente disponible."
          : "Chronological IPC history for this region. The map score still uses the most recent available period."}
      </div>

      <div className="panel-scroll max-h-[40vh] space-y-2 overflow-y-auto pr-1">
        {region.history.length ? (
          region.history.map((item, index) => (
            <TimelineRow
              key={`${region.id}-${item.year ?? "na"}-${item.type}-${index}`}
              item={item}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-[#a9bbc8]">
            {locale === "fr"
              ? "Aucun historique IPC disponible pour cette région."
              : "No IPC history available for this region."}
          </div>
        )}
      </div>
    </aside>
  );
}
