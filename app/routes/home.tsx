import type { Route } from "./+types/home";

import { MapFirstPage } from "~/components/map-first-page";
import { RuntimeSeo } from "~/components/runtime-seo";
import { appConfig } from "~/content";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OHM – Open Humanitarian Map" },
    {
      name: "description",
      content: "Open Humanitarian Map",
    },
    { tagName: "link", rel: "canonical", href: appConfig.canonicalUrl },
    { property: "og:type", content: "website" },
    { property: "og:url", content: appConfig.canonicalUrl },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export default function Home() {
  return (
    <>
      <RuntimeSeo titleKey="seo.homeTitle" descriptionKey="seo.homeDescription" />
      <MapFirstPage />
    </>
  );
}
