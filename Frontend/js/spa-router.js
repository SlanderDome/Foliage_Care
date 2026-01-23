// // Cache for loaded pages
// const pageCache = {};

// // Show specific page
// function showPage(pageName) {
//   console.log('Navigating to:', pageName);
  
//   // Hide all pages
//   document.querySelectorAll('.page').forEach(page => {
//     page.classList.add('hidden');
//   });

//   // Update active nav link
//   document.querySelectorAll('.nav-link').forEach(link => {
//     link.classList.remove('active');
//   });
//   const activeLink = document.querySelector(`[data-page="${pageName}"]`);
//   if (activeLink) activeLink.classList.add('active');

//   // Get the target page element
//   const pageElement = document.getElementById(`${pageName}-page`);
  
//   if (!pageElement) {
//     console.error('Page not found:', pageName);
//     return;
//   }

//   // Show the page
//   pageElement.classList.remove('hidden');

//   // Load content if not cached
//   if (!pageCache[pageName]) {
//     loadPageContent(pageName, pageElement);
//   }

//   // Update URL without page reload
//   window.history.pushState({ page: pageName }, '', `#${pageName}`);
  
//   // Scroll to top
//   window.scrollTo(0, 0);
// }

// // Load page content from separate HTML files
// async function loadPageContent(pageName, pageElement) {
//   const fileMap = {
//     'diagnose': 'start.html',
//     'about': 'about.html',
//     'profile': 'profile.html',
//     'connect': 'contact.html'
//   };

//   const fileName = fileMap[pageName];
  
//   if (!fileName) {
//     pageCache[pageName] = true; // Home page already in HTML
//     return;
//   }

//   try {
//     const response = await fetch(fileName);
//     const html = await response.text();
    
//     // Parse the HTML
//     const parser = new DOMParser();
//     const doc = parser.parseFromString(html, 'text/html');
    
//     // CRITICAL: Remove nav and footer from loaded content
//     const navs = doc.querySelectorAll('nav, .navbar');
//     navs.forEach(nav => nav.remove());
    
//     const footers = doc.querySelectorAll('footer, .footer');
//     footers.forEach(footer => footer.remove());
    
//     // Also remove any script tags to avoid conflicts
//     const scripts = doc.querySelectorAll('script');
//     scripts.forEach(script => script.remove());
    
//     // Get the remaining content
//     const content = doc.body.innerHTML;
//     pageElement.innerHTML = content;
    
//     // Execute page-specific scripts
//     executePageScripts(pageName);
    
//     pageCache[pageName] = true;
    
//   } catch (error) {
//     console.error('Error loading page:', error);
//     pageElement.innerHTML = '<div class="loading">Error loading page. Please refresh.</div>';
//   }
// }

// // Execute page-specific JavaScript
// function executePageScripts(pageName) {
//   if (pageName === 'profile' && typeof initializeProfile === 'function') {
//     initializeProfile();
//   } else if (pageName === 'diagnose' && typeof initializeDiagnose === 'function') {
//     initializeDiagnose();
//   }
//   // Add more page initializers as needed
// }

// // Handle browser back/forward buttons
// window.addEventListener('popstate', (event) => {
//   if (event.state && event.state.page) {
//     showPage(event.state.page);
//   } else {
//     showPage('home');
//   }
// });

// // Add click handlers to all nav links
// document.addEventListener('DOMContentLoaded', () => {
//   // Handle all nav link clicks
//   document.querySelectorAll('.nav-link').forEach(link => {
//     link.addEventListener('click', (e) => {
//       e.preventDefault();
//       const pageName = link.getAttribute('data-page');
//       if (pageName) {
//         showPage(pageName);
//       }
//     });
//   });

//   // Show initial page based on URL hash
//   const hash = window.location.hash.substring(1);
//   showPage(hash || 'home');
// });

// // Make showPage globally accessible
// window.showPage = showPage;