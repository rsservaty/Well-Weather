/* =====================================================
   WETTER EUROPA — app.js
   APIs: Open-Meteo (Wetter) + Nominatim (Geocoding)
   Karte: Leaflet + OpenStreetMap
   ===================================================== */

'use strict';

// ---- Konfiguration ----
const CONFIG = {
    mapCenter:    [51.5, 12.0],   // Mitteleuropa
    mapZoom:      5,
    minZoom:      3,
    maxZoom:      12,
    weatherUrl:   'https://api.open-meteo.com/v1/forecast',
    airUrl:       'https://air-quality-api.open-meteo.com/v1/air-quality',
    warnUrl:      'https://api.brightsky.dev/alerts',
    geocodeUrl:   'https://nominatim.openstreetmap.org/search',
    searchDelay:  400,            // ms Debounce
};

// ---- WMO Wetter-Codes ----
const WMO = {
    0:  { label: 'Klar',                       icon: '☀️' },
    1:  { label: 'Überwiegend klar',            icon: '🌤️' },
    2:  { label: 'Teilweise bewölkt',           icon: '⛅' },
    3:  { label: 'Bedeckt',                     icon: '☁️' },
    45: { label: 'Nebel',                       icon: '🌫️' },
    48: { label: 'Gefrierender Nebel',          icon: '🌫️' },
    51: { label: 'Leichter Nieselregen',        icon: '🌦️' },
    53: { label: 'Nieselregen',                 icon: '🌦️' },
    55: { label: 'Starker Nieselregen',         icon: '🌧️' },
    56: { label: 'Gefrierender Nieselregen',    icon: '🌧️' },
    57: { label: 'Starker gefrierender Nieselregen', icon: '🌧️' },
    61: { label: 'Leichter Regen',              icon: '🌧️' },
    63: { label: 'Regen',                       icon: '🌧️' },
    65: { label: 'Starker Regen',               icon: '🌧️' },
    66: { label: 'Gefrierender Regen',          icon: '🌨️' },
    67: { label: 'Starker gefrierender Regen',  icon: '🌨️' },
    71: { label: 'Leichter Schneefall',         icon: '🌨️' },
    73: { label: 'Schneefall',                  icon: '❄️' },
    75: { label: 'Starker Schneefall',          icon: '❄️' },
    77: { label: 'Schneegriesel',               icon: '🌨️' },
    80: { label: 'Leichte Regenschauer',        icon: '🌦️' },
    81: { label: 'Regenschauer',                icon: '🌧️' },
    82: { label: 'Starke Regenschauer',         icon: '⛈️' },
    85: { label: 'Schneeschauer',               icon: '🌨️' },
    86: { label: 'Starke Schneeschauer',        icon: '❄️' },
    95: { label: 'Gewitter',                    icon: '⛈️' },
    96: { label: 'Gewitter mit Hagel',          icon: '⛈️' },
    99: { label: 'Gewitter mit starkem Hagel',  icon: '⛈️' },
};

function getWMO(code) {
    return WMO[code] || { label: 'Unbekannt', icon: '🌡️' };
}

// ---- Wochentag-Labels ----
const DAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return DAYS_DE[d.getDay()];
}

function isToday(dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
}

// ---- Zustand ----
let map;
let marker = null;
let lastLat = null;
let lastLon = null;
let searchDebounce = null;

// ---- DOM-Referenzen ----
const els = {
    welcomeState:  document.getElementById('welcomeState'),
    loadingState:  document.getElementById('loadingState'),
    errorState:    document.getElementById('errorState'),
    weatherContent: document.getElementById('weatherContent'),
    errorMessage:  document.getElementById('errorMessage'),
    lastUpdate:    document.getElementById('lastUpdate'),
    locationName:  document.getElementById('locationName'),
    locationCountry: document.getElementById('locationCountry'),
    currentIcon:   document.getElementById('currentIcon'),
    currentTemp:   document.getElementById('currentTemp'),
    currentDesc:   document.getElementById('currentDesc'),
    feelsLike:     document.getElementById('feelsLike'),
    precipitation: document.getElementById('precipitation'),
    windSpeed:     document.getElementById('windSpeed'),
    humidity:      document.getElementById('humidity'),
    forecastGrid:  document.getElementById('forecastGrid'),
    searchInput:   document.getElementById('searchInput'),
    searchBtn:     document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
};

// ---- UI-Zustands-Steuerung ----
function showState(stateName) {
    ['welcomeState', 'loadingState', 'errorState', 'weatherContent'].forEach(id => {
        const el = els[id];
        if (!el) return;
        if (id === stateName) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

function showError(msg) {
    els.errorMessage.textContent = msg;
    showState('errorState');
}

// ---- Karte initialisieren ----
function initMap() {
    map = L.map('map', {
        center: CONFIG.mapCenter,
        zoom:   CONFIG.mapZoom,
        minZoom: CONFIG.minZoom,
        maxZoom: CONFIG.maxZoom,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);

    // Klick-Handler
    map.on('click', (e) => {
        loadWeatherForCoords(e.latlng.lat, e.latlng.lng);
    });
}

// ---- Marker setzen ----
function setMarker(lat, lon, cityName) {
    if (marker) {
        map.removeLayer(marker);
    }
    marker = L.marker([lat, lon]).addTo(map);
    if (cityName) {
        marker.bindPopup(`
            <div class="weather-marker-popup">
                <div class="popup-city">${cityName}</div>
            </div>
        `).openPopup();
    }
}

// ---- Wetterdaten laden ----
async function loadWeatherForCoords(lat, lon, cityName) {
    lastLat = lat;
    lastLon = lon;

    showState('loadingState');

    // Karte ggf. sanft zentrieren
    if (map.getZoom() < 5) {
        map.setView([lat, lon], 6, { animate: true });
    } else {
        map.panTo([lat, lon], { animate: true });
    }

    // Reverse Geocoding falls kein Stadtname
    let displayName = cityName;
    if (!displayName) {
        displayName = await reverseGeocode(lat, lon);
    }

    // Open-Meteo API aufrufen
    const params = new URLSearchParams({
        latitude:    lat.toFixed(4),
        longitude:   lon.toFixed(4),
        daily:       [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_sum',
            'sunrise',
            'sunset',
            'uv_index_max',
        ].join(','),
        hourly:      [
            'temperature_2m',
            'apparent_temperature',
            'precipitation',
            'wind_speed_10m',
            'visibility',
            'weather_code',
            'pressure_msl',
        ].join(','),
        current:     [
            'temperature_2m',
            'apparent_temperature',
            'precipitation',
            'wind_speed_10m',
            'visibility',
            'weather_code',
            'uv_index',
            'pressure_msl',
            'relative_humidity_2m',
        ].join(','),
        wind_speed_unit:    'kmh',
        timezone:           'auto',
        forecast_days:      7,
        past_hours:         24,
    });

    // Wetter + Luftqualität + Warnungen parallel laden
    const [weatherResult, airResult, warnResult] = await Promise.allSettled([
        fetch(`${CONFIG.weatherUrl}?${params}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        fetchAirQuality(lat, lon),
        fetchWarnings(lat, lon),
    ]);

    if (weatherResult.status === 'fulfilled') {
        const data = weatherResult.value;
        renderWeather(data, displayName, lat, lon);
        renderUV(data);
        renderBio(data, airResult.status === 'fulfilled' ? airResult.value : null);
    } else {
        console.error('Wetterfehler:', weatherResult.reason);
        showError('Wetterdaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung.');
    }

    const pressure = weatherResult.status === 'fulfilled'
        ? (weatherResult.value?.current?.pressure_msl ?? null)
        : null;

    if (airResult.status === 'fulfilled' && airResult.value) {
        renderAir(airResult.value, pressure);
    }

    renderWarnings(warnResult.status === 'fulfilled' ? warnResult.value : null);
}

// ---- Reverse Geocoding ----
async function reverseGeocode(lat, lon) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'de' } });
        if (!resp.ok) return `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;
        const data = await resp.json();
        const addr = data.address || {};
        return addr.city || addr.town || addr.village || addr.county || data.display_name.split(',')[0];
    } catch {
        return `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;
    }
}

// ---- Wetter rendern ----
function renderWeather(data, cityName, lat, lon) {
    const cur = data.current;
    const daily = data.daily;

    const wmo = getWMO(cur.weather_code);

    // Ort
    els.locationName.textContent   = cityName;
    els.locationCountry.textContent = '';   // optional: Land aus Geocoding

    // Aktuell
    els.currentIcon.textContent    = wmo.icon;
    els.currentTemp.textContent    = `${Math.round(cur.temperature_2m)}°C`;
    els.currentDesc.textContent    = wmo.label;
    els.feelsLike.textContent      = `${Math.round(cur.apparent_temperature)}°C`;
    els.precipitation.textContent  = cur.precipitation != null ? `${cur.precipitation} mm` : '—';
    els.windSpeed.textContent      = cur.wind_speed_10m != null ? `${Math.round(cur.wind_speed_10m)} km/h` : '—';

    // Sichtweite (in Meter → km)
    const vis = cur.visibility;
    if (vis != null) {
        const visKm = (vis / 1000).toFixed(1);
        els.humidity.textContent = visKm >= 10 ? '>10 km' : `${visKm} km`;
    } else {
        els.humidity.textContent = '—';
    }

    // ---- Stündliche Vorhersage (nächste 24h) ----
    const hourly      = data.hourly;
    const _now = new Date();
    const _pad = n => String(n).padStart(2, '0');
    const nowHour = `${_now.getFullYear()}-${_pad(_now.getMonth()+1)}-${_pad(_now.getDate())}T${_pad(_now.getHours())}`; // lokale Zeit
    const startIdx    = (hourly.time || []).findIndex(t => t.startsWith(nowHour));
    const fromIdx     = startIdx >= 0 ? startIdx : 0;
    const hourlySlice = (hourly.time || []).slice(fromIdx, fromIdx + 24);

    // Container erzeugen (oder vorhandenen leeren)
    let hourlySection = document.getElementById('hourlySection');
    if (!hourlySection) {
        hourlySection = document.createElement('div');
        hourlySection.id = 'hourlySection';
        // Nach current-weather einfügen
        const currentWeatherEl = document.querySelector('.current-weather');
        currentWeatherEl.insertAdjacentElement('afterend', hourlySection);
    }

    hourlySection.innerHTML = `
        <div class="section-divider"><span>Nächste 24 Stunden</span></div>
        <div class="hourly-scroll">
            <div class="hourly-strip" id="hourlyStrip"></div>
        </div>
    `;

    const strip = document.getElementById('hourlyStrip');
    hourlySlice.forEach((timeStr, i) => {
        const idx      = fromIdx + i;
        const code     = hourly.weather_code[idx];
        const temp     = hourly.temperature_2m[idx];
        const prec     = hourly.precipitation[idx];
        const wmoH     = getWMO(code);
        const hour     = timeStr.slice(11, 16); // "14:00"
        const isNow    = i === 0;

        const card = document.createElement('div');
        card.className = 'hourly-card' + (isNow ? ' current-hour' : '');
        card.innerHTML = `
            <div class="hourly-time">${isNow ? 'Jetzt' : hour}</div>
            <div class="hourly-icon">${wmoH.icon}</div>
            <div class="hourly-temp">${Math.round(temp)}°</div>
            ${prec > 0 ? `<div class="hourly-precip">💧${prec.toFixed(1)}</div>` : ''}
        `;
        strip.appendChild(card);
    });

    // Marker aktualisieren
    setMarker(lat, lon, cityName);

    // 7-Tage-Vorhersage
    els.forecastGrid.innerHTML = '';
    const days = daily.time || [];
    days.forEach((dateStr, i) => {
        const code  = daily.weather_code[i];
        const tMax  = daily.temperature_2m_max[i];
        const tMin  = daily.temperature_2m_min[i];
        const prec  = daily.precipitation_sum[i];
        const wmoD  = getWMO(code);
        const today = isToday(dateStr);

        const card = document.createElement('div');
        card.className = 'forecast-card' + (today ? ' today' : '');

        const dayLabel = today ? 'Heute' : formatDate(dateStr);
        const precText = prec > 0 ? `💧 ${prec.toFixed(1)} mm` : '';

        card.innerHTML = `
            <div class="forecast-day">${dayLabel}</div>
            <div class="forecast-icon">${wmoD.icon}</div>
            <div class="forecast-bar-wrapper">
                <div class="forecast-desc">${wmoD.label}</div>
                ${precText ? `<div class="forecast-precip">${precText}</div>` : ''}
            </div>
            <div class="forecast-temps">
                <span class="temp-max">${Math.round(tMax)}°</span>
                <span class="temp-min">${Math.round(tMin)}°</span>
            </div>
        `;
        els.forecastGrid.appendChild(card);
    });

    // Zeitstempel
    const now = new Date();
    els.lastUpdate.textContent = `Stand: ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;

    showState('weatherContent');

    // Auf Smartphone: Panel einblenden
    if (window.matchMedia('(max-width: 768px)').matches) {
        showPanel();
    }
}

// ---- Suche ----
async function searchCity(query) {
    if (!query || query.length < 2) {
        els.searchResults.innerHTML = '';
        els.searchResults.classList.add('hidden');
        return;
    }

    try {
        const params = new URLSearchParams({
            q:              query,
            format:         'json',
            limit:          6,
            featuretype:    'city',
            'accept-language': 'de',
        });
        const resp = await fetch(`${CONFIG.geocodeUrl}?${params}`, {
            headers: { 'Accept-Language': 'de' }
        });
        if (!resp.ok) throw new Error('Geocoding fehlgeschlagen');
        const results = await resp.json();

        els.searchResults.innerHTML = '';

        if (!results.length) {
            const li = document.createElement('li');
            li.textContent = 'Kein Ergebnis gefunden.';
            li.style.color = 'var(--text-muted)';
            li.style.cursor = 'default';
            els.searchResults.appendChild(li);
        } else {
            results.forEach(r => {
                const li = document.createElement('li');
                const parts = r.display_name.split(', ');
                const city    = parts[0];
                const country = parts[parts.length - 1];
                li.innerHTML = `${city} <span class="result-country">${country}</span>`;
                li.addEventListener('click', () => {
                    els.searchInput.value = city;
                    els.searchResults.innerHTML = '';
                    els.searchResults.classList.add('hidden');
                    loadWeatherForCoords(parseFloat(r.lat), parseFloat(r.lon), city);
                });
                els.searchResults.appendChild(li);
            });
        }
        els.searchResults.classList.remove('hidden');
    } catch (err) {
        console.error('Suchfehler:', err);
    }
}

// ---- Event-Handler ----
els.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => searchCity(e.target.value.trim()), CONFIG.searchDelay);
});

els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(searchDebounce);
        searchCity(els.searchInput.value.trim());
    }
    if (e.key === 'Escape') {
        els.searchResults.innerHTML = '';
        els.searchResults.classList.add('hidden');
    }
});

els.searchBtn.addEventListener('click', () => {
    clearTimeout(searchDebounce);
    searchCity(els.searchInput.value.trim());
});

// Suche schließen bei Klick außerhalb
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        els.searchResults.innerHTML = '';
        els.searchResults.classList.add('hidden');
    }
});

// ---- Standort-Button ----
const locateBtn = document.getElementById('locateBtn');

locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert('Dein Browser unterstützt keine Standorterkennung.');
        return;
    }
    locateBtn.classList.add('locating');
    locateBtn.title = 'Standort wird ermittelt...';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            locateBtn.classList.remove('locating');
            locateBtn.title = 'Meinen Standort anzeigen';
            map.setView([pos.coords.latitude, pos.coords.longitude], 10, { animate: true });
            loadWeatherForCoords(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
            locateBtn.classList.remove('locating');
            locateBtn.title = 'Meinen Standort anzeigen';
            if (err.code === err.PERMISSION_DENIED) {
                alert('Standortzugriff wurde verweigert. Bitte erlaube den Zugriff in deinen Browser-Einstellungen.');
            } else {
                alert('Standort konnte nicht ermittelt werden.');
            }
        },
        { timeout: 8000, enableHighAccuracy: true }
    );
});

// ---- Retry ----
function retryLastLocation() {
    if (lastLat !== null && lastLon !== null) {
        loadWeatherForCoords(lastLat, lastLon);
    }
}

// Globally accessible for inline onclick
window.retryLastLocation = retryLastLocation;

// ---- Standort-Erkennung beim Start (optional) ----
function tryGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            loadWeatherForCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
            // Kein Zugriff - einfach Willkommensstate lassen
        },
        { timeout: 5000 }
    );
}

// ---- Panel Toggle (Tippen auf Handle oder Button) ----
const dragHandle   = document.getElementById('dragHandle');
const weatherPanel = document.getElementById('weatherPanel');
const mapToggleBtn = document.getElementById('mapToggleBtn');
const mapWrapper   = document.querySelector('.map-wrapper');

let panelVisible = true;

function setMapHeight(vh) {
    mapWrapper.style.transition = 'height 0.3s ease';
    mapWrapper.style.height = vh + 'vh';
    setTimeout(() => { mapWrapper.style.transition = ''; map.invalidateSize(); }, 320);
}

function showPanel() {
    panelVisible = true;
    document.body.classList.remove('panel-hidden');
    setMapHeight(38);
    mapToggleBtn.textContent = '🗕';
    mapToggleBtn.title = 'Panel ausblenden';
}

function hidePanel() {
    panelVisible = false;
    document.body.classList.add('panel-hidden');
    setTimeout(() => { map.invalidateSize(); }, 50);
    mapToggleBtn.textContent = '⛶';
    mapToggleBtn.title = 'Panel einblenden';
}

function togglePanel() {
    if (panelVisible) {
        hidePanel();
    } else {
        showPanel();
    }
}

// Tippen auf den Handle-Balken (Click für Desktop/Tap)
dragHandle.addEventListener('click', togglePanel);

// ---- Drag-to-Resize (Mobile Touch) ----
let touchStartY    = null;
let touchStartMapH = null;
let isDragging     = false;

// Snap-Positionen: Kartenanteil in vh
const SNAP_VH = [18, 38, 55]; // klein=großes Panel, mittel, groß=kleines Panel

dragHandle.addEventListener('touchstart', (e) => {
    touchStartY    = e.touches[0].clientY;
    touchStartMapH = mapWrapper.getBoundingClientRect().height;
    isDragging     = false;
    // Panel einblenden falls versteckt
    if (!panelVisible) {
        document.body.classList.remove('panel-hidden');
        panelVisible   = true;
        touchStartMapH = window.innerHeight * 0.55;
    }
}, { passive: true });

dragHandle.addEventListener('touchmove', (e) => {
    if (touchStartY === null) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (!isDragging && Math.abs(dy) > 8) isDragging = true;
    if (!isDragging) return;

    const newMapVh = Math.max(10, Math.min(88,
        ((touchStartMapH + dy) / window.innerHeight) * 100
    ));
    mapWrapper.style.transition = 'none';
    mapWrapper.style.height     = newMapVh + 'vh';
    map.invalidateSize();
    e.preventDefault();
}, { passive: false });

dragHandle.addEventListener('touchend', (e) => {
    if (!isDragging || touchStartY === null) {
        touchStartY = null; touchStartMapH = null; isDragging = false;
        return; // war ein Tap → click-Event läuft normal
    }
    e.preventDefault(); // Verhindert click nach Drag

    const currentVh = (mapWrapper.getBoundingClientRect().height / window.innerHeight) * 100;

    if (currentVh > 72) {
        // Weit runter gezogen → Panel ausblenden
        hidePanel();
    } else {
        // Zum nächsten Snap-Punkt snappen
        const target = SNAP_VH.reduce((a, b) =>
            Math.abs(b - currentVh) < Math.abs(a - currentVh) ? b : a
        );
        mapWrapper.style.transition = 'height 0.25s ease';
        mapWrapper.style.height     = target + 'vh';
        panelVisible = true;
        document.body.classList.remove('panel-hidden');
        setTimeout(() => { mapWrapper.style.transition = ''; map.invalidateSize(); }, 270);
    }
    touchStartY = null; touchStartMapH = null; isDragging = false;
}, { passive: false });

// Toggle-Button
mapToggleBtn.addEventListener('click', togglePanel);

// ---- App starten (am Ende des Files) ----


// =====================================================
// TAB-SWITCHING
// =====================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

        // Mobile: Panel bei Inhalts-Tabs automatisch vergrößern
        if (window.matchMedia('(max-width: 768px)').matches) {
            if (!panelVisible) showPanel();
            if (btn.dataset.tab === 'wetter') {
                setMapHeight(55); // Standard
            } else {
                setMapHeight(20); // Großes Panel für Luft, Mond, UV
            }
        }
    });
});

// =====================================================
// LUFTQUALITÄT (Open-Meteo Air Quality API)
// =====================================================
async function fetchAirQuality(lat, lon) {
    try {
        const p = new URLSearchParams({
            latitude:  lat.toFixed(4),
            longitude: lon.toFixed(4),
            current:   'european_aqi,pm10,pm2_5,ozone,nitrogen_dioxide',
            hourly:    'alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen',
            timezone:  'auto',
            forecast_days: '1',
        });
        const r = await fetch(`${CONFIG.airUrl}?${p}`);
        if (!r.ok) return null;
        return r.json();
    } catch { return null; }
}

function renderAir(data, pressure) {
    const cur = data.current || {};
    const aqi = cur.european_aqi != null ? cur.european_aqi : null;

    function aqiInfo(v) {
        if (v == null) return { label: 'Keine Daten', color: 'var(--text-muted)' };
        if (v <= 20)  return { label: 'Sehr gut',        color: '#22c55e' };
        if (v <= 40)  return { label: 'Gut',             color: '#86efac' };
        if (v <= 60)  return { label: 'Mäßig',           color: '#eab308' };
        if (v <= 80)  return { label: 'Schlecht',        color: '#f97316' };
        if (v <= 100) return { label: 'Sehr schlecht',   color: '#ef4444' };
        return { label: 'Extrem schlecht', color: '#a855f7' };
    }
    const info = aqiInfo(aqi);
    const pct  = aqi != null ? Math.min(aqi, 100) : 0;

    // Pollen: aktuelle Stunde ermitteln
    const hourly = data.hourly || {};
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const nowH = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}`;
    const times = hourly.time || [];
    let hIdx = times.findIndex(t => t.startsWith(nowH));
    if (hIdx < 0) hIdx = 0;

    const pollenTypes = [
        { key: 'alder_pollen',   name: 'Erle'     },
        { key: 'birch_pollen',   name: 'Birke'    },
        { key: 'grass_pollen',   name: 'Gräser'   },
        { key: 'mugwort_pollen', name: 'Beifuß'   },
        { key: 'ragweed_pollen', name: 'Ambrosia' },
    ];

    function pollenLevel(v) {
        if (!v || v === 0) return { label: 'Keine',      color: '#22c55e', pct: 0   };
        if (v <= 10)       return { label: 'Gering',     color: '#86efac', pct: 10  };
        if (v <= 30)       return { label: 'Mäßig',      color: '#eab308', pct: 35  };
        if (v <= 100)      return { label: 'Hoch',       color: '#f97316', pct: 70  };
        return               { label: 'Sehr hoch',   color: '#ef4444', pct: 100 };
    }

    const pollenHtml = pollenTypes.map(p => {
        const val = (hourly[p.key] || [])[hIdx] || 0;
        const lvl = pollenLevel(val);
        return `<div class="pollen-item">
            <span class="pollen-name">${p.name}</span>
            <div class="pollen-bar-wrap"><div class="pollen-bar-fill" style="width:${lvl.pct}%;background:${lvl.color}"></div></div>
            <span class="pollen-level-label">${lvl.label}</span>
        </div>`;
    }).join('');

    document.getElementById('luftContent').innerHTML = `
        <div class="luft-wrapper">
            <div class="aqi-card">
                <div class="aqi-header">
                    <div>
                        <div class="aqi-subtitle">Europäischer Luftqualitätsindex</div>
                        <div class="aqi-label-text" style="color:${info.color}">${info.label}</div>
                    </div>
                    <div class="aqi-value-big" style="color:${info.color}">${aqi != null ? aqi : '—'}</div>
                </div>
                <div class="aqi-bar"><div class="aqi-pointer" style="left:${pct}%"></div></div>
                <div class="aqi-scale-labels"><span>0 Sehr gut</span><span>100 Extrem</span></div>
                <div class="pollutant-grid">
                    <div class="pollutant-item"><div class="pollutant-name">PM2.5</div><div class="pollutant-value">${cur.pm2_5 != null ? cur.pm2_5.toFixed(1) : '—'} µg/m³</div></div>
                    <div class="pollutant-item"><div class="pollutant-name">PM10</div><div class="pollutant-value">${cur.pm10 != null ? cur.pm10.toFixed(1) : '—'} µg/m³</div></div>
                    <div class="pollutant-item"><div class="pollutant-name">Ozon O₃</div><div class="pollutant-value">${cur.ozone != null ? cur.ozone.toFixed(0) : '—'} µg/m³</div></div>
                    <div class="pollutant-item"><div class="pollutant-name">NO₂</div><div class="pollutant-value">${cur.nitrogen_dioxide != null ? cur.nitrogen_dioxide.toFixed(1) : '—'} µg/m³</div></div>
                </div>
            </div>
            <div class="pressure-card">
                <div class="pressure-header">
                    <span class="pressure-label">🌡️ Luftdruck</span>
                    <span class="pressure-value">${pressure != null ? pressure.toFixed(0) + ' hPa' : '—'}</span>
                </div>
                <div class="pressure-desc">${pressure != null ? (pressure < 1000 ? 'Tief — wechselhaftes Wetter' : pressure < 1013 ? 'Wechselhaft' : 'Hoch — stabiles Wetter') : ''}</div>
            </div>
            <div class="section-divider"><span>Pollenflug heute</span></div>
            <div class="pollen-card">
                <div class="pollen-card-title">Pollenbelastung aktuell</div>
                ${pollenHtml}
            </div>
        </div>
    `;
    document.getElementById('luftWelcome').classList.add('hidden');
    document.getElementById('luftContent').classList.remove('hidden');
}

// =====================================================
// MONDKALENDER (reine JS-Berechnung, keine API nötig)
// =====================================================
function moonPhaseData(date) {
    const ref     = new Date('2000-01-06T18:14:00Z');
    const syn     = 29.53058867;
    const diff    = (date - ref) / 86400000;
    const age     = ((diff % syn) + syn) % syn;
    const illum   = Math.round((1 - Math.cos(age / syn * 2 * Math.PI)) / 2 * 100);
    let emoji, name;
    if      (age < 1.85)  { emoji = '🌑'; name = 'Neumond'; }
    else if (age < 7.38)  { emoji = '🌒'; name = 'Zunehmende Sichel'; }
    else if (age < 9.22)  { emoji = '🌓'; name = 'Erstes Viertel'; }
    else if (age < 14.77) { emoji = '🌔'; name = 'Zunehmender Mond'; }
    else if (age < 16.61) { emoji = '🌕'; name = 'Vollmond'; }
    else if (age < 22.15) { emoji = '🌖'; name = 'Abnehmender Mond'; }
    else if (age < 23.99) { emoji = '🌗'; name = 'Letztes Viertel'; }
    else                  { emoji = '🌘'; name = 'Abnehmende Sichel'; }
    const dToFull = age < 14.77 ? Math.round(14.77 - age) : Math.round(syn - age + 14.77);
    const dToNew  = age < 0.5   ? 0 : Math.round(syn - age);
    return { age, illum, emoji, name, dToFull, dToNew };
}

function moonEmoji(age) {
    if (age < 1.85)  return '🌑';
    if (age < 7.38)  return '🌒';
    if (age < 9.22)  return '🌓';
    if (age < 14.77) return '🌔';
    if (age < 16.61) return '🌕';
    if (age < 22.15) return '🌖';
    if (age < 23.99) return '🌗';
    return '🌘';
}

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function renderMoon() {
    const today = new Date();
    const m     = moonPhaseData(today);
    const year  = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWd     = new Date(year, month, 1).getDay();
    const offset      = (firstWd + 6) % 7; // Woche startet Montag

    let calHtml = '<div class="moon-cal-grid">';
    ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d => {
        calHtml += `<div class="moon-cal-wd">${d}</div>`;
    });
    for (let i = 0; i < offset; i++) calHtml += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const md   = moonPhaseData(new Date(year, month, d, 12));
        const isT  = d === today.getDate();
        calHtml += `<div class="moon-cal-day${isT ? ' today' : ''}">
            <div class="moon-cal-num">${d}</div>
            <div class="moon-cal-icon">${moonEmoji(md.age)}</div>
        </div>`;
    }
    calHtml += '</div>';

    document.getElementById('mondContent').innerHTML = `
        <div class="mond-wrapper">
            <div class="moon-card">
                <span class="moon-emoji-big">${m.emoji}</span>
                <div class="moon-phase-name">${m.name}</div>
                <div class="moon-illumination">Beleuchtung: ${m.illum}%</div>
                <div class="moon-next-grid">
                    <div class="moon-next-item">
                        <div class="moon-next-label">🌕 Nächster Vollmond</div>
                        <div class="moon-next-value">in ${m.dToFull} Tagen</div>
                    </div>
                    <div class="moon-next-item">
                        <div class="moon-next-label">🌑 Nächster Neumond</div>
                        <div class="moon-next-value">in ${m.dToNew} Tagen</div>
                    </div>
                </div>
            </div>
            <div class="section-divider"><span>Mondkalender ${MONTHS_DE[month]} ${year}</span></div>
            <div class="moon-calendar-card">
                <div class="moon-cal-title"></div>
                ${calHtml}
            </div>
        </div>
    `;
}

// =====================================================
// UV-INDEX & SONNE
// =====================================================
function renderUV(data) {
    const cur    = data.current || {};
    const daily  = data.daily   || {};
    const uv     = cur.uv_index != null ? cur.uv_index : null;
    const uvMax  = (daily.uv_index_max || [])[0];
    const sunrise = (daily.sunrise || [])[0];
    const sunset  = (daily.sunset  || [])[0];

    function uvInfo(v) {
        if (v == null) return { label: '—',          color: 'var(--text-muted)', adv: '' };
        if (v <= 2)    return { label: 'Niedrig',    color: '#22c55e', adv: 'Kein Schutz nötig' };
        if (v <= 5)    return { label: 'Mäßig',      color: '#eab308', adv: 'Sonnenschutz empfohlen' };
        if (v <= 7)    return { label: 'Hoch',       color: '#f97316', adv: 'Sonnenschutz notwendig' };
        if (v <= 10)   return { label: 'Sehr hoch',  color: '#ef4444', adv: 'Unbedingt Sonnenschutz!' };
        return           { label: 'Extrem',       color: '#a855f7', adv: 'Direkte Sonne meiden!' };
    }
    const info = uvInfo(uv);

    let arcHtml   = '<p style="color:var(--text-muted);text-align:center;padding:1rem">Standortdaten werden geladen...</p>';
    let statsHtml = '';

    if (sunrise && sunset) {
        // Zeiten direkt als Strings parsen (Open-Meteo liefert lokale Ortszeit)
        const srTime = sunrise.slice(11, 16); // "05:04"
        const ssTime = sunset.slice(11, 16);  // "19:22"
        const [srH, srMin] = srTime.split(':').map(Number);
        const [ssH, ssMin] = ssTime.split(':').map(Number);
        const srM  = srH * 60 + srMin;
        const ssM  = ssH * 60 + ssMin;
        // Aktuelle Ortszeit des gewählten Standorts via utc_offset_seconds
        const utcOffsetSec = data.utc_offset_seconds || 0;
        const nowAtLoc = new Date(Date.now() + utcOffsetSec * 1000);
        const nowM = nowAtLoc.getUTCHours() * 60 + nowAtLoc.getUTCMinutes();
        const total   = ssM - srM;
        const elapsed = Math.max(0, Math.min(1, (nowM - srM) / total));
        const isDaytime = nowM >= srM && nowM <= ssM;

        const cx = 150, cy = 85, r = 75;
        const sunAngle = Math.PI - elapsed * Math.PI;
        const sunX = cx + r * Math.cos(sunAngle);
        const sunY = cy - r * Math.sin(sunAngle);

        // SVG-Bogen
        const arcColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(148,163,184,0.2)';
        const pad = n => String(n).padStart(2, '0');
        const locTimeStr = pad(nowAtLoc.getUTCHours()) + ':' + pad(nowAtLoc.getUTCMinutes());
        arcHtml = `<svg class="sun-arc-svg" viewBox="0 0 300 120">
            <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}" fill="none" stroke="rgba(148,163,184,0.25)" stroke-width="3"/>
            <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${sunX.toFixed(1)} ${sunY.toFixed(1)}" fill="none" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
            <line x1="${cx-r-6}" y1="${cy}" x2="${cx+r+6}" y2="${cy}" stroke="rgba(148,163,184,0.2)" stroke-width="1"/>
            ${isDaytime
                ? `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="10" fill="#eab308" opacity="0.95"/>
                   <circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="18" fill="#eab308" opacity="0.12"/>`
                : `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="8" fill="none" stroke="#eab308" stroke-width="2" opacity="0.5"/>`
            }
            <text x="${cx-r}" y="${cy+16}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="sans-serif">${srTime}</text>
            <text x="${cx+r}" y="${cy+16}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="sans-serif">${ssTime}</text>
            <text x="${cx}" y="${cy-22}" text-anchor="middle" fill="var(--text-primary)" font-size="20" font-weight="bold" font-family="sans-serif">${locTimeStr}</text>
            <text x="${cx}" y="${cy-8}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="sans-serif">Lokale Zeit</text>
        </svg>`;

        const dayH = Math.floor(total / 60);
        const dayM = total % 60;
        statsHtml = `<div class="sun-stats-grid">
            <div class="sun-stat"><div class="sun-stat-label">🌅 Sonnenaufgang</div><div class="sun-stat-value">${srTime} Uhr</div></div>
            <div class="sun-stat"><div class="sun-stat-label">🌇 Sonnenuntergang</div><div class="sun-stat-value">${ssTime} Uhr</div></div>
            <div class="sun-stat"><div class="sun-stat-label">⏱️ Tageslänge</div><div class="sun-stat-value">${dayH}h ${dayM}min</div></div>
            <div class="sun-stat"><div class="sun-stat-label">☀️ UV max. heute</div><div class="sun-stat-value">${uvMax != null ? uvMax.toFixed(1) : '—'}</div></div>
        </div>`;
    }

    document.getElementById('uvContent').innerHTML = `
        <div class="uv-wrapper">
            <div class="uv-card">
                <div class="uv-value-row">
                    <div class="uv-number" style="color:${info.color}">${uv != null ? uv.toFixed(1) : '—'}</div>
                    <div>
                        <div class="uv-category" style="color:${info.color}">${info.label}</div>
                        <div class="uv-advice">${info.adv}</div>
                    </div>
                </div>
                <div class="uv-scale">
                    <div class="uv-scale-seg" style="background:#22c55e"></div>
                    <div class="uv-scale-seg" style="background:#eab308"></div>
                    <div class="uv-scale-seg" style="background:#f97316"></div>
                    <div class="uv-scale-seg" style="background:#ef4444"></div>
                    <div class="uv-scale-seg" style="background:#a855f7"></div>
                </div>
                <div class="uv-scale-labels"><span>0-2 Niedrig</span><span>3-5 Mäßig</span><span>6-7 Hoch</span><span>8-10 Sehr hoch</span><span>11+ Extrem</span></div>
            </div>
            <div class="section-divider"><span>Sonnenverlauf</span></div>
            <div class="sun-card">
                ${arcHtml}
                ${statsHtml}
            </div>
        </div>
    `;
    document.getElementById('uvWelcome').classList.add('hidden');
    document.getElementById('uvContent').classList.remove('hidden');
}

// =====================================================
// APP STARTEN — nach allen Definitionen
// =====================================================
initMap();
renderMoon();       // Mond braucht keinen Standort
tryGeolocation();   // Standort beim Laden (Browser fragt nach Erlaubnis)

// =====================================================
// WETTER-WARNUNGEN (Bright Sky API — DWD-Daten)
// =====================================================
async function fetchWarnings(lat, lon) {
    try {
        const r = await fetch(`${CONFIG.warnUrl}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
        if (!r.ok) return null;
        return r.json();
    } catch { return null; }
}

function renderWarnings(data) {
    const container = document.getElementById('warningsContainer');
    if (!container) return;

    const alerts = data && data.alerts ? data.alerts : [];

    // Nur aktive Warnungen (jetzt innerhalb onset–expires)
    const now = Date.now();
    const active = alerts.filter(a => {
        const onset   = a.onset   ? new Date(a.onset).getTime()   : 0;
        const expires = a.expires ? new Date(a.expires).getTime() : Infinity;
        return now >= onset && now <= expires;
    });

    if (!active.length) {
        container.innerHTML = '';
        return;
    }

    function sevColor(sev) {
        switch ((sev || '').toLowerCase()) {
            case 'minor':    return { bg: '#fefce8', border: '#eab308', text: '#854d0e', icon: '⚠️' };
            case 'moderate': return { bg: '#fff7ed', border: '#f97316', text: '#9a3412', icon: '🟠' };
            case 'severe':   return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '🔴' };
            case 'extreme':  return { bg: '#faf5ff', border: '#a855f7', text: '#6b21a8', icon: '🚨' };
            default:         return { bg: '#f0f9ff', border: '#38bdf8', text: '#075985', icon: 'ℹ️' };
        }
    }

    // Dark-Mode-Farben
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    container.innerHTML = active.map(a => {
        const c = sevColor(a.severity);
        const onset   = a.onset   ? new Date(a.onset).toLocaleString('de-DE',   {weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
        const expires = a.expires ? new Date(a.expires).toLocaleString('de-DE', {weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
        const bg     = isDark ? 'rgba(0,0,0,0.3)'   : c.bg;
        const border = c.border;
        const text   = isDark ? '#e2e8f0' : c.text;
        return `<div class="warning-card" style="background:${bg};border-left:4px solid ${border};color:${text}">
            <div class="warning-header">
                <span class="warning-icon">${c.icon}</span>
                <span class="warning-title">${a.headline || a.event || 'Wetterwarnung'}</span>
            </div>
            ${a.description ? `<div class="warning-desc">${a.description.slice(0, 200)}${a.description.length > 200 ? '…' : ''}</div>` : ''}
            <div class="warning-time">
                ${onset ? `Von: ${onset}` : ''}
                ${expires ? ` &nbsp;|&nbsp; Bis: ${expires}` : ''}
            </div>
        </div>`;
    }).join('');
}


// =====================================================
// BIO-WETTER
// =====================================================
function renderBio(data, airData) {
    const cur    = data.current  || {};
    const daily  = data.daily    || {};
    const hourly = data.hourly   || {};

    const temp     = cur.temperature_2m     ?? null;
    const humidity = cur.relative_humidity_2m ?? null;
    const wind     = cur.wind_speed_10m     ?? 0;
    const wcode    = cur.weather_code       ?? 0;

    // Aktuelle Stunde im Stunden-Array finden (inkl. past_days=1)
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const nowHour = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}`;
    const times = hourly.time || [];
    let hIdx = times.findIndex(t => t.startsWith(nowHour));
    if (hIdx < 0) hIdx = 24;

    // Luftdruck-Trend (Differenz jetzt vs. vor 24h)
    const pArr   = hourly.pressure_msl || [];
    const pNow   = pArr[hIdx]                        ?? null;
    const p24ago = pArr[Math.max(0, hIdx - 24)]      ?? null;
    const pressureDiff = (pNow != null && p24ago != null) ? (pNow - p24ago) : 0;

    // Temperatur-Schwankung heute (Max - Min)
    const tMax   = (daily.temperature_2m_max || [])[0] ?? null; // [0] = heute
    const tMin   = (daily.temperature_2m_min || [])[0] ?? null;
    const tSwing = (tMax != null && tMin != null) ? (tMax - tMin) : 0;

    // Temperaturwechsel zu morgen
    const tTomMax = (daily.temperature_2m_max || [])[1] ?? null;
    const tChange = (tMax != null && tTomMax != null) ? (tTomMax - tMax) : 0;

    // Pollen (Maximum aller Arten)
    const airH   = airData ? (airData.hourly || {}) : {};
    const airTimes = airH.time || [];
    let aIdx = airTimes.findIndex(t => t.startsWith(nowHour));
    if (aIdx < 0) aIdx = 0;
    const maxPollen = Math.max(
        (airH.alder_pollen   || [])[aIdx] || 0,
        (airH.birch_pollen   || [])[aIdx] || 0,
        (airH.grass_pollen   || [])[aIdx] || 0,
        (airH.mugwort_pollen || [])[aIdx] || 0,
        (airH.ragweed_pollen || [])[aIdx] || 0,
    );
    const ozone = airData ? ((airData.current || {}).ozone ?? 0) : 0;

    // Sonderbedingungen
    const hasThunder = wcode >= 95;
    const isFoehn    = tChange > 5 && humidity != null && humidity < 40 && wind > 20;

    // ---- SCORING ----
    // Kreislauf
    let kreislauf = 0;
    if (pressureDiff < -8)      kreislauf += 2;
    else if (pressureDiff < -3) kreislauf += 1;
    if (Math.abs(tChange) > 8)  kreislauf += 1;

    // Migräne / Kopf
    let migraene = 0;
    if (pressureDiff < -5)      migraene += 2;
    else if (pressureDiff < -2) migraene += 1;
    if (isFoehn)                migraene += 2;
    if (hasThunder)             migraene += 1;

    // Gelenke / Rheuma
    let gelenke = 0;
    if (temp != null && temp < 10 && pressureDiff < -3) gelenke += 2;
    else if (pressureDiff < -3)                         gelenke += 1;
    if (humidity != null && humidity > 80 && temp != null && temp < 12) gelenke += 1;

    // Atemwege
    let atemwege = 0;
    if (maxPollen > 30)                                 atemwege += 2;
    else if (maxPollen > 10)                            atemwege += 1;
    if (ozone > 120)                                    atemwege += 1;
    if (humidity != null && humidity < 30)              atemwege += 1;

    // Schlaf
    let schlaf = 0;
    if (tSwing > 12)            schlaf += 2;
    else if (tSwing > 8)        schlaf += 1;
    if (pressureDiff < -3)      schlaf += 1;
    if (humidity != null && humidity > 80) schlaf += 1;

    // ---- AMPEL ----
    function ampel(score) {
        if (score <= 0) return { label: 'Gering',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  dot: '🟢' };
        if (score === 1) return { label: 'Erhöht', color: '#eab308', bg: 'rgba(234,179,8,0.1)',   dot: '🟡' };
        return              { label: 'Hoch',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   dot: '🔴' };
    }

    function bioCard(icon, title, score, hint) {
        const a = ampel(score);
        return `<div class="bio-card" style="border-left:3px solid ${a.color};background:${a.bg}">
            <div class="bio-card-header">
                <span class="bio-icon">${icon}</span>
                <span class="bio-title">${title}</span>
                <span class="bio-level" style="color:${a.color}">${a.dot} ${a.label}</span>
            </div>
            <div class="bio-hint">${hint}</div>
        </div>`;
    }

    // Hinweis-Texte
    function kreislaufHint() {
        if (pressureDiff < -8) return 'Starker Druckabfall — Kreislauf kann belastet sein.';
        if (pressureDiff < -3) return 'Leichter Druckabfall spürbar.';
        if (Math.abs(tChange) > 8) return 'Großer Temperatursprung morgen.';
        return 'Stabile Bedingungen, kaum Kreislaufbelastung.';
    }
    function migraeneHint() {
        if (isFoehn) return 'Föhn-ähnliche Lage — typischer Migräne-Auslöser.';
        if (pressureDiff < -5) return 'Deutlicher Druckabfall — Risiko für Kopfschmerzen erhöht.';
        if (hasThunder) return 'Gewitter in der Nähe — elektrische Felder können Beschwerden auslösen.';
        if (pressureDiff < -2) return 'Leichter Druckabfall, bei Empfindlichkeit möglich.';
        return 'Keine typischen Migräne-Auslöser aktiv.';
    }
    function gelenkeHint() {
        if (temp != null && temp < 10 && pressureDiff < -3) return 'Kalt und fallender Druck — ungünstig für Gelenke und Rheuma.';
        if (humidity != null && humidity > 80) return 'Hohe Luftfeuchtigkeit kann Gelenke belasten.';
        if (pressureDiff < -3) return 'Druckabfall kann Gelenkschmerzen begünstigen.';
        return 'Keine besonderen Gelenkbelastungen.';
    }
    function atemwegeHint() {
        if (maxPollen > 30) return 'Hohe Pollenbelastung — Allergiker sollten vorsichtig sein.';
        if (ozone > 120) return 'Erhöhte Ozonwerte — Aufenthalt im Freien reduzieren.';
        if (humidity != null && humidity < 30) return 'Sehr trockene Luft — Atemwege können gereizt werden.';
        if (maxPollen > 10) return 'Mäßige Pollenbelastung vorhanden.';
        return 'Luft für Atemwege weitgehend unbelastet.';
    }
    function schlafHint() {
        if (tSwing > 12) return 'Große Temperaturschwankung heute — Schlaf kann unruhig sein.';
        if (tSwing > 8) return 'Spürbare Temperaturdifferenz zwischen Tag und Nacht.';
        if (humidity != null && humidity > 80) return 'Schwüle Luft kann den Schlaf beeinträchtigen.';
        if (pressureDiff < -3) return 'Wetterwechsel — kann den Schlaf leicht stören.';
        return 'Gute Schlafbedingungen erwartet.';
    }

    const pressureTrendText = pressureDiff > 0
        ? `+${pressureDiff.toFixed(1)} hPa` 
        : `${pressureDiff.toFixed(1)} hPa`;

    document.getElementById('bioContent').innerHTML = `
        <div class="bio-wrapper">
            <div class="bio-meta">
                <span>Luftdruck-Trend (24h): <strong>${pressureTrendText}</strong></span>
                <span>Feuchte: <strong>${humidity != null ? humidity + ' %' : '—'}</strong></span>
                <span>Tagesschwankung: <strong>${tSwing.toFixed(1)} °C</strong></span>
            </div>
            ${bioCard('🫀', 'Kreislauf',    Math.min(kreislauf, 2), kreislaufHint())}
            ${bioCard('🧠', 'Kopf / Migräne', Math.min(migraene, 2), migraeneHint())}
            ${bioCard('🦴', 'Gelenke',      Math.min(gelenke,   2), gelenkeHint())}
            ${bioCard('🫁', 'Atemwege',     Math.min(atemwege,  2), atemwegeHint())}
            ${bioCard('😴', 'Schlaf',       Math.min(schlaf,    2), schlafHint())}
            <p class="bio-disclaimer">Bio-Wetter basiert auf meteorologischen Schwellenwerten. Keine medizinische Aussage.</p>
        </div>
    `;
    document.getElementById('bioWelcome').classList.add('hidden');
    document.getElementById('bioContent').classList.remove('hidden');
}

// =====================================================
// SERVICE WORKER REGISTRIERUNG (PWA)
// =====================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW aktiv:', reg.scope))
            .catch(err => console.warn('SW Fehler:', err));
    });
}
