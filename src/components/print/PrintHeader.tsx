import { CLINIC_PROFILE } from "@/lib/clinic-profile";

export function PrintHeader({ locale, title, number }: { locale: string; title: string; number: string }) {
  const ar = locale === "ar";
  return (
    <header className="flex items-start justify-between border-b-2 border-[var(--color-navy)] pb-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset in a print-only page */}
        <img src="/aura-logo.png" alt="AURA" className="h-14 w-auto" />
        <div>
          <p className="text-base font-bold text-[var(--color-navy)]">{ar ? CLINIC_PROFILE.nameAr : CLINIC_PROFILE.nameEn}</p>
          <p className="text-xs text-gray-500">{CLINIC_PROFILE.taglineEn}</p>
          <p className="text-xs text-gray-500">
            {ar ? CLINIC_PROFILE.addressAr : CLINIC_PROFILE.addressEn} · <span dir="ltr">{CLINIC_PROFILE.phone}</span>
          </p>
        </div>
      </div>
      <div className="text-end">
        <p className="text-lg font-bold text-[var(--color-navy)]">{title}</p>
        <p className="font-mono text-sm text-gray-500">{number}</p>
      </div>
    </header>
  );
}
