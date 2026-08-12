import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET = "interview-videos",
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_ENDPOINT,
} = process.env;

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  required("SUPABASE_URL", SUPABASE_URL);
  required("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  required("AWS_REGION", AWS_REGION);
  required("AWS_S3_BUCKET", AWS_S3_BUCKET);
  required("AWS_ACCESS_KEY_ID", AWS_ACCESS_KEY_ID);
  required("AWS_SECRET_ACCESS_KEY", AWS_SECRET_ACCESS_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const s3 = new S3Client({
    region: AWS_REGION,
    endpoint: AWS_S3_ENDPOINT || undefined,
    forcePathStyle: AWS_S3_ENDPOINT ? true : undefined,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  let offset = 0;
  const pageSize = 100;
  let copied = 0;
  let skipped = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .list("", { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Supabase list failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const object of data) {
      const name = object.name;
      if (!name.endsWith(".webm") && !name.endsWith(".mp4") && !name.endsWith(".json")) {
        skipped += 1;
        continue;
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .download(name);
      if (downloadError || !blob) {
        console.warn(`skip ${name}: ${downloadError?.message ?? "download failed"}`);
        skipped += 1;
        continue;
      }

      const body = Buffer.from(await blob.arrayBuffer());
      const contentType = name.endsWith(".json")
        ? "application/json"
        : name.endsWith(".mp4")
          ? "video/mp4"
          : "video/webm";

      await s3.send(
        new PutObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: name,
          Body: body,
          ContentType: contentType,
        }),
      );
      copied += 1;
      console.log(`copied ${name}`);
    }

    offset += data.length;
  }

  console.log(`Done. copied=${copied} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
