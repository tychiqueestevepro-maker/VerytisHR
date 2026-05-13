chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_LINKEDIN_COOKIE") {
    chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" }, (cookie) => {
      if (cookie) {
        // Optionnel: On peut aussi récupérer le nom et l'image via un fetch rapide sur LinkedIn
        sendResponse({ cookie: cookie.value });
      } else {
        sendResponse({ error: "Session LinkedIn non trouvée. Veuillez vous connecter à LinkedIn." });
      }
    });
    return true; // Keep channel open
  }
});
