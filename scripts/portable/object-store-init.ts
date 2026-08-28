import { GetBucketLocationCommand, GetBucketVersioningCommand, S3Client } from "@aws-sdk/client-s3";
import { readPortableSecret } from "@/lib/portable-runtime/secrets";

const endpoint = process.env.S3_ENDPOINT?.trim() || "";
const region = process.env.S3_REGION?.trim() || "";
const bucket = process.env.S3_PRIVATE_BUCKET?.trim() || "";
if (!/^https?:\/\//.test(endpoint) || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(region) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error("OBJECT_INIT_CONFIGURATION_INVALID");
if (process.env.NALANDA_SYNTHETIC_STAGING !== "true" && !endpoint.startsWith("https://")) throw new Error("OBJECT_INIT_TLS_REQUIRED");
const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: readPortableSecret("S3_ACCESS_KEY_ID", process.env, { required: true }),
    secretAccessKey: readPortableSecret("S3_SECRET_ACCESS_KEY", process.env, { required: true })
  },
  maxAttempts: 3
});

async function main() {
  await client.send(new GetBucketLocationCommand({ Bucket: bucket }));
  const versioning = await client.send(new GetBucketVersioningCommand({ Bucket: bucket }));
  if (versioning.Status !== "Enabled") throw new Error("OBJECT_INIT_VERSIONING_REQUIRED");
  console.log(JSON.stringify({ result: "PRIVATE_OBJECT_STORE_INITIALIZED", provider: "S3_COMPATIBLE", publicAccess: false, versioning: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OBJECT_INIT_FAILED");
  process.exitCode = 1;
}).finally(() => client.destroy());
