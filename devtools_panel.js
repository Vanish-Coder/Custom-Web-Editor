const saveBtn = document.getElementById("saveBtn");
const status = document.getElementById("status");

function isContextInvalidatedError(err) {
  const message = err?.message || String(err || "");
  return message.includes("Extension context invalidated");
}

function buildSnapshotFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const snapshot = [];

  doc.querySelectorAll("*").forEach(el => {
    const { selector, index } = buildSelectorWithIndexInDoc(el, doc);
    snapshot.push({
      selector,
      index,
      outerHTML: el.outerHTML,
      styleAttr: el.getAttribute("style") || ""
    });
  });

  return snapshot;
}

function buildSelectorWithIndexInDoc(el, doc) {
  const id = el.getAttribute("id");
  if (id) return { selector: `#${CSS.escape(id)}`, index: 0 };

  const parts = [];
  let current = el;
  while (current && current.tagName && current !== doc.documentElement) {
    let part = current.tagName.toLowerCase();
    const classAttr = current.getAttribute("class") || "";
    const classes = classAttr.trim().split(/\s+/).filter(Boolean);
    if (classes.length) part += "." + classes.map(c => CSS.escape(c)).join(".");
    parts.unshift(part);
    current = current.parentElement;
  }

  const selector = parts.length ? parts.join(" > ") : "html";
  const matches = doc.querySelectorAll(selector);
  let index = 0;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i] === el) {
      index = i;
      break;
    }
  }

  return { selector, index };
}

saveBtn.addEventListener("click", async () => {
  status.textContent = "Capturing edits…";
  saveBtn.disabled = true;

  try {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    let response;
    try {
      response = await chrome.tabs.sendMessage(tabId, { action: "captureDomSnapshot" });
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        throw new Error("Extension reloaded. Close and reopen DevTools, then try again.");
      }
      const message = err?.message || "Unable to access this page.";
      if (message.includes("Receiving end does not exist") || message.includes("Could not establish connection")) {
        throw new Error("This page does not allow extension scripts (for example chrome:// pages). Open a normal website and try again.");
      }
      throw err;
    }

    let url;
    let snapshot;

    if (response?.snapshot) {
      ({ url, snapshot } = response);
    } else {
      // Fallback for tabs with an older content script that does not support captureDomSnapshot.
      let htmlResponse;
      try {
        htmlResponse = await chrome.tabs.sendMessage(tabId, { action: "getPageSnapshot" });
      } catch (err) {
        if (isContextInvalidatedError(err)) {
          throw new Error("Extension reloaded. Close and reopen DevTools, then try again.");
        }
        throw err;
      }
      if (!htmlResponse?.html) {
        throw new Error("Could not capture page snapshot. Reload the tab and try again.");
      }

      const tab = await chrome.tabs.get(tabId);
      url = htmlResponse.url || tab.url;
      snapshot = buildSnapshotFromHtml(htmlResponse.html);
    }

    // Load the stored "original" snapshot for this URL (if any)
    const origKey = `original_${url}`;
    const stored = await chrome.storage.local.get(origKey);
    const original = stored[origKey] || null;

    let editsToSave = [];

    if (!original) {
      // First time: store current as baseline — nothing to diff yet
      await chrome.storage.local.set({ [origKey]: snapshot });
      status.textContent = "✅ Baseline saved! Make your edits, then click Save again.";
      saveBtn.disabled = false;
      return;
    }

    // Build a map of original elements by selector+index
    const origMap = {};
    for (const entry of original) {
      origMap[`${entry.selector}::${entry.index}`] = entry;
    }

    // Diff: find changed elements
    for (const entry of snapshot) {
      const key = `${entry.selector}::${entry.index}`;
      const orig = origMap[key];
      if (!orig) continue; // new element, skip for now
      if (orig.outerHTML !== entry.outerHTML) {
        editsToSave.push({
          id: key,
          selector: entry.selector,
          selectorIndex: entry.index,
          type: "outerHTML",
          value: entry.outerHTML
        });
      }
    }

    // Save edits via background
    await chrome.runtime.sendMessage({ action: "clearEdits", url });
    for (const edit of editsToSave) {
      await chrome.runtime.sendMessage({ action: "saveEdit", url, edit });
    }

    // Update baseline to current snapshot
    await chrome.storage.local.set({ [origKey]: snapshot });

    status.textContent = editsToSave.length
      ? `✅ Saved ${editsToSave.length} edit(s)!`
      : "✅ No changes detected. Baseline updated.";

  } catch (e) {
    status.textContent = "❌ Error: " + (e?.message || "Unknown error");
    console.error(e);
  }

  saveBtn.disabled = false;
});
