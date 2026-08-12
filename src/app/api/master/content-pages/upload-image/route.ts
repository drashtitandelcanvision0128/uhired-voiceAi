import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { uploadCmsImage } from "@/lib/cms-image-storage";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadCmsImage(buffer, mimeType);

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
