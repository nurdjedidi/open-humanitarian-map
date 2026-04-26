import type { Route } from "./+types/about";

import { InfoPage } from "~/components/info-page";
import { RuntimeSeo } from "~/components/runtime-seo";
import { useI18n } from "~/i18n/use-i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OHM | About" },
    { name: "description", content: "About Open Humanitarian Map" },
  ];
}

function AboutContent() {
  const { t } = useI18n();

  return (
    <InfoPage title={t("info.aboutTitle")}>
      <p>{t("info.aboutBody1")}</p>
      <p>{t("info.aboutBody2")}</p>
      <p>{t("info.aboutBody3")}</p>
    </InfoPage>
  );
}

export default function AboutRoute() {
  return (
    <>
      <RuntimeSeo titleKey="seo.aboutTitle" descriptionKey="seo.homeDescription" />
      <AboutContent />
    </>
  );
}
