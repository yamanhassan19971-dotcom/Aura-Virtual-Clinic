import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientTasks } from "@/lib/services/patient-queries";
import { listUsers } from "@/lib/services/queries";
import { TasksPanel } from "@/components/patient/tasks/TasksPanel";

export default async function PatientTasksPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const practiceId = session!.user.practiceId;

  const [tasks, users] = await Promise.all([getPatientTasks(practiceId, patientId), listUsers(practiceId)]);

  return (
    <TasksPanel
      patientId={patientId}
      tasks={tasks}
      users={users}
      canManage={can(session!.user.role, "patients.manageTasks")}
    />
  );
}
