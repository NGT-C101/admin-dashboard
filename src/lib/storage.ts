import "server-only";
// حفظ الملفات المرفوعة على السيرفر (فولدر uploads)
import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 ميجا

// بنحدد نوع الملف من محتواه نفسه (مش من اسمه) عشان محدش يرفع ملف خطير باسم مزيّف
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 4).toString("latin1") === "%PDF" },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

export function detectType(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

function safePath(key: string) {
  if (!/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/.test(key)) throw new Error("bad key");
  return path.join(DIR, key);
}

export async function saveFile(buf: Buffer, ext: string) {
  await mkdir(DIR, { recursive: true });
  const key = `${randomBytes(16).toString("hex")}.${ext}`;
  await writeFile(safePath(key), buf);
  return key;
}

export async function readStoredFile(key: string) {
  return readFile(safePath(key));
}

export async function deleteStoredFile(key: string) {
  await unlink(safePath(key)).catch(() => {});
}
