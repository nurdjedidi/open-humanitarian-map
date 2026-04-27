import { BookOpen, ExternalLink, Info, Menu } from "lucide-react";

import { useI18n } from "~/i18n/use-i18n";
import { LanguageSwitch } from "../language-switch";
import type { InfoTab, MobileSheet } from "./types";

export function MapFirstHeader({
  onOpenInfo,
  onOpenMobileInfo,
}: {
  onOpenInfo: (tab: InfoTab) => void;
  onOpenMobileInfo: () => void;
}) {
  const { t } = useI18n();

  const infoActions = [
    {
      id: "about" as const,
      label: t("demo.navAbout"),
      icon: Info,
    },
    {
      id: "sources" as const,
      label: t("demo.navSources"),
      icon: BookOpen,
    },
    {
      id: "contact" as const,
      label: t("demo.navContact"),
      icon: ExternalLink,
    },
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-30 px-3 pt-3 md:px-4 md:pt-4">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#08131e]/90 px-4 py-3 shadow-[0_18px_60px_rgba(2,6,12,0.32)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#08131e]/40 p-1">
            <img src="/favicon.svg" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-[#84b7e4]">
              {t("common.brandFull")}
            </p>
            <h1 className="truncate text-base font-extrabold text-[#f4f8fc] md:text-lg">
              {t("demo.title")}
            </h1>
            <p className="hidden text-sm text-[#9cb4c7] md:block">
              {t("demo.subtitle")}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {infoActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onOpenInfo(action.id)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#d7e4ee] transition hover:bg-white/[0.08]"
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
          <LanguageSwitch />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitch />
          <button
            type="button"
            onClick={onOpenMobileInfo}
            className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-[#e4edf4]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function DesktopStats({
  regions,
  scoreMean,
  p3Total,
}: {
  regions: React.ReactNode;
  scoreMean: React.ReactNode;
  p3Total: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden xl:block">
      <div className="pointer-events-auto absolute right-4 top-[92px] flex gap-2">
        <div className="rounded-2xl border border-white/10 bg-[#0a1420]/88 px-4 py-3 shadow-[0_16px_50px_rgba(2,6,12,0.26)] backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8ca8bd]">
            {t("demo.regions")}
          </div>
          <div className="mt-1 text-xl font-black text-white">{regions}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1420]/88 px-4 py-3 shadow-[0_16px_50px_rgba(2,6,12,0.26)] backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8ca8bd]">
            {t("demo.scoreMean")}
          </div>
          <div className="mt-1 text-xl font-black text-white">{scoreMean}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1420]/88 px-4 py-3 shadow-[0_16px_50px_rgba(2,6,12,0.26)] backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8ca8bd]">
            P3+
          </div>
          <div className="mt-1 text-xl font-black text-white">{p3Total}</div>
        </div>
      </div>
    </div>
  );
}
