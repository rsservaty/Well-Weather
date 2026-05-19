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
        ].join(','),
        hourly:      [
            'temperature_2m',
            'apparent_temperature',
            'precipitation',
            'wind_speed_10m',
            'visibility',
            'weather_code',
        ].join(','),
        current:     [
            'temperature_2m',
            'apparent_temperature',
            'precipitation',
            'wind_speed_10m',
            'visibility',
            'weather_code',
        ].join(','),
        wind_speed_unit:    'kmh',
        timezone:           'auto',
        forecast_days:      7,
    });

    try {
        const resp = await fetch(`${CONFIG.weatherUrl}?${params}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        renderWeather(data, displayName, lat, lon);
    } catch (err) {
        console.error('Wetterfehler:', err);
        showError('Wetterdaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung.');
    }
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

    // Nach Ortsauswahl: Karte klein, Infos groß
    mapIsExpanded = false;
    setMapHeight(38);
    mapToggleBtn.textContent = '⛶';
    mapToggleBtn.title = 'Karte vergrößern';
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

// ---- Karten-Toggle (Smartphone) ----
const mapToggleBtn = document.getElementById('mapToggleBtn');
const mapWrapper   = document.querySelector('.map-wrapper');

let mapIsExpanded = false;

function setMapHeight(vh) {
    mapWrapper.style.height = vh + 'vh';
    setTimeout(() => map.invalidateSize(), 360);
}

mapToggleBtn.addEventListener('click', () => {
    mapIsExpanded = !mapIsExpanded;
    if (mapIsExpanded) {
        setMapHeight(90);
        mapToggleBtn.textContent = '🗕';
        mapToggleBtn.title = 'Karte verkleinern';
    } else {
        setMapHeight(38);
        mapToggleBtn.textContent = '⛶';
        mapToggleBtn.title = 'Karte vergrößern';
    }
});

// ---- App starten ----
initMap();
// Optionaler Standort beim Laden (Browser fragt nach Erlaubnis)
// tryGeolocation();
// Standardmäßig auskommentiert - kann Roland selbst aktivieren
