chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_LINKEDIN_COOKIE") {
    chrome.cookies.getAll({ domain: ".linkedin.com" }, (cookies) => {
      if (cookies && cookies.length > 0) {
        // Renvoyer les objets cookies complets pour préserver les domaines/paths
        sendResponse({ cookies: cookies });
      } else {
        sendResponse({ error: "Session LinkedIn non trouvée. Veuillez vous connecter à LinkedIn." });
      }
    });
    return true; // Keep channel open
  }
});
