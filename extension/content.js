// Écouter les demandes venant de la page web (Verytis)
window.addEventListener("VERYTIS_LINKEDIN_SYNC_REQUEST", async () => {
  console.log("[Verytis Extension] Sync request received");
  
  chrome.runtime.sendMessage({ action: "GET_LINKEDIN_COOKIE" }, (response) => {
    if (response?.cookie) {
      // Renvoyer à la page web
      window.dispatchEvent(new CustomEvent("VERYTIS_LINKEDIN_SYNC_RESPONSE", {
        detail: {
          cookie: response.cookie,
          name: "Compte Synchronisé",
          image: null
        }
      }));
    } else {
      alert(response?.error || "Erreur lors de la récupération du cookie.");
    }
  });
});
