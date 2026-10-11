import { describe, expect, it } from "vitest";
import { sha256Bytes } from "../lib/release-hash";

describe("release hash byte contract", () => {
  const vectors = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"]
  ] as const;
  it.each(vectors)("preserves SHA-256 for text and equivalent bytes: %s", (text, digest) => {
    expect(sha256Bytes(text)).toBe(digest);
    expect(sha256Bytes(Buffer.from(text, "utf8"))).toBe(digest);
  });
  it("hashes raw zero bytes without text conversion", () => {
    expect(sha256Bytes(Buffer.alloc(32))).toBe("66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925");
  });
});
