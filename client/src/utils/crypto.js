// client/src/utils/crypto.js

// --- NEW HELPER: Safely parse keys to prevent crashing on legacy users ---
const parseJwk = (key, keyType = "Public") => {
    if (!key) throw new Error(`${keyType} key is missing. User might be using an older version of the app.`);
    if (typeof key === 'string') {
        if (key === "[object Object]") throw new Error(`${keyType} key was corrupted in DB. Please re-register this user.`);
        try { return JSON.parse(key); } 
        catch (e) { throw new Error(`Invalid JSON format for ${keyType} key.`); }
    }
    return key;
};

// ====================================================
// 1-ON-1 CHAT ENCRYPTION (ASYMMETRIC RSA)
// ====================================================

// 1. Generate an RSA Key Pair for the user
export const generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048, // Standard secure length
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    // Export keys to JSON Web Key (JWK) format so they can be saved/sent easily
    const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

    return { publicKey, privateKey };
};

// --- NEW: GENERATE THE FULL E2E BUNDLE ---
// Creates the Signal-Protocol style key structure to send to the backend
export const generateE2EBundle = async () => {
    // Generate the required keys for the bundle
    const identityKeyPair = await generateKeyPair();
    const signedPreKeyPair = await generateKeyPair();
    const oneTimePreKey = await generateKeyPair();

    const bundle = {
        identityKey: JSON.stringify(identityKeyPair.publicKey),
        registrationId: Math.floor(Math.random() * 10000),
        signedPreKey: {
            keyId: 1,
            publicKey: JSON.stringify(signedPreKeyPair.publicKey),
            signature: "verified" // Basic mock signature for WebCrypto RSA
        },
        preKeys: [
            { keyId: 1, publicKey: JSON.stringify(oneTimePreKey.publicKey) }
        ]
    };

    const privateKeys = {
        identityPrivateKey: identityKeyPair.privateKey,
        signedPrePrivateKey: signedPreKeyPair.privateKey,
        prePrivateKeys: [oneTimePreKey.privateKey]
    };

    return { bundle, privateKeys };
};

// 2. Encrypt a message using the RECEIVER'S public key
export const encryptMessage = async (messageText, receiverPublicKeyJwk) => {
    try {
        const jwk = parseJwk(receiverPublicKeyJwk, "Receiver Public");
        
        const publicKey = await window.crypto.subtle.importKey(
            "jwk", 
            jwk, 
            { name: "RSA-OAEP", hash: "SHA-256" }, 
            true, 
            ["encrypt"]
        );

        const encodedMessage = new TextEncoder().encode(messageText);
        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            encodedMessage
        );

        // Convert ArrayBuffer to Base64 string for easy storage in MongoDB
        return btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
    } catch (err) {
        console.error("Encryption failed:", err.message);
        // NEVER fallback to plaintext. If encryption fails, throw an error 
        // so the frontend can catch it and alert the user instead of leaking data.
        throw new Error(err.message || "Encryption failed. Cannot send message securely.");
    }
};

// 3. Decrypt a message using YOUR private key
export const decryptMessage = async (base64Ciphertext, myPrivateKeyJwk) => {
    try {
        const jwk = parseJwk(myPrivateKeyJwk, "My Private");

        const privateKey = await window.crypto.subtle.importKey(
            "jwk", 
            jwk, 
            { name: "RSA-OAEP", hash: "SHA-256" }, 
            true, 
            ["decrypt"]
        );

        // Convert Base64 back to ArrayBuffer
        const binaryString = atob(base64Ciphertext);
        const ciphertextBuffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            ciphertextBuffer[i] = binaryString.charCodeAt(i);
        }

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            ciphertextBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.warn("Decryption skipped (Legacy plaintext message or bad key):", err.message);
        // Graceful degradation for legacy messages
        // It's acceptable to return the original string ONLY on decryption, 
        // as it might be an older message sent before E2EE was implemented.
        return base64Ciphertext; 
    }
};

// ====================================================
// GROUP CHAT ENCRYPTION (SYMMETRIC AES-GCM + RSA)
// ====================================================

// 4. Generate a highly secure, random AES Key for a new Group
export const generateGroupAESKey = async () => {
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    // Export it to JWK so we can easily stringify and encrypt it with RSA later
    return await window.crypto.subtle.exportKey("jwk", key); 
};

// 5. Encrypt a group message using the shared AES Group Key
export const encryptGroupMessage = async (messageText, aesKeyJwk) => {
    try {
        const jwk = parseJwk(aesKeyJwk, "Group AES");

        const key = await window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        );

        const encodedMessage = new TextEncoder().encode(messageText);
        
        // AES-GCM requires a random Initialization Vector (IV) for every single message
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
        
        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encodedMessage
        );

        // We must store the IV WITH the ciphertext so the receiver can decrypt it.
        // We do this by prepending the 12-byte IV to the front of the ciphertext.
        const combinedBuffer = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
        combinedBuffer.set(iv, 0);
        combinedBuffer.set(new Uint8Array(ciphertextBuffer), iv.length);

        return btoa(String.fromCharCode(...combinedBuffer));
    } catch (err) {
        console.error("Group AES Encryption failed:", err.message);
        throw new Error(err.message || "Group encryption failed. Cannot send message securely.");
    }
};

// 6. Decrypt a group message using the shared AES Group Key
export const decryptGroupMessage = async (base64Ciphertext, aesKeyJwk) => {
    try {
        const jwk = parseJwk(aesKeyJwk, "Group AES");

        const key = await window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const binaryString = atob(base64Ciphertext);
        const combinedBuffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            combinedBuffer[i] = binaryString.charCodeAt(i);
        }

        // Slice the combined buffer to separate the 12-byte IV from the actual ciphertext
        const iv = combinedBuffer.slice(0, 12);
        const ciphertextBuffer = combinedBuffer.slice(12);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertextBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.warn("Group AES Decryption skipped (Legacy message):", err.message);
        return base64Ciphertext; // Fallback for unencrypted legacy group messages
    }
};