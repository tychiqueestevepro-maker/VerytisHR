import crypto from "node:crypto";

/**
 * LinkedIn Credential Encryption Service
 * Uses AES-256-CBC for secure storage of LinkedIn passwords.
 */

const ALGORITHM = "aes-256-cbc";
// We use a dedicated key for LinkedIn encryption. 
// If not provided, we fallback to a derived key from HR_EXTENSION_TOKEN_SECRET for development.
const SECRET = process.env.LINKEDIN_ENCRYPTION_KEY || process.env.HR_EXTENSION_TOKEN_SECRET || "default_vhr_secure_key_32_chars_long!!";

// Ensure key is exactly 32 bytes for AES-256
const KEY = crypto.createHash("sha256").update(SECRET).digest();
const IV_LENGTH = 16;

/**
 * Encrypts a string (e.g. LinkedIn password)
 * Returns IV and encrypted data joined by a colon.
 */
export function encryptLinkedInCredential(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a string (e.g. LinkedIn password)
 */
export function decryptLinkedInCredential(encryptedText: string): string {
  try {
    const [ivHex, dataHex] = encryptedText.split(":");
    if (!ivHex || !dataHex) throw new Error("Invalid format");

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("[Crypto] Decryption failed:", error);
    throw new Error("Failed to decrypt credential");
  }
}
