import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.supportInquiry.findMany({ take: 1 });
  console.log("supportInquiry ok");

  await prisma.interviewSession.groupBy({ by: ["domain"], _count: { _all: true } });
  console.log("groupBy ok");

  const count = await prisma.interviewSession.count({
    where: {
      sessionType: "PRACTICE",
      promoCode: { not: null, notIn: ["PREVIEW"] },
    },
  });
  console.log("promo count ok", count);

  console.log("all sequential queries ok");
} catch (error) {
  console.error("ERROR:", error);
} finally {
  await prisma.$disconnect();
}
