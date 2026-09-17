// AvatarStorage.js
// Handles persistent offline local storage for user-imported VRM avatars using IndexedDB.
// Persists binary ArrayBuffers safely across app restarts, reboots, and updates.

const DB_NAME = 'VRMVideoCallDB';
const DB_VERSION = 1;
const STORE_NAME = 'avatars';
const ACTIVE_AVATAR_KEY = 'active_avatar';

function openDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            return reject(new Error('IndexedDB is not supported on this device.'));
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open persistent storage'));
    });
}

/**
 * Save an avatar File into persistent storage
 * @param {File} file
 * @returns {Promise<{name: string, size: number, lastModified: number, data: ArrayBuffer}>}
 */
export async function saveAvatar(file) {
    if (!file) {
        throw new Error('No file selected.');
    }
    
    const fileName = file.name || 'avatar.vrm';
    if (!fileName.toLowerCase().endsWith('.vrm')) {
        throw new Error('Selected file is not a .vrm file. Please choose a valid VRM avatar.');
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Selected file is empty (0 bytes).');
    }

    // Basic glTF / VRM binary header check (0x46546C67 'glTF' in little-endian)
    if (arrayBuffer.byteLength < 12) {
        throw new Error('Selected file is too small to be a valid VRM avatar.');
    }
    const view = new DataView(arrayBuffer);
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) {
        throw new Error('Selected file does not appear to be a valid binary glTF/VRM file.');
    }

    const record = {
        name: fileName,
        size: arrayBuffer.byteLength,
        lastModified: file.lastModified || Date.now(),
        data: arrayBuffer,
        savedAt: Date.now()
    };

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(record, ACTIVE_AVATAR_KEY);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error || new Error('Failed to write avatar to persistent storage.'));
    });
}

/**
 * Retrieve the active avatar record from persistent storage
 * @returns {Promise<{name: string, size: number, data: ArrayBuffer} | null>}
 */
export async function loadStoredAvatar() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(ACTIVE_AVATAR_KEY);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Failed to read from persistent storage.'));
        });
    } catch (err) {
        console.error('Storage error:', err);
        return null;
    }
}

/**
 * Delete stored avatar
 */
export async function deleteStoredAvatar() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(ACTIVE_AVATAR_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error('Failed to delete avatar from storage.'));
    });
}
