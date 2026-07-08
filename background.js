// Listen for tab updates to re-apply edits after navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Content script handles this automatically via document_idle
    // Background just wakes up to keep service worker alive if needed
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "saveEdit") {
    saveEdit(msg.url, msg.edit).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.action === "getEdits") {
    getEdits(msg.url).then(edits => sendResponse({ edits }));
    return true;
  }
  if (msg.action === "deleteEdit") {
    deleteEdit(msg.url, msg.editId).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.action === "clearEdits") {
    clearEdits(msg.url).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function saveEdit(url, edit) {
  const key = `edits_${url}`;
  const result = await chrome.storage.local.get(key);
  const edits = result[key] || [];
  // Replace existing edit for same selector+type, or append
  const idx = edits.findIndex(e => e.id === edit.id);
  if (idx >= 0) {
    edits[idx] = edit;
  } else {
    edits.push(edit);
  }
  await chrome.storage.local.set({ [key]: edits });
}

async function getEdits(url) {
  const key = `edits_${url}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || [];
}

async function deleteEdit(url, editId) {
  const key = `edits_${url}`;
  const result = await chrome.storage.local.get(key);
  const edits = (result[key] || []).filter(e => e.id !== editId);
  await chrome.storage.local.set({ [key]: edits });
}

async function clearEdits(url) {
  const key = `edits_${url}`;
  await chrome.storage.local.remove(key);
}
