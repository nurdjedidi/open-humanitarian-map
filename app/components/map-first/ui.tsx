import type { ReactNode } from "react";
import { X } from "lucide-react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function FloatingPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-[24px] border border-white/10 bg-[#0a1420]/92 shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/8 bg-white/[0.035] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#85b8e5]">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
      <span className="text-sm text-[#e7eef5]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function MobileSheet({
  open,
  title,
  onClose,
  children,
  withBackdrop = true,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  withBackdrop?: boolean;
}) {
  return (
    <>
      <div
        className={cx(
          "fixed inset-0 z-40 bg-[#02060bcc] backdrop-blur-sm transition md:hidden",
          withBackdrop
            ? open
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-white/10 bg-[#08131e]/98 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-20px_80px_rgba(2,6,12,0.45)] transition-transform md:hidden",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#85b8e5]">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-[#e6edf4]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="panel-scroll max-h-[68vh] overflow-y-auto pb-2">{children}</div>
      </div>
    </>
  );
}
