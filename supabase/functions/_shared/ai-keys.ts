function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("AI_KEY_ENCRYPTION_KEY must contain at least 32 characters.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, usage);
}

export async function encryptTeacherKey(secret: string, teacherId: string, apiKey: string): Promise<{ ciphertext: string; nonce: string }> {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBytes, additionalData: new TextEncoder().encode(teacherId) },
    key,
    new TextEncoder().encode(apiKey),
  );
  return { ciphertext: toBase64(new Uint8Array(encrypted)), nonce: toBase64(nonceBytes) };
}

export async function decryptTeacherKey(secret: string, teacherId: string, ciphertext: string, nonce: string): Promise<string> {
  const key = await encryptionKey(secret, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(nonce), additionalData: new TextEncoder().encode(teacherId) },
    key,
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}
