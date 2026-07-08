// Apply saved edits when the page loads
(async () => {
  const url = window.location.href;
  const key = `edits_${url}`;

  const result = await chrome.storage.local.get(key);
  const edits = result[key] || [];

  for (const edit of edits) {
    applyEdit(edit);
  }
})();

function applyEdit(edit) {
  try {
    const el = findElement(edit.selector, edit.selectorIndex);
    if (!el) return; // silently skip if element no longer exists

    if (edit.type === "outerHTML") {
      // Use a placeholder to replace, then swap
      const placeholder = document.createElement("span");
      placeholder.style.display = "none";
      el.parentNode.insertBefore(placeholder, el);
      el.remove();
      placeholder.outerHTML = edit.value;
    } else if (edit.type === "attribute") {
      el.setAttribute(edit.attrName, edit.value);
    } else if (edit.type === "style") {
      el.style.cssText = edit.value;
    } else if (edit.type === "textContent") {
      el.textContent = edit.value;
    }
  } catch (e) {
    // Silently skip broken edits
  }
}

function buildDomSnapshot() {
  const snapshot = [];

  document.querySelectorAll("*").forEach(el => {
    const { selector, index } = buildSelectorWithIndex(el);
    snapshot.push({
      selector,
      index,
      outerHTML: el.outerHTML,
      styleAttr: el.getAttribute("style") || ""
    });
  });

  return snapshot;
}

function buildSelectorWithIndex(el) {
  if (el.id) return { selector: `#${CSS.escape(el.id)}`, index: 0 };

  const parts = [];
  let current = el;
  while (current && current.tagName && current !== document.documentElement) {
    let part = current.tagName.toLowerCase();
    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length) part += "." + classes.map(c => CSS.escape(c)).join(".");
    }
    parts.unshift(part);
    current = current.parentElement;
  }

  const selector = parts.length ? parts.join(" > ") : "html";
  const matches = document.querySelectorAll(selector);
  let index = 0;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i] === el) {
      index = i;
      break;
    }
  }

  return { selector, index };
}

// Build a CSS selector for an element
function buildSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts = [];
  let current = el;
  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length) part += "." + classes.map(c => CSS.escape(c)).join(".");
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

// Find element by selector; use index to disambiguate duplicates
function findElement(selector, index = 0) {
  if (!selector) return null;
  const matches = document.querySelectorAll(selector);
  return matches[index] || null;
}

// Listen for snapshot/apply commands from extension pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getPageSnapshot") {
    sendResponse({ url: window.location.href, html: document.documentElement.outerHTML });
    return true;
  }
  if (msg.action === "captureDomSnapshot") {
    sendResponse({ url: window.location.href, snapshot: buildDomSnapshot() });
    return true;
  }
  if (msg.action === "applyEdit") {
    applyEdit(msg.edit);
    sendResponse({ ok: true });
    return true;
  }
});
