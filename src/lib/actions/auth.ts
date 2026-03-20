"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loginSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function loginAction(_prev: unknown, formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user) {
    return { error: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.isAdmin = user.isAdmin || user.role === "ADMIRAL" || user.role === "ADMIN";
  session.role = user.role;
  await session.save();

  logAudit({
    userId: user.id,
    action: "LOGIN",
    metadata: { email: user.email },
  }).catch(() => {});

  redirect(user.role === "ADMIRAL" || user.role === "ADMIN" || user.isAdmin ? "/admiral" : "/dashboard");
}

export async function logoutAction() {
  const session = await getSession();
  const userId = session.userId;
  session.destroy();

  if (userId) {
    logAudit({ userId, action: "LOGOUT" }).catch(() => {});
  }

  redirect("/login");
}
