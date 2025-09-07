// Simple encryption/decryption using Web Crypto API
class SimpleCrypto {
    constructor() {
        this.key = null;
    }

    async generateKey() {
        this.key = await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
        return this.key;
    }

    async encrypt(text) {
        if (!this.key) await this.generateKey();
        
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            this.key,
            data
        );

        // Combine iv and encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return btoa(String.fromCharCode(...combined));
    }

    async decrypt(encryptedData) {
        if (!this.key) await this.generateKey();
        
        const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            this.key,
            encrypted
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    async exportKey() {
        if (!this.key) await this.generateKey();
        return await window.crypto.subtle.exportKey("raw", this.key);
    }

    async importKey(keyData) {
        this.key = await window.crypto.subtle.importKey(
            "raw",
            keyData,
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
    }
}

// Simple hash function for generating IDs
async function generateId(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input + Date.now());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}