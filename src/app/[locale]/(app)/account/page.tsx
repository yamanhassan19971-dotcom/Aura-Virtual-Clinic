import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export default async function AccountPage() {
  const session = await auth();
  const t = await getTranslations("account");
  const tStaff = await getTranslations("staff");
  const tRoles = await getTranslations("roles");
  const user = session!.user;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-4 py-4 md:px-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
      </div>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <section className="max-w-md rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("details")}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">{tStaff("name")}</dt>
            <dd>{user.name}</dd>
            <dt className="text-gray-500">{tStaff("login")}</dt>
            <dd dir="ltr" className="text-start">
              {user.email}
            </dd>
            <dt className="text-gray-500">{tStaff("role")}</dt>
            <dd>{tRoles(user.role)}</dd>
          </dl>
        </section>
        <section className="max-w-md rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("changePassword")}</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
