import crypto from 'crypto';

/**
 * WhatsApp Credential Service
 * 
 * Provides authenticated encryption-at-rest (AES-256-GCM) for provider credentials.
 * Ensures zero plaintext access tokens in database records, API responses, or logs.
 */
class WhatsAppCredentialService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyVersion = 1;
    this._initMasterKey();
  }

  _initMasterKey() {
    const secret = process.env.ENCRYPTION_MASTER_KEY || 'relay-credential-master-key-seed-phase9-test-only';
    // Derive 256-bit key using HKDF / PBKDF2
    this.masterKey = crypto.scryptSync(secret, 'relay-whatsapp-credentials-salt-v1', 32);
  }

  /**
   * Encrypts a sensitive credential payload.
   * 
   * @param {Object} data - Credential object (e.g. { accessToken, tokenExpiry, wabaId })
   * @returns {Object} Envelope with ciphertext, iv, authTag, and keyVersion
   */
  encryptCredential(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Credential data must be an object.');
    }

    const plaintext = JSON.stringify(data);
    const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag,
      keyVersion: this.keyVersion,
      encryptedAt: new Date().toISOString(),
    };
  }

  /**
   * Decrypts a credential envelope.
   * 
   * @param {Object} envelope - Envelope containing ciphertext, iv, authTag
   * @returns {Object} Decrypted data object
   */
  decryptCredential(envelope) {
    if (!envelope || !envelope.ciphertext || !envelope.iv || !envelope.authTag) {
      throw new Error('Invalid credential envelope: missing ciphertext, iv, or authTag.');
    }

    const iv = Buffer.from(envelope.iv, 'hex');
    const authTag = Buffer.from(envelope.authTag, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(envelope.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return JSON.parse(plaintext);
  }

  /**
   * Re-encrypts with new key material (key rotation).
   */
  rotateCredential(envelope, newMasterKeyHex) {
    const decrypted = this.decryptCredential(envelope);
    if (newMasterKeyHex) {
      this.masterKey = Buffer.from(newMasterKeyHex, 'hex');
      this.keyVersion += 1;
    }
    return this.encryptCredential(decrypted);
  }

  /**
   * Generates a safe audit log entry without exposing credentials.
   */
  sanitizeForAudit(credentialEnvelope) {
    if (!credentialEnvelope) return null;
    return {
      hasEncryptedData: Boolean(credentialEnvelope.ciphertext),
      keyVersion: credentialEnvelope.keyVersion,
      encryptedAt: credentialEnvelope.encryptedAt,
    };
  }
}

export default new WhatsAppCredentialService();
