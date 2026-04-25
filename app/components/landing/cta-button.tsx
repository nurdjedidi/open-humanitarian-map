import type { PropsWithChildren } from "react";

type CtaButtonProps = PropsWithChildren<{
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  external?: boolean;
}>;

export function CtaButton({
  href,
  variant = "primary",
  external = false,
  children,
}: CtaButtonProps) {
  const className = [
    "lp-button",
    variant === "primary"
      ? "lp-button-primary"
      : variant === "secondary"
        ? "lp-button-secondary"
        : "lp-button-ghost",
  ].join(" ");

  return (
    <a
      className={className}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {children}
    </a>
  );
}
