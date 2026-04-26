import { useI18n } from "~/i18n/use-i18n";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs font-semibold text-[#dce7f0]">
      {(["fr", "en"] as const).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={[
              "rounded-full px-3 py-1.5 transition",
              active
                ? "bg-[#f0c170] text-[#102031]"
                : "text-[#dce7f0] hover:bg-white/8",
            ].join(" ")}
            aria-pressed={active}
          >
            {code === "fr" ? t("common.languageFr") : t("common.languageEn")}
          </button>
        );
      })}
    </div>
  );
}
