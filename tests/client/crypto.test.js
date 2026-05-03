import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage, generateKeys } from '../../client/src/utils/crypto'; //[cite: 1]

describe('Client-Side Cryptography Utils', () => {
  const testMessage = "This is a top secret message for the group chat.";

  it('should encrypt and successfully decrypt a message symmetrically', async () => {
    // Generate a temporary key pair for the test
    const { publicKey, privateKey } = await generateKeys();
    
    // Encrypt the message using the public key
    const encryptedData = await encryptMessage(testMessage, publicKey);
    
    // Verify it was scrambled
    expect(encryptedData).not.toBe(testMessage);
    expect(typeof encryptedData).toBe('string'); // Usually Base64 or Hex

    // Decrypt using the private key
    const decryptedMessage = await decryptMessage(encryptedData, privateKey);
    
    // Verify data integrity
    expect(decryptedMessage).toBe(testMessage);
  });
});