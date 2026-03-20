"use server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function getNotifications(limit = 20) {
  const session = await requireAuth();
  return prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markAllRead() {
  const session = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true },
  });
}

export async function markRead(id: string) {
  const session = await requireAuth();
  await prisma.notification.update({
    where: { id, userId: session.userId },
    data: { read: true },
  });
}

export async function createNotification(userId: string, type: string, title: string, body?: string, linkUrl?: string) {
  return prisma.notification.create({
    data: { userId, type, title, body, linkUrl },
  });
}

export async function getUnreadCount() {
  const session = await requireAuth();
  return prisma.notification.count({
    where: { userId: session.userId, read: false },
  });
}
