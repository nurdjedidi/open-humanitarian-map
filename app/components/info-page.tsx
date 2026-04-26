import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import type { ReactNode } from "react";

import { useI18n } from "~/i18n/use-i18n";

export function InfoPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-[#061019] px-4 py-6 text-[#e8eef5] md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#d7e4ee] transition hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("info.backToMap")}
          </Link>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-[#0a1420]/92 p-6 shadow-[0_24px_90px_rgba(2,6,12,0.3)] backdrop-blur-xl md:p-8">
          <h1 className="text-3xl font-black text-white md:text-4xl">{title}</h1>
          <div className="mt-6 space-y-5 text-base leading-8 text-[#c3d2de]">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
