// Fonction pour récupérer un cookie spécifique par son nom
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Fonction commune de synchronisation
async function performSync(sendResponse = null) {
  const isLinkedIn = window.location.href.includes("linkedin.com");
  console.log(`[Verytis Extension] Syncing from ${isLinkedIn ? "LinkedIn" : "Verytis"} tab...`);
  
  chrome.runtime.sendMessage({ action: "GET_LINKEDIN_COOKIE" }, async (response) => {
    if (response?.cookies) {
      let name = "Compte LinkedIn";
      let image = null;
      let email = null;

      if (isLinkedIn) {
        // 1. Tenter de récupérer le nom via l'attribut ALT de la photo (très fiable)
        const mePhoto = document.querySelector('img.global-nav__me-photo, .feed-identity-module__member-photo, .identity-block__image');
        if (mePhoto && mePhoto.alt && !mePhoto.alt.toLowerCase().includes('photo')) {
          name = mePhoto.alt.trim();
        } else {
          // Fallback sur les sélecteurs de texte
          const nameEl = document.querySelector(".feed-identity-module__name, .identity-block__name, .t-16.t-black.t-bold, .global-nav__me-photo-name");
          if (nameEl) name = nameEl.textContent.trim();
        }

        image = mePhoto ? mePhoto.src : null;

        // 2. Tenter de récupérer l'Email via l'API /me (plus simple)
        try {
          const csrfToken = getCookie("JSESSIONID")?.replace(/"/g, '');
          const headers = { 
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'csrf-token': csrfToken || ""
          };

          let meRes = await fetch('https://www.linkedin.com/voyager/api/me', { headers });
          if (meRes.ok) {
            const meData = await meRes.json();
            // L'email est parfois dans le miniProfile ou on peut déduire le slug
            email = meData.miniProfile?.emailAddress || null;
            if (meData.miniProfile && name === "Compte LinkedIn") {
              name = `${meData.miniProfile.firstName} ${meData.miniProfile.lastName}`;
            }
          }
        } catch (e) {
          console.warn("[Verytis Extension] Erreur API /me:", e);
        }
      }

      console.log("[Verytis Extension] Sending session data:", { name, email, count: response.cookies.length });

      const syncData = {
        cookies: response.cookies, // On envoie le tableau complet
        name: name,
        image: image,
        email: email
      };

      window.dispatchEvent(new CustomEvent("VERYTIS_LINKEDIN_SYNC_RESPONSE", {
        detail: syncData
      }));

      if (sendResponse) sendResponse({ success: true });
    } else {
      if (sendResponse) sendResponse({ error: response?.error });
      else alert(response?.error || "Erreur lors de la récupération du cookie.");
    }
  });
}

// Écouter les demandes venant de la page web (Verytis)
window.addEventListener("VERYTIS_LINKEDIN_SYNC_REQUEST", () => performSync());

// Écouter les demandes venant du popup de l'extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "FORCE_SYNC") {
    performSync(sendResponse);
    return true; // async
  }
});
