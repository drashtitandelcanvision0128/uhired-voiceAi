import { NextResponse } from "next/server";
import { readCmsImage } from "@/lib/cms-image-storage";

type Context = { params: Promise<{ fileName: string }> };

export async function GET(_request: Request, context: Context) {
  const { fileName } = await context.params;
  const image = await readCmsImage(fileName);

  if (!image) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(image.buffer, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
