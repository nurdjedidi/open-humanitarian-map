import { ExternalLink, Mail, MessageCircle } from "lucide-react";

import { appConfig } from "~/content";
import { useI18n } from "~/i18n/use-i18n";
import type { InfoTab } from "./types";
import { cx } from "./ui";

export function InfoTabs({
  activeInfoTab,
  setActiveInfoTab,
}: {
  activeInfoTab: InfoTab;
  setActiveInfoTab: (value: InfoTab) => void;
}) {
  const { t } = useI18n();
  const tabs: Array<{ id: InfoTab; label: string }> = [
    { id: "about", label: t("demo.infoAbout") },
    { id: "method", label: t("demo.infoMethod") },
    { id: "sources", label: t("demo.infoSources") },
    { id: "contact", label: t("demo.infoContact") },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveInfoTab(tab.id)}
          className={cx(
            "rounded-full border px-3 py-2 text-xs font-semibold transition",
            activeInfoTab === tab.id
              ? "border-[#d98a35] bg-[#172636] text-white"
              : "border-white/8 bg-white/[0.03] text-[#c8d7e4] hover:bg-white/[0.06]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function InfoContent({ activeInfoTab }: { activeInfoTab: InfoTab }) {
  const { t } = useI18n();

  if (activeInfoTab === "method") {
    return (
      <div className="space-y-3 text-sm leading-6 text-[#dbe7f1]">
        <h3 className="text-lg font-bold text-white">{t("demo.methodTitle")}</h3>
        <ul className="space-y-2 text-[#a9bfce]">
          <li>{t("demo.methodStep1")}</li>
          <li>{t("demo.methodStep2")}</li>
          <li>{t("demo.methodStep3")}</li>
        </ul>
      </div>
    );
  }

  if (activeInfoTab === "sources") {
    return (
      <div className="space-y-3 text-sm leading-6 text-[#dbe7f1]">
        <h3 className="text-lg font-bold text-white">{t("demo.sourcesTitle")}</h3>
        <p className="text-[#a9bfce]">{t("demo.sourcesIntro")}</p>
        <ul className="space-y-2 text-[#dbe7f1]">
          <li>{t("demo.sourceOsm")}</li>
          <li>{t("demo.sourceIpc")}</li>
          <li>{t("demo.sourceBoundaries")}</li>
        </ul>
      </div>
    );
  }

  if (activeInfoTab === "contact") {
    return (
      <div className="space-y-4 text-sm leading-6 text-[#dbe7f1]">
        <div>
          <h3 className="text-lg font-bold text-white">{t("demo.contactTitle")}</h3>
          <p className="mt-2 text-[#a9bfce]">{t("demo.contactBody")}</p>
        </div>
        <div className="grid gap-2">
          <a
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-[#eff5fa] transition hover:bg-white/[0.08]"
            href={appConfig.contact.email}
          >
            <Mail className="h-4 w-4" />
            {t("demo.contactEmail")}
          </a>
          <a
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-[#eff5fa] transition hover:bg-white/[0.08]"
            href={appConfig.contact.whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-4 w-4" />
            {t("demo.contactWhatsapp")}
          </a>
          <a
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-[#eff5fa] transition hover:bg-white/[0.08]"
            href={appConfig.contact.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            {t("demo.contactLinkedin")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-6 text-[#dbe7f1]">
      <h3 className="text-lg font-bold text-white">{t("demo.aboutTitle")}</h3>
      <p className="text-[#a9bfce]">{t("demo.aboutBody")}</p>
    </div>
  );
}
