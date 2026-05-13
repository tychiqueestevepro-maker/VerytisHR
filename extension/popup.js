document.getElementById('syncBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab && tab.url && tab.url.includes("linkedin.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "FORCE_SYNC" }, (response) => {
      const btn = document.getElementById('syncBtn');
      if (chrome.runtime.lastError) {
        btn.textContent = "Erreur: Rechargez LinkedIn";
        btn.style.background = "#ef4444";
      } else {
        btn.textContent = "✓ Synchronisé !";
        btn.style.background = "#059669";
        setTimeout(() => {
          btn.textContent = "Synchroniser maintenant";
          btn.style.background = "#ed145b";
        }, 2000);
      }
    });
  } else {
    alert("Veuillez ouvrir LinkedIn avant de synchroniser.");
  }
});
