const PUBLIC_EVENTS = [
    {
        id: 1,
        timestamp: '2026-06-04 08:25',
        city: 'Jakarta',
        location: 'Tol Cawang',
        plat: 'B 1234 ABC',
        type: 'Truk Besar',
        weight: 32.4,
        maxAllowed: 30
    },
    {
        id: 2,
        timestamp: '2026-06-04 09:05',
        city: 'Bandung',
        location: 'Cipularang KM 120',
        plat: 'D 8765 XY',
        type: 'Trailer',
        weight: 38.1,
        maxAllowed: 35
    },
    {
        id: 3,
        timestamp: '2026-06-04 09:50',
        city: 'Surabaya',
        location: 'Jalan tol Surabaya-Gempol',
        plat: 'L 5678 ZQ',
        type: 'Truk Sedang',
        weight: 17.3,
        maxAllowed: 15
    }
];

const NEW_EVENT_QUEUE = [
    {
        id: 4,
        timestamp: null,
        city: 'Bekasi',
        location: 'Jalan Raya Narogong',
        plat: 'B 3456 CD',
        type: 'Truk Besar',
        weight: 31.2,
        maxAllowed: 30
    },
    {
        id: 5,
        timestamp: null,
        city: 'Semarang',
        location: 'Jalan Tol Semarang',
        plat: 'H 1122 AB',
        type: 'Bus / Minibus',
        weight: 13.0,
        maxAllowed: 12
    },
    {
        id: 6,
        timestamp: null,
        city: 'Yogyakarta',
        location: 'Jalan Magelang',
        plat: 'AB 9876 GH',
        type: 'Truk Sedang',
        weight: 16.5,
        maxAllowed: 15
    }
];

const STORAGE_KEY_CITY = 'publikNotificationCity';
const STORAGE_KEY_LAST_EVENT_ID = 'publikLastSeenEventId';

const state = {
    events: [...PUBLIC_EVENTS],
    filter: {
        city: 'Semua',
        from: '',
        to: ''
    },
    subscribedCity: localStorage.getItem(STORAGE_KEY_CITY) || '',
    lastSeenEventId: parseInt(localStorage.getItem(STORAGE_KEY_LAST_EVENT_ID), 10) || 0,
    nextNewEventIndex: 0
};

const elements = {
    totalChecked: document.getElementById('statTotalChecked'),
    totalOverload: document.getElementById('statTotalOverload'),
    violationRate: document.getElementById('statViolationRate'),
    subscribeCity: document.getElementById('subscribeCity'),
    subscribeButton: document.getElementById('subscribeButton'),
    subscriptionStatus: document.getElementById('subscriptionStatus'),
    filterCity: document.getElementById('filterCity'),
    filterDateFrom: document.getElementById('filterDateFrom'),
    filterDateTo: document.getElementById('filterDateTo'),
    filterButton: document.getElementById('filterButton'),
    downloadCsvButton: document.getElementById('downloadCsvButton'),
    eventsTableBody: document.getElementById('eventsTableBody'),
    emptyStateText: document.getElementById('emptyStateText')
};

function initPublikPage() {
    renderCityOptions();
    renderFilterOptions();
    renderSubscriptionState();
    renderStatistics();
    renderTable();

    elements.subscribeButton.addEventListener('click', handleSubscribeClick);
    elements.filterButton.addEventListener('click', handleFilterChange);
    elements.downloadCsvButton.addEventListener('click', downloadCsv);

    if (!('Notification' in window)) {
        elements.subscriptionStatus.textContent = 'Browser Anda tidak mendukung notifikasi.';
        elements.subscribeButton.disabled = true;
    }

    if (state.lastSeenEventId === 0) {
        const maxId = state.events.reduce((max, event) => Math.max(max, event.id), 0);
        state.lastSeenEventId = maxId;
        localStorage.setItem(STORAGE_KEY_LAST_EVENT_ID, state.lastSeenEventId);
    }

    setInterval(checkNewEvents, 30000);
}

function renderCityOptions() {
    const queueCities = NEW_EVENT_QUEUE.map(event => event.city);
    const cities = Array.from(new Set([...state.events.map(event => event.city), ...queueCities, state.subscribedCity].filter(Boolean))).sort();
    const options = ['Semua', ...cities];

    elements.filterCity.innerHTML = options.map(city => `<option value="${city}">${city}</option>`).join('');
    elements.subscribeCity.innerHTML = cities.map(city => `<option value="${city}">${city}</option>`).join('');

    if (state.subscribedCity) {
        elements.subscribeCity.value = state.subscribedCity;
    }
}

function renderFilterOptions() {
    // Inisialisasi nilai filter sesuai state
    elements.filterCity.value = state.filter.city;
    elements.filterDateFrom.value = state.filter.from;
    elements.filterDateTo.value = state.filter.to;
}

function renderSubscriptionState() {
    if (!state.subscribedCity) {
        elements.subscriptionStatus.textContent = 'Pilih kota lalu klik Langganan Notifikasi.';
        return;
    }
    if (Notification.permission === 'granted') {
        elements.subscriptionStatus.textContent = `Berhasil berlangganan notifikasi untuk kota ${state.subscribedCity}.`;
    } else if (Notification.permission === 'denied') {
        elements.subscriptionStatus.textContent = 'Notifikasi diblokir. Ubah izin di pengaturan browser.';
    } else {
        elements.subscriptionStatus.textContent = `Kota yang dipantau: ${state.subscribedCity}. Klik Langganan Notifikasi untuk meminta izin.`;
    }
}

function renderStatistics() {
    const totalOverload = state.events.length;
    const totalChecked = Math.max(totalOverload * 4, totalOverload + 20);
    const violationRate = totalChecked === 0 ? 0 : Math.round((totalOverload / totalChecked) * 100);

    elements.totalChecked.textContent = totalChecked;
    elements.totalOverload.textContent = totalOverload;
    elements.violationRate.textContent = `${violationRate}%`;
}

function renderTable() {
    const filtered = getFilteredEvents();
    elements.eventsTableBody.innerHTML = '';

    if (filtered.length === 0) {
        elements.emptyStateText.textContent = 'Tidak ada data overload untuk filter yang dipilih.';
        return;
    }

    elements.emptyStateText.textContent = '';

    const rows = filtered.map(event => {
        const overloadPercent = Math.round(((event.weight - event.maxAllowed) / event.maxAllowed) * 100);
        return `
            <tr>
                <td>${event.timestamp}</td>
                <td>${event.city}</td>
                <td>${event.location}</td>
                <td>${maskPlate(event.plat)}</td>
                <td>${event.type}</td>
                <td>${event.weight.toFixed(1)}</td>
                <td>${event.maxAllowed.toFixed(1)}</td>
                <td>${overloadPercent}%</td>
            </tr>
        `;
    });

    elements.eventsTableBody.innerHTML = rows.join('');
}

function getFilteredEvents() {
    return state.events.filter(event => {
        const matchesCity = state.filter.city === 'Semua' || event.city === state.filter.city;
        const matchesFrom = !state.filter.from || event.timestamp >= state.filter.from;
        const matchesTo = !state.filter.to || event.timestamp <= state.filter.to + ' 23:59';
        return matchesCity && matchesFrom && matchesTo;
    });
}

function handleFilterChange() {
    state.filter.city = elements.filterCity.value;
    state.filter.from = elements.filterDateFrom.value;
    state.filter.to = elements.filterDateTo.value;
    renderTable();
}

function handleSubscribeClick() {
    const selectedCity = elements.subscribeCity.value;
    if (!selectedCity) {
        alert('Pilih kota yang ingin dipantau sebelum berlangganan.');
        return;
    }
    if (!('Notification' in window)) {
        alert('Browser Anda tidak mendukung Notification API.');
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            state.subscribedCity = selectedCity;
            localStorage.setItem(STORAGE_KEY_CITY, selectedCity);
            renderSubscriptionState();
            showLocalNotification(`Langganan aktif untuk ${selectedCity}`, `Anda akan menerima notifikasi overload terbaru di kota ${selectedCity}.`);
        } else if (permission === 'denied') {
            state.subscribedCity = '';
            localStorage.removeItem(STORAGE_KEY_CITY);
            renderSubscriptionState();
            alert('Izin notifikasi ditolak. Silakan aktifkan izin di pengaturan browser untuk menerima pesan.');
        } else {
            renderSubscriptionState();
        }
    });
}

function showLocalNotification(title, body) {
    if (Notification.permission !== 'granted') {
        return;
    }

    try {
        new Notification(title, {
            body,
            icon: 'https://www.google.com/s2/favicons?domain=example.com'
        });
    } catch (error) {
        console.warn('Tidak dapat menampilkan notifikasi:', error);
    }
}

function maskPlate(plate) {
    const value = plate.trim();
    const parts = value.split(' ');
    if (parts.length >= 3) {
        const prefix = parts[0];
        const middle = parts[1];
        const suffix = parts.slice(2).join(' ');
        const maskedMiddle = middle.length > 2 ? middle.slice(0, 2) + '*'.repeat(Math.min(2, middle.length - 2)) : '*'.repeat(middle.length);
        return `${prefix} ${maskedMiddle} ${suffix}`;
    }
    return value.replace(/(.{2})(.*)(.{3})/, (match, p1, p2, p3) => `${p1}${'*'.repeat(p2.length)}${p3}`);
}

function downloadCsv() {
    const filtered = getFilteredEvents();
    if (filtered.length === 0) {
        alert('Tidak ada data untuk diunduh.');
        return;
    }

    const csvRows = [
        ['Waktu', 'Kota', 'Lokasi', 'Plat', 'Jenis', 'Berat (ton)', 'Batas Maks (ton)', 'Kelebihan (%)']
    ];

    filtered.forEach(event => {
        const overloadPercent = Math.round(((event.weight - event.maxAllowed) / event.maxAllowed) * 100);
        csvRows.push([
            event.timestamp,
            event.city,
            event.location,
            maskPlate(event.plat),
            event.type,
            event.weight.toFixed(1),
            event.maxAllowed.toFixed(1),
            `${overloadPercent}%`
        ]);
    });

    const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'laporan-overload-publik.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function checkNewEvents() {
    if (state.nextNewEventIndex >= NEW_EVENT_QUEUE.length) {
        return;
    }

    const nextEvent = { ...NEW_EVENT_QUEUE[state.nextNewEventIndex] };
    nextEvent.timestamp = new Date().toLocaleString('id-ID', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).replace(',', '');

    state.events.unshift(nextEvent);
    state.nextNewEventIndex += 1;
    renderStatistics();
    renderTable();

    const currentCity = state.subscribedCity;
    if (currentCity && Notification.permission === 'granted' && nextEvent.city === currentCity) {
        showLocalNotification('Kendaraan Overload Baru', `${maskPlate(nextEvent.plat)} di ${nextEvent.location}, ${nextEvent.type}, ${nextEvent.weight.toFixed(1)} ton.`);
    }
}

initPublikPage();