import { getUsers } from "@/lib/actions/admin";
import { UsersClient } from "./UsersClient";

export default async function AdminUsersPage() {
  const users = await getUsers();
  return <UsersClient users={users} />;
}
