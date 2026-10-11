import { validateProject, type Project } from "./engine";
const DB = "proofwork-device-draft";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Device storage unavailable"));
    request.onblocked = () =>
      reject(new Error("Device storage is blocked by another tab"));
  });
}
async function transact(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", mode);
    const request = action(tx.objectStore("drafts"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Device save failed"));
    };
  });
}
export async function readDraft(): Promise<Project | null> {
  const data = await transact("readonly", (store) => store.get("current"));
  return data ? validateProject(data) : null;
}
export async function writeDraft(project: Project): Promise<void> {
  await transact("readwrite", (store) =>
    store.put(validateProject(project), "current"),
  );
}
export async function clearDraft(): Promise<void> {
  await transact("readwrite", (store) => store.delete("current"));
}
