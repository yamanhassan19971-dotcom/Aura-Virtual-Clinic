"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  AppointmentStatus,
  AppointmentType,
  Practitioner,
  Role,
  Room,
  WorkingHours,
} from "@prisma/client";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { can } from "@/lib/permissions";
import {
  changeStatusAction,
  cancelAppointmentAction,
  markFtaAction,
  updateAppointmentAction,
} from "@/lib/actions/appointment-actions";
import type { ConflictInfo } from "@/lib/actions/action-result";
import {
  DAY_START_MINUTE,
  combineDateAndMinutes,
  isSameDay,
  minutesSinceMidnight,
  pixelsPerMinute,
  snapMinutes,
  type TimeScale,
} from "@/lib/time";
import { STATUS_ORDER } from "@/components/diary/status-meta";
import { DiaryToolbar } from "@/components/diary/DiaryToolbar";
import { SummaryStrip } from "@/components/diary/SummaryStrip";
import { DiaryGrid } from "@/components/diary/DiaryGrid";
import { AppointmentDetailsPanel } from "@/components/appointment/AppointmentDetailsPanel";
import { CancelDialog } from "@/components/appointment/CancelDialog";
import { FtaDialog } from "@/components/appointment/FtaDialog";
import { WaitingRoomPanel } from "@/components/waiting-room/WaitingRoomPanel";
import { InSurgeryPanel } from "@/components/waiting-room/InSurgeryPanel";
import { BookingModal, type BookingDraft } from "@/components/booking/BookingModal";
import { ConflictDialog } from "@/components/booking/ConflictDialog";
import { useToast } from "@/components/ui/Toast";

type Props = {
  date: Date;
  appointments: AppointmentWithRelations[];
  practitioners: Practitioner[];
  rooms: Room[];
  appointmentTypes: AppointmentType[];
  workingHours: WorkingHours[];
  currentUser: { id: string; role: Role; practitionerId: string | null };
};

function summarize(appointments: AppointmentWithRelations[]) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<AppointmentStatus, number>;
  for (const a of appointments) counts[a.status]++;
  return counts;
}

type BookingState = { mode: "create"; draft: BookingDraft } | { mode: "edit"; appointment: AppointmentWithRelations };

export function DiaryWorkspace({
  date,
  appointments: initialAppointments,
  practitioners,
  rooms,
  appointmentTypes,
  workingHours,
  currentUser,
}: Props) {
  const t = useTranslations("booking");
  const toast = useToast();

  const [appointments, setAppointments] = useState(initialAppointments);
  const [selectedPractitionerIds, setSelectedPractitionerIds] = useState(practitioners.map((p) => p.id));
  const [timeScale, setTimeScale] = useState<TimeScale>(15);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithRelations | null>(null);
  const [ftaTarget, setFtaTarget] = useState<AppointmentWithRelations | null>(null);
  const [dragConflict, setDragConflict] = useState<{ conflict: ConflictInfo; retry: (reason: string) => void } | null>(
    null
  );
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const role = currentUser.role;
  const canCreate = can(role, "appointments.create");
  const canMove = can(role, "appointments.move");
  const canEdit = can(role, "appointments.edit");
  const canCancel = can(role, "appointments.cancel");
  const canFta = can(role, "appointments.fta");
  const canOverride = can(role, "appointments.overrideConflict");

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetMinute = isSameDay(date, new Date())
      ? minutesSinceMidnight(new Date())
      : (workingHours.find((w) => w.weekday === date.getDay())?.startMinute ?? DAY_START_MINUTE);
    const top = (targetMinute - DAY_START_MINUTE) * pixelsPerMinute(timeScale) - 80;
    el.scrollTop = Math.max(0, top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPractitioners = practitioners.filter((p) => selectedPractitionerIds.includes(p.id));
  const visibleAppointments = statusFilter ? appointments.filter((a) => a.status === statusFilter) : appointments;

  const appointmentsByPractitioner = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>();
    for (const p of filteredPractitioners) map.set(p.id, []);
    for (const a of visibleAppointments) {
      if (map.has(a.practitionerId)) map.get(a.practitionerId)!.push(a);
    }
    return map;
  }, [filteredPractitioners, visibleAppointments]);

  const counts = useMemo(() => summarize(appointments), [appointments]);
  const selectedAppointment = appointments.find((a) => a.id === selectedAppointmentId) ?? null;

  function openNewAppointment(practitionerId?: string, startMinute?: number) {
    const pid = practitionerId ?? filteredPractitioners[0]?.id ?? practitioners[0]?.id;
    if (!pid) return;
    const practitioner = practitioners.find((p) => p.id === pid);
    const minute = startMinute ?? snapMinutes(minutesSinceMidnight(new Date()), timeScale);
    setBookingState({
      mode: "create",
      draft: {
        practitionerId: pid,
        roomId: practitioner?.defaultRoomId ?? rooms[0]?.id ?? "",
        startTime: combineDateAndMinutes(date, minute),
      },
    });
  }

  function handleSlotClick(practitionerId: string, minute: number) {
    if (!canCreate) return;
    openNewAppointment(practitionerId, minute);
  }

  async function applyScheduleUpdate(
    appointmentId: string,
    patch: { practitionerId?: string; roomId?: string; startTime?: Date; durationMin?: number },
    overrideReason?: string
  ) {
    const existing = appointments.find((a) => a.id === appointmentId);
    if (!existing) return;

    const nextPractitioner = patch.practitionerId ? practitioners.find((p) => p.id === patch.practitionerId) : undefined;
    const nextRoom = patch.roomId ? rooms.find((r) => r.id === patch.roomId) : undefined;
    const nextStart = patch.startTime ?? existing.startTime;
    const nextDuration = patch.durationMin ?? existing.durationMin;
    const nextEnd = new Date(nextStart.getTime() + nextDuration * 60000);

    const optimistic: AppointmentWithRelations = {
      ...existing,
      ...patch,
      startTime: nextStart,
      endTime: nextEnd,
      durationMin: nextDuration,
      practitioner: nextPractitioner ?? existing.practitioner,
      room: nextRoom ?? existing.room,
    };

    setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? optimistic : a)));
    setDragConflict(null);

    const result = await updateAppointmentAction({
      appointmentId,
      ...patch,
      overrideConflict: overrideReason !== undefined,
      overrideReason,
    });

    if (result.ok) {
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? result.data : a)));
    } else if (result.kind === "CONFLICT" && result.conflict) {
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? existing : a)));
      setDragConflict({
        conflict: result.conflict,
        retry: (reason: string) => applyScheduleUpdate(appointmentId, patch, reason || "Override"),
      });
    } else {
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? existing : a)));
      toast.show(result.message, { tone: "error" });
    }
  }

  function handleMove(appointmentId: string, practitionerId: string, minutesDelta: number) {
    if (!canMove || minutesDelta === 0) return;
    const existing = appointments.find((a) => a.id === appointmentId);
    if (!existing) return;
    const newStart = new Date(existing.startTime.getTime() + minutesDelta * 60000);
    const practitionerChanged = practitionerId !== existing.practitionerId;
    const newPractitioner = practitioners.find((p) => p.id === practitionerId);
    const roomId =
      practitionerChanged && newPractitioner?.defaultRoomId ? newPractitioner.defaultRoomId : existing.roomId;
    applyScheduleUpdate(appointmentId, { practitionerId, roomId, startTime: newStart });
  }

  function handleResize(appointmentId: string, minutesDelta: number) {
    if (!canMove || minutesDelta === 0) return;
    const existing = appointments.find((a) => a.id === appointmentId);
    if (!existing) return;
    const newDuration = Math.max(timeScale, existing.durationMin + minutesDelta);
    applyScheduleUpdate(appointmentId, { durationMin: newDuration });
  }

  async function handleStatusChange(appointmentId: string, status: AppointmentStatus) {
    const existing = appointments.find((a) => a.id === appointmentId);
    if (!existing) return;
    setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, status } : a)));
    const result = await changeStatusAction({ appointmentId, status });
    if (result.ok) {
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? result.data : a)));
    } else {
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? existing : a)));
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleCancelConfirm(reason: string, notes: string) {
    if (!cancelTarget) return;
    setDialogSubmitting(true);
    const result = await cancelAppointmentAction({ appointmentId: cancelTarget.id, reason: reason as never, notes });
    setDialogSubmitting(false);
    if (result.ok) {
      setAppointments((prev) => prev.map((a) => (a.id === result.data.id ? result.data : a)));
      setCancelTarget(null);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleFtaConfirm(reason: string, notes: string) {
    if (!ftaTarget) return;
    setDialogSubmitting(true);
    const result = await markFtaAction({ appointmentId: ftaTarget.id, reason: reason as never, notes });
    setDialogSubmitting(false);
    if (result.ok) {
      setAppointments((prev) => prev.map((a) => (a.id === result.data.id ? result.data : a)));
      setFtaTarget(null);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  function handleJumpToNow() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const minute = minutesSinceMidnight(new Date());
    const top = (minute - DAY_START_MINUTE) * pixelsPerMinute(timeScale) - 100;
    el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  const allSelected = selectedPractitionerIds.length === practitioners.length;

  return (
    <div className="flex h-full flex-col">
      <DiaryToolbar
        date={date}
        practitioners={practitioners}
        selectedPractitionerIds={selectedPractitionerIds}
        onTogglePractitioner={(id) =>
          setSelectedPractitionerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onSelectAllPractitioners={() => setSelectedPractitionerIds(allSelected ? [] : practitioners.map((p) => p.id))}
        timeScale={timeScale}
        onTimeScaleChange={setTimeScale}
        onNewAppointment={() => canCreate && openNewAppointment()}
        onJumpToNow={handleJumpToNow}
      />
      <SummaryStrip counts={counts} total={appointments.length} activeFilter={statusFilter} onFilterChange={setStatusFilter} />

      <div className="flex min-h-0 flex-1">
        <DiaryGrid
          date={date}
          practitioners={filteredPractitioners}
          appointmentsByPractitioner={appointmentsByPractitioner}
          timeScale={timeScale}
          workingHours={workingHours}
          onOpenAppointment={setSelectedAppointmentId}
          onSlotClick={handleSlotClick}
          onMove={handleMove}
          onResize={handleResize}
          canEdit={canMove}
          scrollContainerRef={scrollContainerRef}
        />
        <aside className="hidden w-72 shrink-0 overflow-auto border-s border-[var(--color-border)] bg-white lg:block">
          {selectedAppointment ? (
            <AppointmentDetailsPanel
              appointment={selectedAppointment}
              canEdit={canEdit}
              canCancel={canCancel}
              canFta={canFta}
              onClose={() => setSelectedAppointmentId(null)}
              onStatusChange={(status) => handleStatusChange(selectedAppointment.id, status)}
              onOpenEdit={() => setBookingState({ mode: "edit", appointment: selectedAppointment })}
              onOpenCancel={() => setCancelTarget(selectedAppointment)}
              onOpenFta={() => setFtaTarget(selectedAppointment)}
            />
          ) : (
            <>
              <WaitingRoomPanel appointments={appointments.filter((a) => a.status === "ARRIVED")} onOpen={setSelectedAppointmentId} />
              <InSurgeryPanel appointments={appointments.filter((a) => a.status === "IN_SURGERY")} onOpen={setSelectedAppointmentId} />
            </>
          )}
        </aside>
      </div>

      {bookingState && (
        <BookingModal
          mode={bookingState.mode}
          draft={bookingState.mode === "create" ? bookingState.draft : undefined}
          appointment={bookingState.mode === "edit" ? bookingState.appointment : undefined}
          practitioners={practitioners}
          rooms={rooms}
          appointmentTypes={appointmentTypes}
          currentUserRole={role}
          onClose={() => setBookingState(null)}
          onCreated={(appt) => {
            setAppointments((prev) => [...prev, appt]);
            setBookingState(null);
            toast.show(t("createdToast"), { tone: "success" });
          }}
          onUpdated={(appt) => {
            setAppointments((prev) => prev.map((a) => (a.id === appt.id ? appt : a)));
            setBookingState(null);
            toast.show(t("updatedToast"), { tone: "success" });
          }}
        />
      )}

      {cancelTarget && (
        <CancelDialog
          appointment={cancelTarget}
          submitting={dialogSubmitting}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      )}
      {ftaTarget && (
        <FtaDialog
          appointment={ftaTarget}
          submitting={dialogSubmitting}
          onClose={() => setFtaTarget(null)}
          onConfirm={handleFtaConfirm}
        />
      )}
      {dragConflict && (
        <ConflictDialog
          conflict={dragConflict.conflict}
          canOverride={canOverride}
          submitting={false}
          onClose={() => setDragConflict(null)}
          onOverride={(reason) => dragConflict.retry(reason)}
        />
      )}
    </div>
  );
}
