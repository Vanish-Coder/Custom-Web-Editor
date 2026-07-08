# Custom Web Editor

A Chrome extension that lets you edit any website's HTML through DevTools and permanently save those changes.

---

## Installation

1. Download and unzip the extension folder
2. Go to `chrome://extensions`
3. Enable **Developer Mode** (toggle in the top right)
4. Click **Load unpacked** and select the unzipped folder
5. The extension icon will appear in your Chrome toolbar

---

## Usage Instructions

### Saving edits

1. Navigate to the page you want to edit
2. Open DevTools (`F12` or `Cmd+Option+I`) or just inspect element
3. Go to the **HTML Saver** tab (in the DevTools top bar)
4. Click **Save Current Page Edits** once (captures baseline)
5. Make your edits in the **Elements** panel (you can use inspect element to pinpoint specific details)
6. Click **Save Current Page Edits** again (checks for changes and saves)
7. To test it out, you can reload the page.

- **Note:** The DevTools panel is called **HTML Saver**, this is the editing interface inside DevTools.

### Managing saved edits

Click the **Custom Web Editor** icon in your Chrome toolbar to open the popup, where you can:
- See all saved edits for the current page
- Delete individual edits
- Clear all edits for the current page

---

## Limitations

- **Does not work on** `chrome://` pages or other restricted browser pages (Chrome rules).
- **Storage quota:** All edits share Chrome's 10MB `chrome.storage.local` limit. On pages with large, complex HTML, the baseline snapshot can consume significant space. While moving to `sessionStorage` could fix this, it would cause other saving issues, which is why a seperate release will be issued that uses `sessionStorage` with that trade off being stability and long-term saving.
- If the extension is reloaded mid-session, close and reopen DevTools before saving again.
