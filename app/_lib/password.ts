import crypto from "node:crypto";
import argon2 from "argon2";
import type { PasswordAlgo } from "@prisma/client";

export function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function verifyPassword(opts: {
  algo: PasswordAlgo;
  password: string;
  hash: string;
}) {
  if (opts.algo === "ARGON2ID") {
    return argon2.verify(opts.hash, opts.password);
  }
  // legacy
  return sha256(opts.password) === opts.hash;
}

export async function hashPasswordArgon2id(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}
