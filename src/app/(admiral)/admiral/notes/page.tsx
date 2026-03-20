import { getAdmiralNotes } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { NotesClient } from "./NotesClient";

export default async function AdmiralNotesPage() {
  await requireAuth();

  const [notes, projects] = await Promise.all([
    getAdmiralNotes(),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return <NotesClient notes={notes} projects={projects} />;
}
