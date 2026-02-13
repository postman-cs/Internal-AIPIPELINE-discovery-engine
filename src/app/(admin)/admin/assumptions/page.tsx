import { getAdminAssumptions } from "@/lib/actions/admin";
import { AssumptionsClient } from "./AssumptionsClient";

export default async function AdminAssumptionsPage() {
  const assumptions = await getAdminAssumptions();
  return <AssumptionsClient assumptions={assumptions} />;
}
