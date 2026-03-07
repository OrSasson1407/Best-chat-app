// client/src/utils/crypto.js

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
        return messageText; // Fallback to plaintext if encryption fails
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
        return base64Ciphertext; // If it fails, it might just be an older, unencrypted message
    }
};