import { getAdminBlockers } from "@/lib/actions/admin";
import { BlockersClient } from "./BlockersClient";

export default async function AdminBlockersPage() {
  const blockers = await getAdminBlockers();
  return <BlockersClient blockers={blockers} />;
}
