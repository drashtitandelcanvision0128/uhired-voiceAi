import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.contentPage.findMany({
    where: { type: "JOB", isPublished: true },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      excerpt: true,
      body: true,
      location: true,
      employmentType: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
