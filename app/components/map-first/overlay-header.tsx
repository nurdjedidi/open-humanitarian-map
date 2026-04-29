import { ExternalLink, Info, Mail, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { MapDataset } from "~/data/dataset-types";
import { useI18n } from "~/i18n/use-i18n";
import { LanguageSwitch } from "../language-switch";

export function OverlayHeader({
  dataset,
}: {
  dataset: MapDataset;
}) {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { to: "/about", label: t("demo.navAbout"), icon: Info },
    { to: "/sources", label: t("demo.navSources"), icon: ExternalLink },
    { to: "/contact", label: t("demo.navContact"), icon: Mail },
  ];

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-3 md:px-4 md:py-4">
        <div className="flex min-w-0 items-center gap-2 rounded-[22px] border border-white/10 bg-[#08131e]/88 px-3 py-2.5 shadow-[0_18px_60px_rgba(2,6,12,0.32)] backdrop-blur-xl md:gap-3 md:px-4 md:py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#08131e]/40 p-1 md:h-11 md:w-11 md:rounded-2xl">
            <img src="/favicon.svg" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#84b7e4] md:text-[11px] md:tracking-[0.22em]">
              {t("common.brandFull")}
            </p>
            <h1 className="truncate text-sm font-extrabold text-[#f4f8fc] md:text-lg">
              West Africa priority map
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[22px] border border-white/10 bg-[#08131e]/88 px-2 py-2 shadow-[0_18px_60px_rgba(2,6,12,0.32)] backdrop-blur-xl md:px-3">
          <nav className="hidden items-center gap-2 md:flex">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#d7e4ee] transition hover:bg-white/[0.08]"
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          
          <div className="hidden lg:block">
            <LanguageSwitch />
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="rounded-full border border-white/8 bg-white/[0.04] p-2.5 text-[#e4edf4] transition hover:bg-white/[0.08] lg:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#060c14]/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Content */}
          <div className="absolute right-3 top-3 w-[280px] max-w-[calc(100vw-24px)] rounded-[32px] border border-white/12 bg-[#0a1622]/98 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#1b3955]/10 p-1">
                <img src="/favicon.svg" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-[#9cb4c7] hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-3">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-base font-bold text-[#f4f8fc] transition hover:bg-white/[0.06]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#84b7e4]">
                      <Icon className="h-5 w-5" />
                    </div>
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 border-t border-white/10 pt-8">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#84b7e4]">
                {t("demo.basemap")}
              </p>
              <div className="flex justify-center">
                <LanguageSwitch />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
