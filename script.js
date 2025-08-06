document.addEventListener('DOMContentLoaded', () => {
    // --- Element Cache ---
    const appContent = document.getElementById('app-content');
    const navItems = document.querySelectorAll('.nav-item');
    const entryGate = document.getElementById('entry-gate');
    const enterButton = document.getElementById('enter-button');
    const entryTitle = document.querySelector('.entry-title');
    const entryInfo = document.querySelector('.entry-info');
    const notificationBell = document.getElementById('notification-bell');
    const mobileNotificationIcon = document.getElementById('mobile-notification-icon');
    const notificationCenter = document.getElementById('notification-center');
    const notificationList = document.getElementById('notification-list');
    const notificationClearAll = document.getElementById('notification-clear-all');

    // --- State Variables ---
    let tvData = [], ottData = [], contentData = {}, notificationData = [];
    let currentView = localStorage.getItem('viewPreference') || 'list';
    let currentSearchTerm = '';
    let currentSortMethod = 'az';

    // --- THEME ENGINE ---
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        document.querySelectorAll('.theme-checkbox').forEach(checkbox => {
            checkbox.checked = theme === 'light';
        });
    };
    document.body.addEventListener('change', (e) => {
        if (e.target.classList.contains('theme-checkbox')) {
            applyTheme(e.target.checked ? 'light' : 'dark');
        }
    });

    // --- APP INITIALIZATION & ENTRY LOGIC (RE-ARCHITECTED FOR STABILITY) ---

    // Step 1: Main startup function
    async function main() {
        try {
            // First, fetch only the content needed for the UI text
            contentData = await fetch('content.json').then(res => res.json());
            notificationData = contentData.notifications;

            // Now that we have the text, populate the entry screen
            entryTitle.textContent = contentData.entryScreen.title;
            entryInfo.textContent = contentData.entryScreen.info;
            enterButton.textContent = contentData.entryScreen.buttonText;

            // Then, decide whether to show the entry screen or start the app
            handleEntry();
        } catch (error) {
            console.error("Fatal Error: Could not load initial content.json", error);
            document.body.innerHTML = `<div style="color: white; text-align: center; padding: 50px;">Error loading core application files. Please try again later.</div>`;
        }
    }

    // Step 2: Handle the entry gate visibility
    function handleEntry() {
        if (localStorage.getItem('hasVisited')) {
            entryGate.style.display = 'none';
            initializeApp();
        } else {
            document.body.classList.add('entry-active');
            entryGate.style.display = 'flex';
            // Wait for the user to click the enter button
        }
    }
    
    // Step 3: User clicks enter, or app initializes for returning user
    function initializeApp() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
        
        fetchPageData(); // Fetch the rest of the data (TV, OTT)
        setupGlobalListeners();
        setupNotificationListener();
    }
    
    // Step 4: Fetch remaining data for pages
    async function fetchPageData() {
        appContent.innerHTML = `<div class="loading-spinner"></div>`;
        try {
            [tvData, ottData] = await Promise.all([
                fetch('tv.json').then(res => res.json()),
                fetch('ott.json').then(res => res.json()),
            ]);
            renderNotifications();
            navigate();
        } catch (error) {
            appContent.innerHTML = `<div class="page-container"><h1 class="page-title">Error</h1><p class="page-subtitle">Could not load page data. Please check your connection and try again.</p></div>`;
        }
    }
    
    enterButton.addEventListener('click', () => {
        if (localStorage.getItem('hasVisited')) return;
        localStorage.setItem('hasVisited', 'true');
        entryGate.classList.add('closing');
        entryGate.addEventListener('transitionend', () => document.body.classList.remove('entry-active'), { once: true });
        initializeApp();
    });

    // --- LIVE NOTIFICATION LISTENER ---
    function setupNotificationListener() {
        if (typeof(EventSource) !== "undefined") {
            const source = new EventSource("sse_notifications.php");
            source.onmessage = function(event) {
                const newNotifications = JSON.parse(event.data);
                if (JSON.stringify(newNotifications) !== JSON.stringify(notificationData)) {
                    notificationData = newNotifications;
                    renderNotifications();
                    notificationCenter.classList.add('show');
                }
            };
        }
    }

    // --- NAVIGATION & ROUTING ---
    function navigate() {
        const hash = window.location.hash || '#live-tv';
        const page = hash.substring(1).split('/')[0];
        const id = hash.substring(1).split('/')[1];
        
        if (!appContent.innerHTML.includes('loading-spinner')) {
             appContent.style.animation = 'none';
             appContent.offsetHeight;
             appContent.style.animation = 'fadeIn 0.4s ease-out';
        }
        
        updateActiveNav(page);
        notificationCenter.classList.remove('show');

        if (id) {
            const sourceData = page === 'live-tv' ? tvData : ottData;
            const item = sourceData.find(d => d.id === id);
            if(item) {
                renderDetailPage(item);
            } else {
                appContent.innerHTML = `<div class="page-container"><h1 class="page-title">Not Found</h1></div>`;
            }
        } else {
            switch (page) {
                case 'live-tv': renderPartnerPage(tvData, 'Live TV Channels', 'live-tv'); break;
                case 'ott': renderPartnerPage(ottData, 'OTT Platforms', 'ott'); break;
                case 'about': renderAboutPage(); break;
                case 'notifications': break;
                default: renderPartnerPage(tvData, 'Live TV Channels', 'live-tv');
            }
        }
    }

    // --- DYNAMIC PAGE RENDERING ---
    function renderPartnerPage(items, title, pageType) {
        currentSearchTerm = localStorage.getItem(`${pageType}_search`) || '';
        currentSortMethod = localStorage.getItem(`${pageType}_sort`) || 'az';

        appContent.innerHTML = `
            <div class="page-container">
                ${createMobileHeader()}
                <header class="page-header">
                    <div class="header-top-row">
                        <h1 class="page-title">${title}</h1>
                        <div class="controls-container">
                            <div class="view-switcher">
                                <button class="view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list"><i class='bx bx-list-ul'></i></button>
                                <button class="view-btn ${currentView === 'grid' ? 'active' : ''}" data-view="grid"><i class='bx bxs-grid'></i></button>
                            </div>
                            <select class="sort-select">
                                <option value="az" ${currentSortMethod === 'az' ? 'selected' : ''}>Sort A-Z</option>
                                <option value="za" ${currentSortMethod === 'za' ? 'selected' : ''}>Sort Z-A</option>
                            </select>
                        </div>
                    </div>
                    <input type="search" class="search-bar" placeholder="Search partners..." value="${currentSearchTerm}">
                </header>
                <div id="partner-container"></div>
            </div>`;
        renderItems(applyFiltersAndSort(items));
        attachPageListeners(items, pageType);
    }
    
    function renderDetailPage(item) {
        const pageType = window.location.hash.includes('ott') ? 'ott' : 'live-tv';
        appContent.innerHTML = `
            <div class="page-container">
                <a href="#${pageType}" class="back-button">
                    <i class='bx bx-arrow-back'></i> Back to list
                </a>
                <div class="detail-hero-panel">
                    <img src="${item.logoUrl}" alt="${item.name}" class="detail-logo">
                    <div class="detail-info">
                        <h1 class="detail-title">${item.name}</h1>
                        <p class="detail-category">${item.category}</p>
                    </div>
                    <a href="${item.link}" target="_blank" class="primary-button">Visit Site</a>
                </div>
                <p class="detail-description">${item.description}</p>
            </div>`;
        const mobileHeaderHTML = createMobileHeader();
        appContent.insertAdjacentHTML('afterbegin', mobileHeaderHTML);
        applyTheme(localStorage.getItem('theme') || 'dark');
    }

    function renderItems(itemsToRender) {
        const container = document.getElementById('partner-container');
        if (!container) return;
        container.className = currentView === 'list' ? 'partner-list' : 'partner-grid';
        if (itemsToRender.length === 0) {
            container.innerHTML = `<p>No partners found.</p>`;
            return;
        }
        const pageType = window.location.hash.includes('ott') ? 'ott' : 'live-tv';
        container.innerHTML = itemsToRender.map(item => {
            if (currentView === 'list') {
                return `<a href="#${pageType}/${item.id}" class="partner-item"><img src="${item.logoUrl}" alt="${item.name}" class="partner-logo"><div class="partner-info"><h3 class="partner-name">${item.name}</h3><p class="partner-category">${item.category}</p></div><i class='bx bx-chevron-right partner-action-icon'></i></a>`;
            } else {
                return `<a href="#${pageType}/${item.id}" class="partner-card"><img src="${item.logoUrl}" alt="${item.name}" class="partner-logo"><h3 class="partner-name">${item.name}</h3></a>`;
            }
        }).join('');
    }

    function renderAboutPage() {
        const about = contentData.aboutPage;
        appContent.innerHTML = `<div class="page-container">${createMobileHeader()}<header class="page-header"><h1 class="page-title">${about.title}</h1></header><div class="about-section"><h2>${about.mission.heading}</h2><p>${about.mission.text}</p></div><div class="about-section"><h2>${about.vision.heading}</h2><p>${about.vision.text}</p></div><div class="about-section"><h2>${about.contact.heading}</h2><p>${about.contact.text}</p><div class="contact-grid"><a href="mailto:${about.contact.emailGeneral}" class="contact-item"><i class='bx bxs-envelope'></i><span><strong>General Inquiries</strong><br>${about.contact.emailGeneral}</span></a><a href="mailto:${about.contact.emailPartners}" class="contact-item"><i class='bx bxs-briefcase'></i><span><strong>Partnerships</strong><br>${about.contact.emailPartners}</span></a></div></div></div>`;
        applyTheme(localStorage.getItem('theme') || 'dark');
    }

    // --- EVENT LISTENERS & HELPERS ---
    function setupGlobalListeners() {
        window.addEventListener('hashchange', navigate);
        notificationBell.addEventListener('click', toggleNotificationCenter);
        mobileNotificationIcon.addEventListener('click', (e) => { e.preventDefault(); toggleNotificationCenter(e); });
        document.addEventListener('click', () => notificationCenter.classList.remove('show'));
        notificationCenter.addEventListener('click', e => e.stopPropagation());
        notificationList.addEventListener('click', handleNotificationInteraction);
        notificationClearAll.addEventListener('click', () => { notificationData = []; renderNotifications(); });
    }

    function attachPageListeners(originalItems, pageType) {
        document.querySelector('.search-bar')?.addEventListener('input', e => {
            currentSearchTerm = e.target.value;
            localStorage.setItem(`${pageType}_search`, currentSearchTerm);
            renderItems(applyFiltersAndSort(originalItems));
        });
        document.querySelector('.sort-select')?.addEventListener('change', e => {
            currentSortMethod = e.target.value;
            localStorage.setItem(`${pageType}_sort`, currentSortMethod);
            renderItems(applyFiltersAndSort(originalItems));
        });
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const newView = e.currentTarget.dataset.view;
                if(newView === currentView) return;
                currentView = newView;
                localStorage.setItem('viewPreference', currentView);
                document.querySelector('.view-btn.active').classList.remove('active');
                e.currentTarget.classList.add('active');
                renderItems(applyFiltersAndSort(originalItems));
            });
        });
    }
    
    function applyFiltersAndSort(items) {
        let processedData = [...items].filter(item => item.name.toLowerCase().includes(currentSearchTerm.toLowerCase()));
        processedData.sort((a, b) => currentSortMethod === 'za' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
        return processedData;
    }

    function createMobileHeader() {
        if (!contentData.appBranding) return '';
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isChecked = currentTheme === 'light' ? 'checked' : '';
        return `
            <div class="mobile-header">
                <div class="mobile-header-branding">
                    <div class="brand-name">${contentData.appBranding.name}</div>
                    <div class="brand-tagline">${contentData.appBranding.tagline}</div>
                </div>
                <label class="theme-switch">
                    <input type="checkbox" class="theme-checkbox" ${isChecked}>
                    <div class="switch-slider">
                        <i class='bx bx-moon slider-icon'></i>
                        <i class='bx bx-sun slider-icon'></i>
                    </div>
                </label>
            </div>`;
    }

    // --- Notification Logic ---
    function toggleNotificationCenter(e) { e.stopPropagation(); notificationCenter.classList.toggle('show'); }
    function renderNotifications() {
        updateNotificationDot();
        if (!notificationData || notificationData.length === 0) {
            notificationList.innerHTML = `<p style="padding: 16px; text-align: center; color: var(--text-secondary);">No new notifications.</p>`;
            return;
        }
        notificationList.innerHTML = notificationData.map(n => `<div class="notification-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}"><i class='bx bxs-${n.type === 'alert' ? 'error-circle' : n.type === 'update' ? 'up-arrow-circle' : 'info-circle'} notif-icon type-${n.type}'></i><div class="notif-content"><h4 class="notif-title">${n.title}</h4><p class="notif-message">${n.message}</p><div class="notif-actions">${!n.isRead ? `<button class="mark-read">Mark as Read</button>` : ''}<button class="dismiss">Dismiss</button></div></div></div>`).join('');
    }
    function handleNotificationInteraction(e) {
        const target = e.target;
        const parentItem = target.closest('.notification-item');
        if (!parentItem) return;
        const notifId = parentItem.dataset.id;
        const notifIndex = notificationData.findIndex(n => n.id === notifId);
        if (notifIndex === -1) return;

        if (target.classList.contains('mark-read')) notificationData[notifIndex].isRead = true;
        if (target.classList.contains('dismiss')) {
            parentItem.classList.add('dismissing');
            parentItem.addEventListener('animationend', () => {
                const freshIndex = notificationData.findIndex(n => n.id === notifId);
                if (freshIndex > -1) notificationData.splice(freshIndex, 1);
                renderNotifications();
            }, {once: true});
            return;
        }
        renderNotifications();
    }
    function updateNotificationDot() { document.querySelectorAll('.notification-dot').forEach(dot => dot.style.display = notificationData && notificationData.some(n => !n.isRead) ? 'block' : 'none'); }
    const updateActiveNav = (page) => navItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));

    // --- START THE APP ---
    main();

});
