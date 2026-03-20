import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Daily cron task: check for secrets approaching expiration.
 * Creates notifications for project owners when secrets expire within 14 days.
 */
export default async function secretsCheckRotation() {
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

  const expiring = await prisma.secretRotation.findMany({
    where: {
      expiresAt: { lte: fourteenDaysFromNow },
      status: { not: "rotated" },
    },
  });

  for (const secret of expiring) {
    const project = await prisma.project.findUnique({
      where: { id: secret.projectId },
      select: { ownerUserId: true, name: true },
    });

    if (!project || !project.ownerUserId) continue;

    await prisma.notification.upsert({
      where: {
        id: `secret-expiry-${secret.id}`,
      },
      create: {
        id: `secret-expiry-${secret.id}`,
        userId: project.ownerUserId,
        type: "secret_expiring",
        title: `Secret "${secret.secretType}" expiring soon`,
        body: `The ${secret.secretType} secret for project "${project.name}" expires ${secret.expiresAt?.toISOString().slice(0, 10) ?? "soon"}. Please rotate it.`,
        linkUrl: `/projects/${secret.projectId}`,
      },
      update: {
        title: `Secret "${secret.secretType}" expiring soon`,
        body: `The ${secret.secretType} secret for project "${project.name}" expires ${secret.expiresAt?.toISOString().slice(0, 10) ?? "soon"}. Please rotate it.`,
      },
    });

    if (secret.status !== "expiring_soon") {
      await prisma.secretRotation.update({
        where: { id: secret.id },
        data: { status: "expiring_soon" },
      });
    }
  }

  console.log(`[secrets.checkRotation] Checked ${expiring.length} expiring secret(s)`);
}
