const urlLabel = document.getElementById("currentUrl");
const editList = document.getElementById("editList");
const compatibilityWarning = document.getElementById("compatibilityWarning");

function isContextInvalidatedError(err) {
  const message = err?.message || String(err || "");
  return message.includes("Extension context invalidated");
}

function showCompatibilityWarning(message) {
  compatibilityWarning.textContent = message;
  compatibilityWarning.classList.add("visible");
}

function hideCompatibilityWarning() {
  compatibilityWarning.textContent = "";
  compatibilityWarning.classList.remove("visible");
}

function isProbablyUnsupportedUrl(rawUrl) {
  try {
    const protocol = new URL(rawUrl).protocol;
    return !["http:", "https:", "file:"].includes(protocol);
  } catch {
    return true;
  }
}

async function canReachContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "getPageSnapshot" });
    return true;
  } catch (err) {
    if (isContextInvalidatedError(err)) {
      throw err;
    }
    return false;
  }
}

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      urlLabel.textContent = "No active tab";
      return;
    }

    urlLabel.textContent = tab.url;
    hideCompatibilityWarning();

    if (isProbablyUnsupportedUrl(tab.url)) {
      showCompatibilityWarning("This page is restricted. Saving via DevTools usually works only on normal website pages (http/https/file).");
    } else {
      const reachable = await canReachContentScript(tab.id);
      if (!reachable) {
        showCompatibilityWarning("This tab does not allow extension scripts. Saving edits from DevTools will fail on this page.");
      }
    }

    const { edits } = await chrome.runtime.sendMessage({ action: "getEdits", url: tab.url });

    if (!edits || edits.length === 0) {
      editList.innerHTML = '<div class="empty">No saved edits for this page.</div>';
      return;
    }

    editList.innerHTML = "";

    edits.forEach(edit => {
      const item = document.createElement("div");
      item.className = "edit-item";

      const info = document.createElement("div");
      info.style.flex = "1";

      const sel = document.createElement("div");
      sel.className = "edit-selector";
      sel.textContent = edit.selector + (edit.selectorIndex ? ` [${edit.selectorIndex}]` : "");

      const type = document.createElement("span");
      type.className = "edit-type";
      type.textContent = edit.type;

      info.appendChild(sel);
      info.appendChild(type);

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.title = "Delete this edit";
      del.textContent = "✕";
      del.addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ action: "deleteEdit", url: tab.url, editId: edit.id });
        item.remove();
        if (editList.children.length === 0) {
          editList.innerHTML = '<div class="empty">No saved edits for this page.</div>';
        }
      });

      item.appendChild(info);
      item.appendChild(del);
      editList.appendChild(item);
    });

    const clearBtn = document.createElement("button");
    clearBtn.className = "clear-btn";
    clearBtn.textContent = "🗑 Clear all edits for this page";
    clearBtn.addEventListener("click", async () => {
      if (!confirm("Delete all saved edits for this page?")) return;
      await chrome.runtime.sendMessage({ action: "clearEdits", url: tab.url });
      editList.innerHTML = '<div class="empty">No saved edits for this page.</div>';
      clearBtn.remove();
      // Also clear baseline
      await chrome.storage.local.remove(`original_${tab.url}`);
    });
    editList.appendChild(clearBtn);
  } catch (err) {
    if (isContextInvalidatedError(err)) {
      urlLabel.textContent = "Extension was reloaded";
      showCompatibilityWarning("Extension context invalidated. Close and reopen this popup (or reopen DevTools panel) and try again.");
      editList.innerHTML = '<div class="empty">Please reopen the extension UI.</div>';
      return;
    }

    console.error(err);
    showCompatibilityWarning("Could not load page state. Try reopening this popup.");
  }
}

init();
