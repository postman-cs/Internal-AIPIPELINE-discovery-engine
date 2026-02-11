import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("pipeline123", 10);
  const user = await prisma.user.upsert({
    where: { email: "cse@postman.com" },
    update: {},
    create: {
      email: "cse@postman.com",
      name: "CSE Demo User",
      passwordHash,
    },
  });
  console.log(`User: ${user.email} (${user.id})`);

  const project1 = await prisma.project.upsert({
    where: { id: "seed-project-1" },
    update: {},
    create: {
      id: "seed-project-1",
      name: "Acme Corp",
      primaryDomain: "acme.com",
      apiDomain: "api.acme.com",
      publicWorkspaceUrl:
        "https://www.postman.com/acme/workspace/acme-public-api",
      ownerUserId: user.id,
    },
  });
  console.log(`Project: ${project1.name}`);

  const project2 = await prisma.project.upsert({
    where: { id: "seed-project-2" },
    update: {},
    create: {
      id: "seed-project-2",
      name: "TechStart Inc",
      primaryDomain: "techstart.io",
      ownerUserId: user.id,
    },
  });
  console.log(`Project: ${project2.name}`);

  console.log("Seed complete!");
  console.log("");
  console.log("To add evidence documents for AI pipeline testing,");
  console.log("use the Discovery page UI to ingest Kepler/DNS/manual data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
