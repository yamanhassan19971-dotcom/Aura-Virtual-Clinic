import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatLongDate, formatTime } from "@/lib/time";
import { StatusBadge } from "@/components/diary/StatusBadge";
import type { getPatientOverview } from "@/lib/services/patient-queries";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      {children}
    </section>
  );
}

export async function OverviewPanel({
  overview,
  patientId,
  canViewClinical,
}: {
  overview: Awaited<ReturnType<typeof getPatientOverview>>;
  patientId: string;
  canViewClinical: boolean;
}) {
  const t = await getTranslations("patientOverview");
  const tMedical = await getTranslations("medical");
  const locale = await getLocale();
  const { nextAppointment, currentMedicalHistory, lastClinicalNote, recentNotes, recentDocuments, openTasks } =
    overview;

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
      <Card title={t("nextAppointment")}>
        {nextAppointment ? (
          <Link href={`/patients/${patientId}/appointments`} className="block hover:opacity-80">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {formatLongDate(nextAppointment.startTime, locale)}
            </p>
            <p className="text-sm text-gray-500">
              <bdi dir="ltr">{formatTime(nextAppointment.startTime, locale)}</bdi> ·{" "}
              {nextAppointment.practitioner.name} · {nextAppointment.appointmentType.name}
            </p>
            <div className="mt-1">
              <StatusBadge status={nextAppointment.status} size="sm" />
            </div>
          </Link>
        ) : (
          <p className="text-sm text-gray-400">{t("noUpcoming")}</p>
        )}
      </Card>

      {/* Receptionist has full demographic/administrative access but no
          clinical access — these cards simply aren't rendered for that
          role, not just visually hidden, since this is a server component. */}
      {canViewClinical && (
        <Card title={t("medical")}>
          {currentMedicalHistory ? (
            <Link href={`/patients/${patientId}/medical`} className="block hover:opacity-80">
              <p className="text-sm text-[var(--color-text)]">
                {t("currentHistory", { date: formatLongDate(currentMedicalHistory.completedAt, locale) })}
              </p>
              <p className="text-sm text-gray-500">
                {tMedical("completedBy", { name: currentMedicalHistory.completedBy?.name ?? "—" })}
              </p>
            </Link>
          ) : (
            <p className="text-sm text-gray-400">{t("noMedicalHistory")}</p>
          )}
        </Card>
      )}

      {canViewClinical && (
        <Card title={t("clinical")}>
          {lastClinicalNote ? (
            <Link href={`/patients/${patientId}/history`} className="block hover:opacity-80">
              <p className="text-sm text-[var(--color-text)]">
                {t("lastVisit", { date: formatLongDate(lastClinicalNote.createdAt, locale) })}
              </p>
              <p className="text-sm text-gray-500">{lastClinicalNote.practitioner.name}</p>
            </Link>
          ) : (
            <p className="text-sm text-gray-400">{t("noClinicalHistory")}</p>
          )}
        </Card>
      )}

      <Card title={t("outstanding")}>
        {openTasks.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noOutstanding")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {openTasks.map((task) => (
              <li key={task.id} className="text-sm text-[var(--color-text)]">
                • {task.title}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canViewClinical && (
        <Card title={t("recentHistory")}>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noClinicalHistory")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recentNotes.map((note) => (
                <li key={note.id} className="text-sm text-[var(--color-text)]">
                  <Link href={`/patients/${patientId}/history`} className="hover:underline">
                    {formatLongDate(note.createdAt, locale)} — {note.practitioner.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title={t("recentDocuments")}>
        {recentDocuments.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noOutstanding")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recentDocuments.map((doc) => (
              <li key={doc.id} className="text-sm text-[var(--color-text)]">
                <Link href={`/patients/${patientId}/documents`} className="hover:underline">
                  {doc.filename}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
