import type { Route } from "./+types/sources";

import { InfoPage } from "~/components/info-page";
import { RuntimeSeo } from "~/components/runtime-seo";
import { useI18n } from "~/i18n/use-i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OHM | Sources" },
    { name: "description", content: "Sources and licenses for Open Humanitarian Map" },
  ];
}

function SourcesContent() {
  const { t } = useI18n();

  return (
    <InfoPage title={t("info.sourcesTitle")}>
      <p>{t("info.sourcesIntro")}</p>
      <p>{t("info.sourceOsm")}</p>
      <p>{t("info.sourceIpc")}</p>
      <p>{t("info.sourceBoundaries")}</p>
    </InfoPage>
  );
}

export default function SourcesRoute() {
  return (
    <>
      <RuntimeSeo titleKey="seo.sourcesTitle" descriptionKey="seo.homeDescription" />
      <SourcesContent />
    </>
  );
}
