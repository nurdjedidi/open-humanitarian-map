import type { Route } from "./+types/sources";

import { InfoPage } from "~/components/info-page";
import { RuntimeSeo } from "~/components/runtime-seo";
import { useI18n } from "~/i18n/use-i18n";
import boundarySourcesRaw from "../../sources.md?raw";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OHM | Sources" },
    { name: "description", content: "Sources and licenses for Open Humanitarian Map" },
  ];
}

type BoundarySource = {
  location: string;
  source: string;
  contributor: string;
};

function parseBoundarySources(raw: string): BoundarySource[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sources: BoundarySource[] = [];

  for (let index = 0; index < lines.length; index += 6) {
    const locationLabel = lines[index];
    const location = lines[index + 1];
    const sourceLabel = lines[index + 2];
    const source = lines[index + 3];
    const contributorLabel = lines[index + 4];
    const contributor = lines[index + 5];

    if (
      locationLabel !== "Location" ||
      sourceLabel !== "Source" ||
      contributorLabel !== "Contributor" ||
      !location ||
      !source ||
      !contributor
    ) {
      continue;
    }

    sources.push({ location, source, contributor });
  }

  return sources;
}

const boundarySources = parseBoundarySources(boundarySourcesRaw);

function SourcesContent() {
  const { t } = useI18n();

  return (
    <InfoPage title={t("info.sourcesTitle")}>
      <p>{t("info.sourcesIntro")}</p>
      <p>{t("info.sourceOsm")}</p>
      <p>{t("info.sourceIpc")}</p>
      <p>{t("info.sourceBoundaries")}</p>
      <p>{t("demo.population2020Note")}</p>

      <section className="pt-4">
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">Sources des limites administratives</h2>
          <p className="mt-2 text-sm leading-6 text-[#9fb2c2]">
            Détail par pays des sources et contributeurs utilisés pour les boundaries OHM.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {boundarySources.map((item) => (
            <article
              key={item.location}
              className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.16)]"
            >
              <h3 className="text-lg font-black text-[#f6efe6]">{item.location}</h3>
              <dl className="mt-3 space-y-3 text-sm leading-6">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#85b8e5]">
                    Source
                  </dt>
                  <dd className="mt-1 text-[#d7e4ee]">{item.source}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#85b8e5]">
                    Contributeur
                  </dt>
                  <dd className="mt-1 text-[#b9c9d6]">{item.contributor}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
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
