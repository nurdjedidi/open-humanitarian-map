import type { Route } from "./+types/contact";

import { ExternalLink, Mail, MessageCircle } from "lucide-react";

import { InfoPage } from "~/components/info-page";
import { RuntimeSeo } from "~/components/runtime-seo";
import { appConfig } from "~/content";
import { useI18n } from "~/i18n/use-i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OHM | Contact" },
    { name: "description", content: "Contact Open Humanitarian Map" },
  ];
}

function ContactContent() {
  const { t } = useI18n();

  return (
    <InfoPage title={t("info.contactTitle")}>
      <p>{t("info.contactBody")}</p>
      <div className="grid gap-3">
        <a
          className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[#eff5fa] transition hover:bg-white/[0.08]"
          href={appConfig.contact.email}
        >
          <Mail className="h-4 w-4" />
          {t("info.contactEmail")}
        </a>
        <a
          className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[#eff5fa] transition hover:bg-white/[0.08]"
          href={appConfig.contact.whatsapp}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="h-4 w-4" />
          {t("info.contactWhatsapp")}
        </a>
        <a
          className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[#eff5fa] transition hover:bg-white/[0.08]"
          href={appConfig.contact.linkedin}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
          {t("info.contactLinkedin")}
        </a>
      </div>
    </InfoPage>
  );
}

export default function ContactRoute() {
  return (
    <>
      <RuntimeSeo titleKey="seo.contactTitle" descriptionKey="seo.homeDescription" />
      <ContactContent />
    </>
  );
}
