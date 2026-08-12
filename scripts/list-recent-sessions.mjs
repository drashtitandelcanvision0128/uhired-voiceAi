import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
const prisma = new PrismaClient();

const rows = await prisma.interviewSession.findMany({
  where: { status: "COMPLETED" },
  orderBy: { endedAt: "desc" },
  take: 8,
  include: {
    scorecard: { select: { scoringMode: true, accuracyPercent: true, questionResults: true } },
  },
});

for (const s of rows) {
  const qr = s.scorecard?.questionResults;
  const n = Array.isArray(qr) ? qr.length : 0;
  console.log(s.id, s.endedAt?.toISOString(), s.scorecard?.scoringMode, "acc", s.scorecard?.accuracyPercent, "qr", n);
}

await prisma.$disconnect();
