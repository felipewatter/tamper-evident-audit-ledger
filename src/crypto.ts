import crypto from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateEd25519KeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  };
}

export function signEd25519(hashHex: string, privateKeyPem: string): string {
  const sig = crypto.sign(null, Buffer.from(hashHex, "hex"), privateKeyPem);
  return sig.toString("base64");
}

export function verifyEd25519(hashHex: string, signatureB64: string, publicKeyPem: string): boolean {
  return crypto.verify(null, Buffer.from(hashHex, "hex"), publicKeyPem, Buffer.from(signatureB64, "base64"));
}

/**
 * Computes a short key identifier (non-secret) derived from the public key PEM.
 * Useful when rotating keys.
 */
export function keyIdFromPublicKey(publicKeyPem: string): string {
  const fp = sha256Hex(publicKeyPem);
  return `ed25519:${fp.slice(0, 16)}`;
}
