import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "./config.js";
export interface Storage {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<any>;
  remove(key: string): Promise<void>;
}
function file(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return path.join(config.data, "files", key);
}
const local: Storage = {
  async put(key, b) {
    await fs.mkdir(path.dirname(file(key)), { recursive: true });
    await fs.writeFile(file(key), b, { flag: "wx", mode: 0o600 });
  },
  async get(key) {
    await fs.access(file(key));
    return createReadStream(file(key));
  },
  async remove(key) {
    await fs.rm(file(key), { force: true });
  },
};
function s3(): Storage {
  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
  const Bucket = process.env.S3_BUCKET;
  if (!Bucket) throw new Error("Missing S3_BUCKET");
  return {
    async put(Key, Body) {
      file(Key);
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body,
          ContentType: "application/octet-stream",
        }),
      );
    },
    async get(Key) {
      file(Key);
      return (await client.send(new GetObjectCommand({ Bucket, Key }))).Body;
    },
    async remove(Key) {
      file(Key);
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
}
export const storage: Storage =
  process.env.STORAGE_DRIVER === "s3" ? s3() : local;
