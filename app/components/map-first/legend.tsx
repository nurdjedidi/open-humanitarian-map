import type { ResolvedLegendItem } from "~/data/datasets";
import { useI18n } from "~/i18n/use-i18n";
import { cx } from "./ui";

export function LegendItem({ item }: { item: ResolvedLegendItem }) {
  const { t } = useI18n();

  if (item.id === "admin_priority") {
    const colors = item.colorScale ?? [
      "#c6c6c6",
      "#fff1aa",
      "#f5b437",
      "#dc4b23",
      "#23080c",
    ];

    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
        <div className="text-sm font-semibold text-[#f2f6fb]">{item.label}</div>
        <div
          className="mt-3 h-2.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${colors.join(", ")})` }}
        />
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#8ba4b8]">
          <span>{t("common.noData")}</span>
          <span>{t("common.urgentHigh")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
      <span
        className={cx(
          "inline-flex shrink-0 items-center justify-center rounded-full",
          item.symbol === "road" ? "h-[3px] w-7 rounded-full" : "h-3.5 w-3.5",
        )}
        style={{ backgroundColor: item.color ?? "#6b7280" }}
      />
      <div>
        <div className="text-sm font-semibold text-[#eff5fa]">{item.label}</div>
        <div className="text-xs leading-5 text-[#8ea7bb]">{item.meaning}</div>
      </div>
    </div>
  );
}
