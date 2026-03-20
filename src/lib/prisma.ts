import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> };

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        return (async () => {
          const start = Date.now();
          const result = await query(args);
          const duration = Date.now() - start;
          if (duration > 100) {
            console.warn(`[prisma-slow] ${model}.${operation} took ${duration}ms`);
          }
          return result;
        })();
      },
    },
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
