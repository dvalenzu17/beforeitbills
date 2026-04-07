import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function loadKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  try {
    const hex = Buffer.from(raw, 'hex');
    if (hex.length === 32) return hex;
  } catch {}
  throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (base64 or hex encoded)');
}

const KEY = loadKey();

/**
 * Encrypt a plaintext string.
 * Output format: "<iv_hex>:<tag_hex>:<data_hex>"
 */
export function encryptCredential(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored credential.
 *
 * Handles two formats for backward compatibility:
 *   new  — "hex:hex:hex"          (written by this service)
 *   old  — "v1.b64.b64.b64"      (written by the original Express backend)
 *
 * Any token stored by the old backend will still decrypt correctly during the
 * transition window. Once all tokens have been re-issued through the new flow
 * the legacy branch can be removed.
 */
export function decryptCredential(stored) {
  if (!stored) return null;
  const s = String(stored);

  // ── Legacy format: v1.<iv_b64>.<tag_b64>.<data_b64> ──────────────────────
  if (s.startsWith('v1.')) {
    const parts = s.split('.');
    if (parts.length !== 4) throw new Error('invalid_encrypted_format');
    const iv  = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  // ── Current format: <iv_hex>:<tag_hex>:<data_hex> ────────────────────────
  const parts = s.split(':');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('invalid_encrypted_format');
  }
  const iv  = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const data = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
