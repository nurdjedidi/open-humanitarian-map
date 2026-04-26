import { ExternalLink, Info, Mail } from "lucide-react";
import { Link } from "react-router";

import type { MapDataset } from "~/data/datasets";
import { useI18n } from "~/i18n/use-i18n";
import { LanguageSwitch } from "../language-switch";

export function OverlayHeader({
  dataset,
}: {
  dataset: MapDataset;
}) {
  const { t } = useI18n();

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-3 md:px-4 md:py-4">
      <div className="flex min-w-0 items-center gap-3 rounded-[22px] border border-white/10 bg-[#08131e]/88 px-4 py-3 shadow-[0_18px_60px_rgba(2,6,12,0.32)] backdrop-blur-xl">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1b3955] text-sm font-black text-[#91c7ff]">
          {t("common.brandShort")}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-[#84b7e4]">
            {t("common.brandFull")}
          </p>
          <h1 className="truncate text-base font-extrabold text-[#f4f8fc] md:text-lg">
            West Africa priority map
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[22px] border border-white/10 bg-[#08131e]/88 px-3 py-2 shadow-[0_18px_60px_rgba(2,6,12,0.32)] backdrop-blur-xl">
        <nav className="hidden items-center gap-2 md:flex">
          <Link
            to="/about"
            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#d7e4ee] transition hover:bg-white/[0.08]"
          >
            <Info className="h-4 w-4" />
            {t("demo.navAbout")}
          </Link>
          <Link
            to="/sources"
            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#d7e4ee] transition hover:bg-white/[0.08]"
          >
            <ExternalLink className="h-4 w-4" />
            {t("demo.navSources")}
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#d7e4ee] transition hover:bg-white/[0.08]"
          >
            <Mail className="h-4 w-4" />
            {t("demo.navContact")}
          </Link>
        </nav>
        <LanguageSwitch />
      </div>
    </header>
  );
}
