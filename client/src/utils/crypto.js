// client/src/utils/crypto.js

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

// 2. Encrypt a message using the RECEIVER'S public key
export const encryptMessage = async (messageText, receiverPublicKeyJwk) => {
    try {
        const publicKey = await window.crypto.subtle.importKey(
            "jwk", 
            receiverPublicKeyJwk, 
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
        console.error("Encryption failed:", err);
        // --- MERGE UPDATE: Strict Security ---
        // NEVER fallback to plaintext. If encryption fails, throw an error 
        // so the frontend can catch it and alert the user instead of leaking data.
        throw new Error("Encryption failed. Cannot send message securely.");
    }
};

// 3. Decrypt a message using YOUR private key
export const decryptMessage = async (base64Ciphertext, myPrivateKeyJwk) => {
    try {
        const privateKey = await window.crypto.subtle.importKey(
            "jwk", 
            myPrivateKeyJwk, 
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
        console.error("Decryption failed (might be a plaintext message or wrong key):", err);
        // --- MERGE UPDATE: Graceful degradation for legacy messages ---
        // It's acceptable to return the original string ONLY on decryption, 
        // as it might be an older message sent before E2EE was implemented.
        return base64Ciphertext; 
    }
};

// ====================================================
// GROUP CHAT ENCRYPTION (HYMMETRIC AES-GCM + RSA)
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
        const key = await window.crypto.subtle.importKey(
            "jwk",
            aesKeyJwk,
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
        console.error("Group AES Encryption failed:", err);
        throw new Error("Group encryption failed. Cannot send message securely.");
    }
};

// 6. Decrypt a group message using the shared AES Group Key
export const decryptGroupMessage = async (base64Ciphertext, aesKeyJwk) => {
    try {
        const key = await window.crypto.subtle.importKey(
            "jwk",
            aesKeyJwk,
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
        console.error("Group AES Decryption failed:", err);
        return base64Ciphertext; // Fallback for unencrypted legacy group messages
    }
};