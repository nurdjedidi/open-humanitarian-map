import { useEffect } from "react";

import { useI18n } from "~/i18n/use-i18n";

type RuntimeSeoProps = {
  titleKey: string;
  descriptionKey: string;
};

export function RuntimeSeo({ titleKey, descriptionKey }: RuntimeSeoProps) {
  const { t, locale } = useI18n();

  useEffect(() => {
    document.title = t(titleKey);

    let descriptionTag = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;

    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.name = "description";
      document.head.appendChild(descriptionTag);
    }

    descriptionTag.content = t(descriptionKey);
    document.documentElement.lang = locale;
  }, [descriptionKey, locale, t, titleKey]);

  return null;
}
