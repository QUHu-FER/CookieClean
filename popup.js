document.addEventListener('DOMContentLoaded', function() {
  const cleanCurrent = document.getElementById('cleanCurrent');
  const cleanAll = document.getElementById('cleanAll');
  const status = document.getElementById('status');
  const cookieStats = document.getElementById('cookieStats');
  const totalCookiesEl = document.getElementById('totalCookies');
  const totalSitesEl = document.getElementById('totalSites');
  const topSitesEl = document.getElementById('topSites');

  async function updateCookieStats() {
    const cookieStats = document.getElementById('cookieStats');
    try {
      // Dapatkan cookies terbaru setelah pembersihan
      const allCookies = await chrome.cookies.getAll({});
      const domains = new Set(allCookies.map(cookie => cookie.domain));
      
      const stats = {
        totalCookies: allCookies.length,
        totalDomains: domains.size,
        topDomains: Array.from(domains)
          .map(domain => ({
            domain,
            count: allCookies.filter(c => c.domain === domain).length
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      };

      cookieStats.innerHTML = `
        <div class="stat-card">
          <div class="stat-header">Total Cookies</div>
          <div class="stat-value">${stats.totalCookies}</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">Connected Websites</div>
          <div class="stat-value">${stats.totalDomains}</div>
        </div>
        <div class="stat-list">
          <div class="stat-header">Top Websites</div>
          <ul id="topSites">
            ${stats.topDomains.map(d => 
              `<li><span>${d.domain}</span><span class="cookie-count">${d.count}</span></li>`
            ).join('')}
          </ul>
        </div>
        ${stats.totalCookies > 0 ? 
          `<div class="stat-warning">
            Warning: ${stats.totalCookies} cookies still present in ${stats.totalDomains} sites
          </div>` : 
          '<div class="stat-success">All cookies have been cleaned!</div>'
        }`;
    } catch (err) {
      cookieStats.innerHTML = `<div class="error">Error loading stats: ${err.message}</div>`;
    }
  }

  function animateNumber(start, end, element) {
    const duration = 1000;
    const steps = 20;
    const increment = (end - start) / steps;
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        element.textContent = end;
        clearInterval(timer);
      } else {
        element.textContent = Math.round(current);
      }
    }, duration / steps);
  }

  async function cleanCookies(domain = null) {
    try {
      // Bersihkan cookies
      const cookies = await chrome.cookies.getAll(domain ? { domain } : {});
      let cleaned = 0;
      
      // Hapus cookies satu per satu
      for (const cookie of cookies) {
        try {
          const protocols = ['http:', 'https:'];
          for (const protocol of protocols) {
            const cookieUrl = `${protocol}//${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`;
            await chrome.cookies.remove({
              url: cookieUrl,
              name: cookie.name,
              storeId: cookie.storeId
            });
          }
          cleaned++;
        } catch (e) {
          console.error(`Failed to remove cookie: ${cookie.name}`, e);
        }
      }

      // Bersihkan data browsing jika tidak ada domain spesifik
      if (!domain) {
        await chrome.browsingData.remove({
          "since": 0
        }, {
          "cache": true,
          "cookies": true,
          "localStorage": true,
          "cacheStorage": true,
          "downloads": false,
          "formData": true,
          "history": false,
          "indexedDB": true,
          "passwords": false,
          "serviceWorkers": true,
          "webSQL": true
        });
      }

      return cleaned;
    } catch (err) {
      throw new Error(`Failed to clean cookies: ${err.message}`);
    }
  }

  // Update stats when popup opens
  updateCookieStats();

  cleanCurrent.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      // Show loading
      status.innerHTML = '<div class="loading"></div> Cleaning cookies...';
      
      const cleaned = await cleanCookies(domain);
      
      // Refresh tab to apply changes
      chrome.tabs.reload(tab.id);
      
      status.textContent = `Successfully cleaned ${cleaned} cookies from ${domain}`;
      updateCookieStats(); // Update stats
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
  });

  cleanAll.addEventListener('click', async () => {
    try {
      // Show confirmation
      if (!confirm('Are you sure you want to clean ALL cookies? This will log you out from all websites.')) {
        return;
      }
      
      status.innerHTML = '<div class="loading"></div> Cleaning all cookies...';
      
      const cleaned = await cleanCookies();
      
      // Refresh all tabs to apply changes
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => chrome.tabs.reload(tab.id));
      
      status.textContent = `Successfully cleaned ${cleaned} cookies from all sites`;
      updateCookieStats(); // Update stats
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
  });
});
