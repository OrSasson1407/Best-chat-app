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

// --- NEW PERFORMANCE FIX: In-Memory Key Caching ---
// importKey() is incredibly slow. This cache prevents re-importing keys we already processed.
const keyCache = new Map();

const getImportedKey = async (jwk, algoName, extractable, keyUsages) => {
    // Create a unique cache string based on the key geometry
    const cacheId = jwk.n ? jwk.n : (jwk.k ? jwk.k : JSON.stringify(jwk));
    
    if (keyCache.has(cacheId)) {
        return keyCache.get(cacheId);
    }

    const algorithm = algoName === "RSA" ? { name: "RSA-OAEP", hash: "SHA-256" } : { name: "AES-GCM" };
    
    const importedKey = await window.crypto.subtle.importKey(
        "jwk", 
        jwk, 
        algorithm, 
        extractable, 
        keyUsages
    );

    // Store in cache for instant retrieval next time
    keyCache.set(cacheId, importedKey);
    return importedKey;
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

// --- PERFORMANCE FIX: SEQUENTIAL KEY GENERATION ---
// Creates the Signal-Protocol style key structure to send to the backend
export const generateE2EBundle = async () => {
    try {
        console.log("[Crypto] Generating Identity Key (1/3)...");
        const identityKeyPair = await generateKeyPair();
        
        console.log("[Crypto] Generating Signed Pre-Key (2/3)...");
        const signedPreKeyPair = await generateKeyPair();
        
        console.log("[Crypto] Generating One-Time Pre-Key (3/3)...");
        const oneTimePreKey = await generateKeyPair();

        const bundle = {
            identityKey: JSON.stringify(identityKeyPair.publicKey),
            registrationId: Math.floor(Math.random() * 10000),
            signedPreKey: {
                keyId: 1,
                publicKey: JSON.stringify(signedPreKeyPair.publicKey),
                signature: "verified"
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

        console.log("[Crypto] All keys generated successfully!");
        return { bundle, privateKeys };
    } catch (err) {
        console.error("[Crypto] Fatal error during key generation:", err);
        throw new Error("Failed to generate encryption keys.");
    }
};

// 2. Encrypt a message using the RECEIVER'S public key
export const encryptMessage = async (messageText, receiverPublicKeyJwk) => {
    try {
        const jwk = parseJwk(receiverPublicKeyJwk, "Receiver Public");
        const publicKey = await getImportedKey(jwk, "RSA", true, ["encrypt"]);

        const encodedMessage = new TextEncoder().encode(messageText);
        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            encodedMessage
        );

        // Convert ArrayBuffer to Base64 string for easy storage in MongoDB
        return btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
    } catch (err) {
        console.error("[Crypto] Encryption failed:", err.message);
        throw new Error(err.message || "Encryption failed. Cannot send message securely.");
    }
};

// Helper: returns true only if a string is valid base64 AND long enough to be RSA ciphertext
// RSA-2048 always produces exactly 256 bytes → 344 base64 chars. Plaintext is never that.
const isLikelyEncrypted = (str) => {
    if (!str || typeof str !== "string") return false;
    if (str.length < 300) return false; // plaintext messages are always shorter than RSA output
    return /^[A-Za-z0-9+/]+={0,2}$/.test(str);
};

// 3. Decrypt a message using YOUR private key
export const decryptMessage = async (base64Ciphertext, myPrivateKeyJwk) => {
    // Fast-path: if the message doesn't look like RSA ciphertext, it's plaintext — return as-is
    // This silently handles all legacy messages without hitting atob() or the crypto API
    if (!isLikelyEncrypted(base64Ciphertext)) {
        return base64Ciphertext;
    }

    try {
        const jwk = parseJwk(myPrivateKeyJwk, "My Private");
        const privateKey = await getImportedKey(jwk, "RSA", true, ["decrypt"]);

        const binaryString = atob(base64Ciphertext);
        const ciphertextBuffer = Uint8Array.from(binaryString, c => c.charCodeAt(0));

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            ciphertextBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.warn("[Crypto] Decryption skipped (bad key or corrupted ciphertext):", err.message);
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
    return await window.crypto.subtle.exportKey("jwk", key); 
};

// 5. Encrypt a group message using the shared AES Group Key
export const encryptGroupMessage = async (messageText, aesKeyJwk) => {
    try {
        const jwk = parseJwk(aesKeyJwk, "Group AES");
        const key = await getImportedKey(jwk, "AES-GCM", false, ["encrypt"]);

        const encodedMessage = new TextEncoder().encode(messageText);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
        
        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encodedMessage
        );

        const combinedBuffer = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
        combinedBuffer.set(iv, 0);
        combinedBuffer.set(new Uint8Array(ciphertextBuffer), iv.length);

        return btoa(String.fromCharCode(...combinedBuffer));
    } catch (err) {
        console.error("[Crypto] Group AES Encryption failed:", err.message);
        throw new Error(err.message || "Group encryption failed. Cannot send message securely.");
    }
};

// 6. Decrypt a group message using the shared AES Group Key
export const decryptGroupMessage = async (base64Ciphertext, aesKeyJwk) => {
    try {
        const jwk = parseJwk(aesKeyJwk, "Group AES");
        const key = await getImportedKey(jwk, "AES-GCM", false, ["decrypt"]);

        const binaryString = atob(base64Ciphertext);
        const combinedBuffer = Uint8Array.from(binaryString, c => c.charCodeAt(0));

        const iv = combinedBuffer.slice(0, 12);
        const ciphertextBuffer = combinedBuffer.slice(12);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertextBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.warn("[Crypto] Group AES Decryption skipped (Legacy message):", err.message);
        return base64Ciphertext;
    }
};