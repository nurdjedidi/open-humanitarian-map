import type { Route } from "./+types/home";

import { LandingPage } from "~/components/landing-page";
import { landingConfig } from "~/content";

export function meta({}: Route.MetaArgs) {
  return [
    { title: landingConfig.seo.title },
    { name: "description", content: landingConfig.seo.description },
    { tagName: "link", rel: "canonical", href: landingConfig.canonicalUrl },
    { property: "og:title", content: landingConfig.seo.ogTitle },
    { property: "og:description", content: landingConfig.seo.ogDescription },
    { property: "og:type", content: "website" },
    { property: "og:url", content: landingConfig.canonicalUrl },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: landingConfig.seo.ogTitle },
    { name: "twitter:description", content: landingConfig.seo.ogDescription },
  ];
}

export default function Home() {
  return <LandingPage />;
}
