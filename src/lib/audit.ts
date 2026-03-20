import { prisma } from "@/lib/prisma";
import { AuditAction, Prisma } from "@prisma/client";

export async function logAudit(params: {
  userId: string;
  action: AuditAction;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType,
      metadataJson: params.metadata
        ? (params.metadata as Prisma.InputJsonValue)
        : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}
