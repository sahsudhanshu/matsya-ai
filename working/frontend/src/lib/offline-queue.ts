"use client";

/**
 * Offline Image Queue – IndexedDB-based queue for fish images captured at sea.
 * Stores images locally when offline, auto-flushes when connectivity returns.
 */

const DB_NAME = "matsyaai-offline";
const DB_VERSION = 1;
const STORE_NAME = "image-queue";

export interface QueuedImage {
    id: string;
    blob: Blob;
    filename: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
    status: "pending" | "uploading" | "done" | "error";
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** Save an image to the offline queue */
export async function queueImage(
    file: File | Blob,
    metadata?: Record<string, unknown>
): Promise<QueuedImage> {
    const db = await openDB();
    const item: QueuedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        blob: file,
        filename: file instanceof File ? file.name : `capture-${Date.now()}.jpg`,
        timestamp: Date.now(),
        metadata,
        status: "pending",
    };
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve(item);
        tx.onerror = () => reject(tx.error);
    });
}

/** Get all queued items */
export async function getQueuedItems(): Promise<QueuedImage[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** Get count of pending items */
export async function getPendingCount(): Promise<number> {
    const items = await getQueuedItems();
    return items.filter((i) => i.status === "pending").length;
}

/** Remove a processed item */
export async function removeQueuedItem(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Clear all items from the queue */
export async function clearQueue(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Attempt to flush all pending images to the server.
 * Call this when connectivity is restored.
 */
export async function flushQueue(
    uploadFn: (item: QueuedImage) => Promise<void>
): Promise<{ success: number; failed: number }> {
    const items = await getQueuedItems();
    const pending = items.filter((i) => i.status === "pending");
    let success = 0;
    let failed = 0;

    for (const item of pending) {
        try {
            await uploadFn(item);
            await removeQueuedItem(item.id);
            success++;
        } catch {
            failed++;
        }
    }

    return { success, failed };
}
