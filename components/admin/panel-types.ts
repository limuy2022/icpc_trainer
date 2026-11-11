import type { AdminModelForm, AdminModelRow, AdminStatus, AdminUserRow } from "@/lib/api-types";

/** Shared mutation helper signature for admin sections. */
export type AdminMutation = (
  path: string,
  body: unknown,
  method: string,
) => Promise<boolean>;
export type {
  AdminModelForm,
  AdminModelRow,
  AdminStatus,
  AdminUserRow,
};
