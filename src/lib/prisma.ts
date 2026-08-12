import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { resolveDatabaseUrl } from "@/lib/database-url";

const databaseUrl = resolveDatabaseUrl(env.databaseUrl);

const prismaClientSingleton = () =>
  new PrismaClient(
    databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl },
          },
        }
      : undefined,
  );

declare global {
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

globalThis.prismaGlobal = prisma;
