/* =====================================================
   WETTER EUROPA — app.js
   APIs: Open-Meteo (Wetter) + Nominatim (Geocoding)
   Karte: Leaflet + OpenStreetMap
   ===================================================== */

'use strict';

// ---- Konfiguration ----
const CONFIG = {
    mapCenter:    [51.5, 12.0],   // Mitteleuropa
    mapZoom:      8,
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

function weatherCardStyle(code, isDay) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let cat;
    if      (code === 0 || code === 1)                       cat = isDay ? 'sunny' : 'clear-night';
    else if (code === 2)                                     cat = 'partly-cloudy';
    else if (code === 3)                                     cat = 'overcast';
    else if (code === 45 || code === 48)                     cat = 'fog';
    else if (code >= 51 && code <= 67)                       cat = 'rain';
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) cat = 'snow';
    else if (code === 80 || code === 81)                     cat = 'rain';
    else if (code === 82)                                    cat = 'heavy-rain';
    else if (code >= 95)                                     cat = 'storm';
    else                                                     cat = 'partly-cloudy';

    const dark = {
        'sunny':         'linear-gradient(150deg, #0f2a48 0%, #1a3a5c 55%, #1e3d20 100%)',
        'clear-night':   'linear-gradient(150deg, #0a1228 0%, #101c42 55%, #0d1535 100%)',
        'partly-cloudy': 'linear-gradient(150deg, #1a2f4a 0%, #22354f 55%, #1e2d42 100%)',
        'overcast':      'linear-gradient(150deg, #1e2535 0%, #252d40 55%, #2a3245 100%)',
        'fog':           'linear-gradient(150deg, #222b3c 0%, #2d3848 55%, #343f52 100%)',
        'rain':          'linear-gradient(150deg, #0e1c2e 0%, #152438 55%, #1a2d40 100%)',
        'heavy-rain':    'linear-gradient(150deg, #0a1520 0%, #101e2e 55%, #152535 100%)',
        'snow':          'linear-gradient(150deg, #182438 0%, #223250 55%, #263d5a 100%)',
        'storm':         'linear-gradient(150deg, #0a0c1e 0%, #130f28 55%, #1a1535 100%)',
    };
    const light = {
        'sunny':         'linear-gradient(150deg, #fffde7 0%, #e3f2fd 55%, #fff8e1 100%)',
        'clear-night':   'linear-gradient(150deg, #e8eaf6 0%, #c5cae9 55%, #9fa8da 100%)',
        'partly-cloudy': 'linear-gradient(150deg, #e3f2fd 0%, #eceff1 55%, #e1f5fe 100%)',
        'overcast':      'linear-gradient(150deg, #eceff1 0%, #cfd8dc 55%, #b0bec5 100%)',
        'fog':           'linear-gradient(150deg, #f5f5f5 0%, #e0e0e0 55%, #d6d6d6 100%)',
        'rain':          'linear-gradient(150deg, #e3f2fd 0%, #bbdefb 55%, #90caf9 100%)',
        'heavy-rain':    'linear-gradient(150deg, #e8eaf6 0%, #c5cae9 55%, #9fa8da 100%)',
        'snow':          'linear-gradient(150deg, #e3f2fd 0%, #f1f8fe 55%, #e8f5e9 100%)',
        'storm':         'linear-gradient(150deg, #ede7f6 0%, #d1c4e9 55%, #b39ddb 100%)',
    };
    return (isDark ? dark : light)[cat] || (isDark ? dark : light)['overcast'];
}

function tempColorClass(t) {
    if (t <= 0)  return 'temp-cold';
    if (t <= 10) return 'temp-cool';
    if (t <= 18) return 'temp-mild';
    if (t <= 26) return 'temp-warm';
    if (t <= 32) return 'temp-hot';
    return 'temp-very-hot';
}

function tempHex(t) {
    if (t <= 0)  return '#60a5fa';
    if (t <= 10) return '#34d399';
    if (t <= 18) return '#a3e635';
    if (t <= 26) return '#fbbf24';
    if (t <= 32) return '#fb923c';
    return '#f87171';
}


// Zentrale Schwüle-Bewertung (genutzt in Wetter-Tab, Luft-Tab, Bio-Wetter)
function schwueleInfo(td) {
    if (td == null)  return { label: '—',                          color: 'var(--text-muted)', hint: '' };
    if (td >= 24)    return { label: 'Luft: tropisch, sehr belastend', color: '#ef4444', hint: '💧 Luft: tropisch, sehr belastend' };
    if (td >= 21)    return { label: 'Luft: sehr schwül, belastend',   color: '#f97316', hint: '💧 Luft: sehr schwül, belastend' };
    if (td >= 18)    return { label: 'Luft: schwül',                   color: '#eab308', hint: '💧 Luft: schwül' };
    if (td >= 16)    return { label: 'Luft: drückend, leicht schwül',  color: '#a3e635', hint: '💧 Luft: drückend, leicht schwül' };
    if (td >= 10)    return { label: 'Luft: angenehm/frisch',          color: '#22c55e', hint: '' };
    return             { label: 'Luft: trocken',                   color: '#22c55e', hint: '' };
}

// Zentrale UV-Bewertung (genutzt in Wetter-Tab + UV-Tab)
function uvInfo(v) {
    if (v == null) return { label: '—',         color: 'var(--text-muted)', adv: '' };
    if (v <= 2)    return { label: 'Niedrig',   color: '#22c55e', adv: '' };
    if (v <= 5)    return { label: 'Mäßig',     color: '#eab308', adv: 'Sonnenschutz empfohlen' };
    if (v <= 7)    return { label: 'Hoch',      color: '#f97316', adv: 'Sonnenschutz notwendig' };
    if (v <= 10)   return { label: 'Sehr hoch', color: '#ef4444', adv: 'Unbedingt Sonnenschutz!' };
    return           { label: 'Extrem',      color: '#a855f7', adv: 'Direkte Sonne meiden!' };
}

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
    currentTempMax: document.getElementById('currentTempMax'),
    currentTempMin: document.getElementById('currentTempMin'),
    currentDesc:   document.getElementById('currentDesc'),
    feelsLike:     document.getElementById('feelsLike'),
    precipitation: document.getElementById('precipitation'),
    windSpeed:     document.getElementById('windSpeed'),
    humidity:      document.getElementById('humidity'),
    tempTrend:     document.getElementById('tempTrend'),
    localTimeBadge: document.getElementById('localTimeBadge'),
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
    }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Klick-Handler
    map.on('click', (e) => {
        if (!panelVisible) {
            showPanel();
            setTimeout(() => { map.setZoom(9); }, 350);
        } else {
            map.setZoom(9);
        }
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
            'precipitation_probability_max',
            'sunrise',
            'sunset',
            'uv_index_max',
        ].join(','),
        hourly:      [
            'temperature_2m',
            'apparent_temperature',
            'precipitation',
            'precipitation_probability',
            'wind_speed_10m',
            'visibility',
            'weather_code',
            'pressure_msl',
            'relative_humidity_2m',
            'cloud_cover',
        ].join(','),
        current:     [
            'temperature_2m',
            'apparent_temperature',
            'precipitation',
            'precipitation_probability',
            'wind_speed_10m',
            'wind_direction_10m',
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
        const _cur = weatherResult.status === 'fulfilled' ? (weatherResult.value?.current || {}) : {};
        renderAir(airResult.value, pressure, _cur.temperature_2m ?? null, _cur.relative_humidity_2m ?? null, _cur.wind_speed_10m ?? null, _cur.wind_direction_10m ?? null);
    }

    renderWarnings(warnResult.status === 'fulfilled' ? warnResult.value : null);
}

// ---- Reverse Geocoding ----
async function reverseGeocode(lat, lon) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de,en`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'de,en' } });
        if (!resp.ok) return `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;
        const data = await resp.json();
        const addr = data.address || {};
        return addr.city || addr.town || addr.village || addr.county ||
               `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;
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

    // Temperaturtrend: Vergleich aktuell vs. in 3 Stunden
    if (els.tempTrend) {
        const hourly = data.hourly;
        const _tNow = new Date();
        const _tPad = n => String(n).padStart(2, '0');
        const nowH = `${_tNow.getFullYear()}-${_tPad(_tNow.getMonth()+1)}-${_tPad(_tNow.getDate())}T${_tPad(_tNow.getHours())}`;
        const nowIdx = (hourly.time || []).findIndex(t => t.startsWith(nowH));
        if (nowIdx >= 0 && nowIdx + 3 < (hourly.temperature_2m || []).length) {
            const tCur   = hourly.temperature_2m[nowIdx];
            const tFut   = hourly.temperature_2m[nowIdx + 3];
            const diff   = tFut - tCur;
            if (diff > 1.5) {
                els.tempTrend.textContent  = '↑';
                els.tempTrend.className    = 'temp-trend trend-up';
                els.tempTrend.title        = `+${diff.toFixed(1)}°C in 3h`;
            } else if (diff < -1.5) {
                els.tempTrend.textContent  = '↓';
                els.tempTrend.className    = 'temp-trend trend-down';
                els.tempTrend.title        = `${diff.toFixed(1)}°C in 3h`;
            } else {
                els.tempTrend.textContent  = '→';
                els.tempTrend.className    = 'temp-trend trend-stable';
                els.tempTrend.title        = 'Temperatur bleibt stabil';
            }
        } else {
            els.tempTrend.textContent = '';
        }
    }
    els.currentDesc.textContent    = wmo.label;
    // Tageshoch / Tagestief
    if (els.currentTempMax && els.currentTempMin) {
        const tMaxToday = (data.daily.temperature_2m_max || [])[0];
        const tMinToday = (data.daily.temperature_2m_min || [])[0];
        if (tMaxToday != null) {
            els.currentTempMax.textContent = `${Math.round(tMaxToday)}°`;
            els.currentTempMax.className = `temp-max ${tempColorClass(tMaxToday)}`;
        }
        if (tMinToday != null) {
            els.currentTempMin.textContent = `${Math.round(tMinToday)}°`;
        }
    }
    els.feelsLike.textContent      = `${Math.round(cur.apparent_temperature)}°C`;
    // Niederschlag: mm + stündliche Wahrscheinlichkeit
    {
        const hourly = data.hourly;
        const _pNow = new Date();
        const _pPad = n => String(n).padStart(2, '0');
        const _pH = `${_pNow.getFullYear()}-${_pPad(_pNow.getMonth()+1)}-${_pPad(_pNow.getDate())}T${_pPad(_pNow.getHours())}`;
        const _pIdx = (hourly.time || []).findIndex(t => t.startsWith(_pH));
        const prob = _pIdx >= 0 ? (hourly.precipitation_probability || [])[_pIdx] : null;
        els.precipitation.textContent = (prob != null && prob >= 20) ? `☔ ${prob}%` : '—';
    }
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

    // Schwüle für Wetter-Tab berechnen
    const _wTemp = cur.temperature_2m ?? null;
    const _wHum  = cur.relative_humidity_2m ?? null;
    let   _wSchwuele = '';
    if (_wTemp != null && _wHum != null) {
        const _wTd = _wTemp - (100 - _wHum) / 5;
        _wSchwuele = schwueleInfo(_wTd).hint;
    }

    // UV-Hinweis für Wetter-Tab (Tagesmax)
    const _uvMax = (daily.uv_index_max || [])[0] ?? null;
    let   _wUV = '';
    if (_uvMax != null) {
        const _uvAdv = uvInfo(_uvMax).adv;
        if (_uvAdv) _wUV = `🕶️ UV ${_uvMax} — ${_uvAdv}`;
    }

    hourlySection.innerHTML = `
        <div class="section-divider"><span>Nächste 24 Stunden</span></div>
        <div class="hourly-scroll">
            <div class="hourly-strip" id="hourlyStrip"></div>
        </div>
        ${_wSchwuele ? `<div class="schwuele-hint">${_wSchwuele}</div>` : ''}
        ${_wUV ? `<div class="schwuele-hint">${_wUV}</div>` : ''}
    `;

    const strip = document.getElementById('hourlyStrip');
    hourlySlice.forEach((timeStr, i) => {
        const idx      = fromIdx + i;
        const code     = hourly.weather_code[idx];
        const temp     = hourly.temperature_2m[idx];
        const prec     = hourly.precipitation[idx];
        const prob     = (hourly.precipitation_probability || [])[idx];
        const wmoH     = getWMO(code);
        const hour     = timeStr.slice(11, 16); // "14:00"
        const isNow    = i === 0;

        const card = document.createElement('div');
        card.className = 'hourly-card' + (isNow ? ' current-hour' : '');
        card.innerHTML = `
            <div class="hourly-time">${isNow ? 'Jetzt' : hour}</div>
            <div class="hourly-icon">${wmoH.icon}</div>
            <div class="hourly-temp ${tempColorClass(temp)}">${Math.round(temp)}°</div>
            ${prob != null && prob >= 20 ? `<div class="hourly-precip">☔${prob}%</div>` : ''}
        `;
        strip.appendChild(card);
    });

    // Lokale Ortszeit
    if (els.localTimeBadge) {
        const utcOff = data.utc_offset_seconds || 0;
        const locNow = new Date(Date.now() + utcOff * 1000);
        const pad = n => String(n).padStart(2, '0');
        const timeStr = pad(locNow.getUTCHours()) + ':' + pad(locNow.getUTCMinutes());
        els.localTimeBadge.textContent = '🕐 ' + timeStr + ' Uhr';
        els.localTimeBadge.style.display = '';
    }

    // Wetter-Kachel dynamischer Hintergrund
    const currentWeatherEl = document.querySelector('.current-weather');
    if (currentWeatherEl) {
        currentWeatherEl.style.background = weatherCardStyle(cur.weather_code, cur.is_day === 1);
    }

    // Marker aktualisieren
    setMarker(lat, lon, cityName);

    // 7-Tage-Vorhersage
    els.forecastGrid.innerHTML = '';
    const days = daily.time || [];

    // Gesamtbereich aller Tage für Balken-Normierung
    const allMax = daily.temperature_2m_max || [];
    const allMin = daily.temperature_2m_min || [];
    const weekMin = Math.min(...allMin.filter(v => v != null));
    const weekMax = Math.max(...allMax.filter(v => v != null));
    const weekRange = weekMax - weekMin || 1;

    days.forEach((dateStr, i) => {
        const code  = daily.weather_code[i];
        const tMax  = daily.temperature_2m_max[i];
        const tMin  = daily.temperature_2m_min[i];
        const prec  = daily.precipitation_sum[i];
        const prob  = (daily.precipitation_probability_max || [])[i];
        const wmoD  = getWMO(code);
        const today = isToday(dateStr);

        const card = document.createElement('div');
        card.className = 'forecast-card' + (today ? ' today' : '');

        const dayLabel = today ? 'Heute' : formatDate(dateStr);
        const precText = (prob != null && prob >= 20) ? `☔ ${prob}%` : '';

        // Temperaturbalken
        const barLeft  = ((tMin - weekMin) / weekRange * 100).toFixed(1);
        const barWidth = ((tMax - tMin)    / weekRange * 100).toFixed(1);
        const barGrad  = `linear-gradient(to right, ${tempHex(tMin)}, ${tempHex(tMax)})`;

        card.innerHTML = `
            <div class="forecast-day">${dayLabel}</div>
            <div class="forecast-icon">${wmoD.icon}</div>
            <div class="forecast-bar-wrapper">
                <div class="forecast-desc">${wmoD.label}</div>
                ${precText ? `<div class="forecast-precip">${precText}</div>` : ''}
                <div class="temp-bar-track">
                    <div class="temp-bar-fill" style="left:${barLeft}%;width:${barWidth}%;background:${barGrad}"></div>
                </div>
            </div>
            <div class="forecast-temps">
                <span class="temp-max ${tempColorClass(tMax)}">${Math.round(tMax)}°</span>
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
            'accept-language': 'de,en',
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
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.querySelector('[data-tab="wetter"]').classList.add('active');
                    document.getElementById('tab-wetter').classList.add('active');
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
            // Zum Wetter Tab wechseln
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('[data-tab="wetter"]').classList.add('active');
            document.getElementById('tab-wetter').classList.add('active');
            if (!panelVisible) showPanel();
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
    if (window.matchMedia('(max-width: 768px)').matches) {
        setMapHeight(28);
    } else {
        mapWrapper.style.height = '';
        setTimeout(() => {
            map.invalidateSize();
            if (marker) map.panTo(marker.getLatLng());
        }, 350);
    }
    mapToggleBtn.textContent = '🗕';
    mapToggleBtn.title = 'Panel ausblenden';
}

function hidePanel() {
    panelVisible = false;
    document.body.classList.add('panel-hidden');
    if (!window.matchMedia('(max-width: 768px)').matches) {
        mapWrapper.style.height = '';
    }
    setTimeout(() => {
        map.invalidateSize();
        map.setZoom(Math.max(map.getZoom() - 2, 6));
    }, 50);
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
const SNAP_VH = [18, 28, 50]; // klein=großes Panel, mittel, groß=kleines Panel

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
function closeBioCards() {
    document.querySelectorAll('.bio-card-toggle').forEach(card => {
        const detail = document.getElementById(card.dataset.detail);
        const arrow  = card.querySelector('.bio-arrow');
        if (detail) detail.style.display = 'none';
        if (arrow)  arrow.textContent = '▼';
    });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        closeBioCards();

        // Mobile: Panel anzeigen falls versteckt, aber Größe beibehalten
        if (window.matchMedia('(max-width: 768px)').matches) {
            if (!panelVisible) showPanel();
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

function renderAir(data, pressure, temp, humidity, windSpeed, windDir) {
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

    // Beaufort-Skala
    function beaufort(kmh) {
        if (kmh < 1)   return { bft: 0, label: 'Windstille' };
        if (kmh < 6)   return { bft: 1, label: 'Leichter Zug' };
        if (kmh < 12)  return { bft: 2, label: 'Leichte Brise' };
        if (kmh < 20)  return { bft: 3, label: 'Schwache Brise' };
        if (kmh < 29)  return { bft: 4, label: 'Mäßige Brise' };
        if (kmh < 39)  return { bft: 5, label: 'Frische Brise' };
        if (kmh < 50)  return { bft: 6, label: 'Starker Wind' };
        if (kmh < 62)  return { bft: 7, label: 'Steifer Wind' };
        if (kmh < 75)  return { bft: 8, label: 'Stürmischer Wind' };
        if (kmh < 89)  return { bft: 9, label: 'Sturm' };
        if (kmh < 103) return { bft: 10, label: 'Schwerer Sturm' };
        if (kmh < 117) return { bft: 11, label: 'Orkanartiger Sturm' };
        return           { bft: 12, label: 'Orkan' };
    }
    function windDirLabel(deg) {
        if (deg == null) return '—';
        const dirs = ['N','NO','O','SO','S','SW','W','NW'];
        return dirs[Math.round(deg / 45) % 8];
    }
    function windDirArrow(deg) {
        if (deg == null) return '';
        // Pfeil zeigt wohin der Wind weht (Richtung + 180°)
        const arrows = ['↓','↙','←','↖','↑','↗','→','↘'];
        return arrows[Math.round(deg / 45) % 8];
    }
    const bft = windSpeed != null ? beaufort(windSpeed) : null;
    const windDirStr   = windDirLabel(windDir);
    const windDirArr   = windDirArrow(windDir);

    // Schwüle berechnen (Taupunkt: Td ≈ T - (100 - RH) / 5)
    let dewPoint = null;
    let schwueleLabel = '—';
    let schwueleColor = 'var(--text-muted)';
    if (temp != null && humidity != null) {
        dewPoint = temp - (100 - humidity) / 5;
        const si = schwueleInfo(dewPoint);
        schwueleLabel = si.label;
        schwueleColor = si.color;
    }

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
            <div class="luft-conditions-row">
                <div class="luft-cond-item">
                    <span class="luft-cond-label">🌡️ Luftdruck</span>
                    <span class="luft-cond-value">${pressure != null ? pressure.toFixed(0) + ' hPa' : '—'}</span>
                    <span class="luft-cond-desc">${pressure != null ? (pressure < 1000 ? 'Tief' : pressure < 1013 ? 'Wechselhaft' : 'Hoch') : ''}</span>
                </div>
                <div class="luft-cond-item">
                    <span class="luft-cond-label">💧 Taupunkt</span>
                    <span class="luft-cond-value" style="color:${schwueleColor}">${dewPoint != null ? dewPoint.toFixed(0) + ' °C' : '—'}</span>
                    <span class="luft-cond-desc" style="color:${schwueleColor}">${schwueleLabel}</span>
                </div>
                <div class="luft-cond-item">
                    <span class="luft-cond-label">💦 Luftfeuchte</span>
                    <span class="luft-cond-value">${humidity != null ? humidity + ' %' : '—'}</span>
                    <span class="luft-cond-desc">${humidity != null ? (humidity < 30 ? 'Sehr trocken' : humidity < 50 ? 'Trocken' : humidity < 70 ? 'Angenehm' : humidity < 85 ? 'Feucht' : 'Sehr feucht') : ''}</span>
                </div>
            </div>
            <div class="wind-card">
                <div class="wind-card-header">
                    <span class="wind-card-label">💨 Wind</span>
                    <span class="wind-card-value">${windSpeed != null ? Math.round(windSpeed) + ' km/h' : '—'} <span class="wind-dir-arrow">${windDirArr}</span></span>
                </div>
                <div class="wind-card-row">
                    <span class="wind-bft">${bft ? 'Bft ' + bft.bft + ' — ' + bft.label : '—'}</span>
                    <span class="wind-dir-label">${windDirStr !== '—' ? 'aus ' + windDirStr : ''}</span>
                </div>
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
    const dToFull = age < 14.77 ? Math.round(14.77 - age) : (age < 16.61 ? 0 : Math.round(syn - age + 14.77));
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


// =====================================================
// STERNZEICHEN — Mond & Sonne
// =====================================================
const ZODIAC = [
    { name: 'Widder',     emoji: '♈', el: 'Feuer',
      tips: ['Haare schneiden fördert kräftiges Nachwachsen', 'Zwiebeln, Knoblauch und Lauch pflanzen', 'Rasen mähen für dichten Wuchs', 'Unkraut jäten — wächst weniger nach'],
      avoid: 'Wenig geeignet für Gießen und Blattpflanzen' },
    { name: 'Stier',      emoji: '♉', el: 'Erde',
      tips: ['Wurzelgemüse säen und ernten: Karotten, Rote Bete, Sellerie', 'Kartoffeln setzen oder ernten', 'Bäume und Sträucher pflanzen — gutes Anwachsen', 'Kompost einarbeiten und Beete mulchen'],
      avoid: 'Wenig geeignet für Blumenpflege' },
    { name: 'Zwillinge',  emoji: '♊', el: 'Luft',
      tips: ['Gartenwerkzeuge reinigen und schärfen', 'Kompost umschichten und belüften', 'Gartenplanung und Bestellungen erledigen', 'Schädlingsbekämpfung (mechanisch)'],
      avoid: 'Ungünstig für Säen, Pflanzen und Ernten' },
    { name: 'Krebs',      emoji: '♋', el: 'Wasser',
      tips: ['Blattpflanzen gießen — Wasser wird besonders gut aufgenommen', 'Salat, Spinat und Kohl säen oder pikieren', 'Kräuter wie Petersilie und Basilikum pflanzen', 'Zimmerpflanzen umtopfen und düngen'],
      avoid: 'Wenig geeignet für Wurzelarbeiten und Ernten' },
    { name: 'Löwe',       emoji: '♌', el: 'Feuer',
      tips: ['Obst und Früchte ernten — beste Haltbarkeit und Geschmack', 'Marmelade und Konserven einkochen', 'Obstbäume schneiden und pflegen', 'Samen sammeln und trocknen'],
      avoid: 'Wenig geeignet für Wurzelgemüse und Gießen' },
    { name: 'Jungfrau',   emoji: '♍', el: 'Erde',
      tips: ['Heilkräuter ernten — höchste Wirkstoffkonzentration', 'Gemüse für Vorrat einlagern und konservieren', 'Beete intensiv jäten und lockern', 'Düngen mit Kompost oder organischem Dünger'],
      avoid: 'Wenig geeignet für Blumenpflanzungen' },
    { name: 'Waage',      emoji: '♎', el: 'Luft',
      tips: ['Blumen pflanzen und Blumensträuße schneiden', 'Ziergehölze und Hecken schneiden', 'Rasen düngen und pflegen', 'Kletterpflanzen und Rosen binden'],
      avoid: 'Wenig geeignet für Gemüse säen' },
    { name: 'Skorpion',   emoji: '♏', el: 'Wasser',
      tips: ['Pilze suchen — ideale Bedingungen', 'Schädlinge und Unkraut effektiv bekämpfen', 'Beete zur Entgiftung und Bodenregeneration umgraben', 'Tiefwurzler wie Rote Bete und Pastinaken säen'],
      avoid: 'Wenig geeignet für empfindliche Jungpflanzen' },
    { name: 'Schütze',    emoji: '♐', el: 'Feuer',
      tips: ['Früchte und Samen für die Aufbewahrung ernten', 'Bäume und Sträucher zurückschneiden', 'Holz schlagen — trocknet besonders gut', 'Nüsse und Äpfel für den Winter einlagern'],
      avoid: 'Wenig geeignet für Blattpflanzen und Gießen' },
    { name: 'Steinbock',  emoji: '♑', el: 'Erde',
      tips: ['Wintergemüse wie Kohl und Rüben ernten', 'Wurzeln und Knollen für den Keller einlagern', 'Boden für die nächste Saison vorbereiten und kalken', 'Obstbäume und Beerensträucher schneiden'],
      avoid: 'Wenig geeignet für Blumen und Blattpflanzen' },
    { name: 'Wassermann', emoji: '♒', el: 'Luft',
      tips: ['Gartengeräte warten, ölen und reparieren', 'Gartenpläne für die nächste Saison erstellen', 'Bestellungen für Saatgut aufgeben', 'Gewächshaus und Frühbeet reinigen'],
      avoid: 'Ungünstig für Pflanzen, Säen und Ernten' },
    { name: 'Fische',     emoji: '♓', el: 'Wasser',
      tips: ['Blattpflanzen, Salat und Sprossen säen', 'Blumen und Wasserpflanzen pflegen', 'Kresse und Keimlinge ansetzen', 'Zimmerpflanzen intensiv gießen und besprühen'],
      avoid: 'Wenig geeignet für Wurzelgemüse ernten' },
];

const ELEMENT_COLOR = { 'Feuer': '#f97316', 'Erde': '#84cc16', 'Luft': '#38bdf8', 'Wasser': '#818cf8' };

function moonZodiacSign(date) {
    // Astronomische Berechnung der Mond-Ekliptiklänge (vereinfacht nach Meeus)
    const JD  = date.getTime() / 86400000 + 2440587.5;
    const T   = (JD - 2451545.0) / 36525;
    const rad = d => ((d % 360) + 360) % 360 * Math.PI / 180;

    const Lp  = 218.3164477 + 481267.88123421 * T;
    const D   = 297.8501921 + 445267.1114034  * T;
    const M   = 357.5291092 + 35999.0502909   * T;
    const Mp  = 134.9633964 + 477198.8675055  * T;
    const F   = 93.2720950  + 483202.0175233  * T;

    const SumL =
        6288774 * Math.sin(rad(Mp))
      + 1274027 * Math.sin(rad(2*D - Mp))
      +  658314 * Math.sin(rad(2*D))
      +  213618 * Math.sin(rad(2*Mp))
      -  185116 * Math.sin(rad(M))
      -  114332 * Math.sin(rad(2*F))
      +   58793 * Math.sin(rad(2*D - 2*Mp))
      +   57066 * Math.sin(rad(2*D - M - Mp))
      +   53322 * Math.sin(rad(2*D + Mp))
      +   45758 * Math.sin(rad(2*D - M))
      -   40923 * Math.sin(rad(M - Mp))
      -   34720 * Math.sin(rad(D))
      -   30383 * Math.sin(rad(M + Mp));

    const lon = ((Lp + SumL / 1000000) % 360 + 360) % 360;
    return ZODIAC[Math.floor(lon / 30)];
}

function sunZodiacSign(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    // [Monat, Tag ab dem, Index in ZODIAC]
    const boundaries = [
        [1,20,10],[2,19,11],[3,21,0],[4,20,1],[5,21,2],
        [6,21,3],[7,23,4],[8,23,5],[9,23,6],[10,23,7],[11,22,8],[12,22,9]
    ];
    let idx = 9; // Steinbock als default (Dez 22 - Jan 19 überspannt Jahreswechsel)
    for (const [bm, bd, zi] of boundaries) {
        if (m === bm && d >= bd) idx = zi;
        else if (m > bm) idx = zi;
    }
    // Korrektur: Jan vor dem 20. = Steinbock
    if (m === 1 && d < 20) idx = 9;
    return ZODIAC[idx];
}

function renderMoon() {
    const today    = new Date();
    const m        = moonPhaseData(today);
    const moonSign = moonZodiacSign(today);
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
        const isT  = d === today.getDate();
        const md   = isT ? m : moonPhaseData(new Date(year, month, d, 12));
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
            <div class="section-divider section-divider--large"><span>🌙 Mondkalender ${MONTHS_DE[month]} ${year}</span></div>
            <div class="moon-calendar-card">
                <div class="moon-cal-title"></div>
                ${calHtml}
            </div>
            <div class="section-divider section-divider--large"><span>🌱 Gartenkalender</span></div>
            <div class="zodiac-card">
                <div class="moon-garden-header">
                    <span class="moon-garden-day" style="color:${ELEMENT_COLOR[moonSign.el]}">${moonSign.el}tag</span>
                    <span class="moon-garden-sub">Heute günstig:</span>
                </div>
                <ul class="moon-garden-tips">
                    ${moonSign.tips.map(t => `<li>${t}</li>`).join('')}
                </ul>
                <div class="moon-garden-avoid">⚠️ ${moonSign.avoid}</div>
                <div class="moon-garden-source">Anbaumethode nach Maria Thun</div>
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

    // uvInfo() ist global definiert
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

    const infoMax = uvInfo(uvMax);
    document.getElementById('uvContent').innerHTML = `
        <div class="uv-wrapper">
            <div class="uv-card">
                <div class="uv-dual-row">
                    <div class="uv-dual-item">
                        <div class="uv-dual-label">Aktuell</div>
                        <div class="uv-number" style="color:${info.color}">${uv != null ? uv.toFixed(1) : '—'}</div>
                        <div class="uv-category" style="color:${info.color}">${info.label}</div>
                    </div>
                    <div class="uv-dual-divider"></div>
                    <div class="uv-dual-item">
                        <div class="uv-dual-label">Max. heute</div>
                        <div class="uv-number" style="color:${infoMax.color}">${uvMax != null ? uvMax.toFixed(1) : '—'}</div>
                        <div class="uv-category" style="color:${infoMax.color}">${infoMax.label}</div>
                    </div>
                </div>
                ${infoMax.adv ? `<div class="uv-advice-box">☀️ Heute: ${infoMax.adv}</div>` : ''}
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

    // Aktive + bevorstehende Warnungen (nächste 12h)
    const now = Date.now();
    const in12h = now + 12 * 60 * 60 * 1000;
    const relevant = alerts.filter(a => {
        const onset   = a.onset   ? new Date(a.onset).getTime()   : 0;
        const expires = a.expires ? new Date(a.expires).getTime() : Infinity;
        return onset <= in12h && expires >= now;
    }).sort((a, b) => (b.severity_level || 0) - (a.severity_level || 0) || new Date(a.onset) - new Date(b.onset));

    if (!relevant.length) {
        container.innerHTML = '';
        container.classList.remove('has-warnings');
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    container.classList.add('has-warnings');

    function eventIcon(event) {
        const e = (event || '').toLowerCase();
        if (e.includes('flood') || e.includes('hochwasser')) return '🌊';
        if (e.includes('thunder') || e.includes('gewitter'))  return '⛈️';
        if (e.includes('snow') || e.includes('schnee'))       return '🌨️';
        if (e.includes('wind') || e.includes('sturm') || e.includes('bö') || e.includes('boe')) return '💨';
        if (e.includes('fog') || e.includes('nebel'))         return '🌫️';
        if (e.includes('frost') || e.includes('ice') || e.includes('eis')) return '🧊';
        if (e.includes('heat') || e.includes('hitze'))        return '🌡️';
        if (e.includes('rain') || e.includes('regen') || e.includes('starkregen')) return '🌧️';
        return null;
    }

    function sevColor(sev, event) {
        const isFlood = (event || '').toLowerCase().includes('flood') || (event || '').toLowerCase().includes('hochwasser');
        if (isFlood) return { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', icon: '🌊', stufe: 3, label: 'Stufe 3' };
        switch ((sev || '').toLowerCase()) {
            case 'minor':    return { bg: '#fefce8', border: '#eab308', text: '#854d0e', icon: '⚠️',  stufe: 1, label: 'Stufe 1' };
            case 'moderate': return { bg: '#fff7ed', border: '#f97316', text: '#9a3412', icon: '🟠', stufe: 2, label: 'Stufe 2' };
            case 'severe':   return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '🔴', stufe: 3, label: 'Stufe 3' };
            case 'extreme':  return { bg: '#faf5ff', border: '#a855f7', text: '#6b21a8', icon: '🚨', stufe: 4, label: 'Stufe 4' };
            default:         return { bg: '#f0f9ff', border: '#38bdf8', text: '#075985', icon: 'ℹ️',  stufe: 0, label: '' };
        }
    }

    function warnTitle(a) {
        // Bevorzuge deutschen Eventnamen, dann Headline, dann Englisch, dann Fallback
        if (a.event_de) return a.event_de;
        if (a.headline) {
            // "Amtliche WARNUNG vor FROST" → "FROST" extrahieren
            const m = a.headline.match(/vor\s+(.+)$/i);
            if (m) return m[1].trim();
            return a.headline;
        }
        if (a.event_en) return a.event_en;
        if (a.event)    return a.event;
        return 'Wetterwarnung';
    }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Kopfzeile bei mehreren Warnungen
    const countLine = relevant.length > 1
        ? `<div class="warn-count">⚠️ ${relevant.length} aktive Warnungen</div>`
        : '';

    const cards = relevant.map((a, idx) => {
        const c        = sevColor(a.severity, a.event_de || a.event);
        const icon     = eventIcon(a.event_de || a.event_en || a.event) || c.icon;
        const onset    = a.onset   ? new Date(a.onset).getTime() : 0;
        const isActive = onset <= now;
        const badge    = isActive
            ? `<span class="warn-badge warn-active">Aktiv</span>`
            : `<span class="warn-badge warn-soon">Bald</span>`;
        const stufeBadge = c.label
            ? `<span class="warn-stufe warn-stufe-${c.stufe}">${c.label}</span>`
            : '';
        const onsetStr   = a.onset   ? new Date(a.onset).toLocaleString('de-DE',   {weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
        const expiresStr = a.expires ? new Date(a.expires).toLocaleString('de-DE', {weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
        const bg     = isDark ? 'rgba(0,0,0,0.3)' : c.bg;
        const border = c.border;
        const text   = isDark ? '#e2e8f0' : c.text;

        // Beschreibung: kurz + ausklappbar
        let descHtml = '';
        if (a.description) {
            const SHORT = 140;
            if (a.description.length <= SHORT) {
                descHtml = `<div class="warning-desc">${a.description}</div>`;
            } else {
                const short = a.description.slice(0, SHORT).trimEnd();
                const rest  = a.description.slice(SHORT);
                descHtml = `<div class="warning-desc" id="wdesc-${idx}">
                    <span class="wdesc-short">${short}… <button class="warn-expand-btn" onclick="toggleWarnDesc(${idx})">mehr ▾</button></span>
                    <span class="wdesc-full" style="display:none">${short}${rest} <button class="warn-expand-btn" onclick="toggleWarnDesc(${idx})">weniger ▴</button></span>
                </div>`;
            }
        }

        // Handlungsempfehlung
        const instrHtml = a.instruction
            ? `<div class="warning-instruction">💡 ${a.instruction}</div>`
            : '';

        return `<div class="warning-card" style="background:${bg};border-left:4px solid ${border};color:${text}">
            <div class="warning-header">
                <span class="warning-icon">${icon}</span>
                <div class="warning-title-block">
                    <span class="warning-title">${warnTitle(a)}</span>
                    <div class="warning-badges">
                        ${stufeBadge}
                        ${badge}
                    </div>
                </div>
            </div>
            ${descHtml}
            ${instrHtml}
            <div class="warning-time">
                ${onsetStr ? `Von: ${onsetStr}` : ''}
                ${expiresStr ? ` &nbsp;|&nbsp; Bis: ${expiresStr}` : ''}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = countLine + cards;
}

function toggleWarnDesc(idx) {
    const el = document.getElementById(`wdesc-${idx}`);
    if (!el) return;
    const s = el.querySelector('.wdesc-short');
    const f = el.querySelector('.wdesc-full');
    if (!s || !f) return;
    const isShort = s.style.display !== 'none';
    s.style.display = isShort ? 'none' : '';
    f.style.display = isShort ? '' : 'none';
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

    // Taupunkt (zentral für alle Schwüle-Berechnungen)
    const dewPt = (temp != null && humidity != null) ? temp - (100 - humidity) / 5 : null;

    // Sonderbedingungen
    const hasThunder = wcode >= 95;
    const isFoehn    = tChange > 5 && humidity != null && humidity < 40 && wind > 20;

    // Niederschlag aktuelle Stunde
    const precip = (hourly.precipitation || [])[hIdx] ?? 0;

    // ---- SCORING ----
    // Kreislauf
    let kreislauf = 0;
    if (pressureDiff < -8)      kreislauf += 2;
    else if (pressureDiff < -3) kreislauf += 1;
    if (Math.abs(tChange) > 8)  kreislauf += 1;
    // Schwüle (Taupunkt) belastet Kreislauf
    if (dewPt != null && dewPt >= 21)      kreislauf += 2;
    else if (dewPt != null && dewPt >= 16) kreislauf += 1;

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

    // Tagesmüdigkeit
    let muedigkeit = 0;
    if (pressureDiff < -6)       muedigkeit += 2;
    else if (pressureDiff < -3)  muedigkeit += 1;
    const cloudCover = (hourly.cloud_cover || [])[hIdx] ?? null;
    if (cloudCover != null && cloudCover > 80) muedigkeit += 1;
    if (dewPt != null && dewPt >= 21)      muedigkeit += 2;
    else if (dewPt != null && dewPt >= 16) muedigkeit += 1;

    // Outdoor Sport
    let sport = 0;
    if (hasThunder)                                          sport += 2;
    if (temp != null && (temp < 2 || temp > 35))            sport += 2;
    else if (temp != null && (temp < 8 || temp > 30))       sport += 1;
    if (wind > 50)                                           sport += 2;
    else if (wind > 30)                                      sport += 1;
    if (precip > 0.5)                                        sport += 1;
    if (dewPt != null && dewPt >= 21)      sport += 2;
    else if (dewPt != null && dewPt >= 16) sport += 1;
    if (cur.uv_index != null && cur.uv_index > 8)           sport += 1;

    // ---- AMPEL ----
    function ampel(score) {
        if (score <= 0) return { label: 'Gering',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  dot: '🟢' };
        if (score === 1) return { label: 'Erhöht', color: '#eab308', bg: 'rgba(234,179,8,0.1)',   dot: '🟡' };
        return              { label: 'Hoch',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   dot: '🔴' };
    }

    // Stündliche Scores für nächste 24h
    function calcHourlyScore(cat, i) {
        const t  = (hourly.temperature_2m    || [])[i] ?? null;
        const w  = (hourly.wind_speed_10m    || [])[i] ?? 0;
        const pr = (hourly.precipitation     || [])[i] ?? 0;
        const wc = (hourly.weather_code      || [])[i] ?? 0;
        const h  = (hourly.relative_humidity_2m || [])[i] ?? null;
        const th = wc >= 95;
        switch (cat) {
            case 'sport': {
                let s = 0;
                if (th) s += 2;
                if (t != null && (t < 2 || t > 35)) s += 2;
                else if (t != null && (t < 8 || t > 30)) s += 1;
                if (w > 50) s += 2; else if (w > 30) s += 1;
                if (pr > 0.5) s += 1;
                if (h != null && h > 85) s += 1;
                return Math.min(s, 2);
            }
            case 'schlaf': {
                let s = 0;
                if (h != null && h > 80) s += 1;
                if (t != null && t > 22) s += 1;
                if (t != null && t > 26) s += 1;
                if (th) s += 1;
                return Math.min(s, 2);
            }
            case 'kreislauf':
                return Math.min(kreislauf, 2);
            case 'muedigkeit': {
                let s = 0;
                if (pressureDiff < -6) s += 2; else if (pressureDiff < -3) s += 1;
                const cc = (hourly.cloud_cover || [])[i] ?? null;
                if (cc != null && cc > 80) s += 1;
                if (t != null && h != null && t > 24 && h > 70) s += 1;
                return Math.min(s, 2);
            }
            case 'migraene': {
                let s = 0;
                if (pressureDiff < -5) s += 2; else if (pressureDiff < -2) s += 1;
                if (th) s += 1;
                if (isFoehn) s += 1;
                return Math.min(s, 2);
            }
            case 'gelenke': {
                let s = 0;
                if (t != null && t < 10 && pressureDiff < -3) s += 2;
                else if (pressureDiff < -3) s += 1;
                if (h != null && h > 80 && t != null && t < 12) s += 1;
                return Math.min(s, 2);
            }
            case 'atemwege': {
                let s = 0;
                if (maxPollen > 30) s += 2; else if (maxPollen > 10) s += 1;
                if (h != null && h < 30) s += 1;
                return Math.min(s, 2);
            }
            default: return 0;
        }
    }

    function hourlyBar(cat) {
        const colors = ['#22c55e', '#eab308', '#ef4444'];
        let html = '<div class="bio-hourly">';
        for (let i = hIdx; i < hIdx + 24 && i < times.length; i++) {
            const s = calcHourlyScore(cat, i);
            const t = times[i].slice(11, 16);
            html += `<div class="bio-hour-block" style="background:${colors[s]}35;border-top:4px solid ${colors[s]}">
                <span class="bio-hour-time" style="color:${colors[s]}">${t}</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    function bioCard(icon, title, score, hint, cat) {
        const a = ampel(score);
        const detailId = 'bio-detail-' + cat;
        return `<div class="bio-card bio-card-toggle" data-detail="${detailId}" style="border-left:3px solid ${a.color};background:${a.bg};cursor:pointer">
            <div class="bio-card-header">
                <span class="bio-icon">${icon}</span>
                <span class="bio-title">${title}</span>
                <span class="bio-level" style="color:${a.color}">${a.dot} ${a.label}</span>
                <span class="bio-arrow">▼</span>
            </div>
            <div class="bio-hint">${hint}</div>
            <div id="${detailId}" style="display:none">
                <div class="bio-detail-label">24h Vorschau</div>
                ${hourlyBar(cat)}
            </div>
        </div>`;
    }

    // Hinweis-Texte
    function kreislaufHint() {
        if (dewPt != null && dewPt >= 21) return schwueleInfo(dewPt).label + ' — Kreislauf stark belastet, viel trinken.';
        if (dewPt != null && dewPt >= 16) return schwueleInfo(dewPt).label + ' — erhöht die Kreislaufbelastung.';
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
    function muedigkeitHint() {
        if (pressureDiff < -6) return 'Deutlicher Druckabfall — Antriebslosigkeit und Müdigkeit wahrscheinlich.';
        if (pressureDiff < -3) return 'Leichter Druckabfall — kann die Tagesvitalität dämpfen.';
        if (dewPt != null && dewPt >= 21) return schwueleInfo(dewPt).label + ' — Energie sinkt, Körper kämpft gegen Hitze.';
        if (dewPt != null && dewPt >= 16) return schwueleInfo(dewPt).label + ' — Wärmeabgabe erschwert, kann müde machen.';
        if (cloudCover != null && cloudCover > 80) return 'Trübes Licht mindert die Serotoninproduktion — etwas mehr Müdigkeit möglich.';
        return 'Gute Voraussetzungen für einen wachen, energiereichen Tag.';
    }
    function schlafHint() {
        if (tSwing > 12) return 'Große Temperaturschwankung heute — Schlaf kann unruhig sein.';
        if (tSwing > 8) return 'Spürbare Temperaturdifferenz zwischen Tag und Nacht.';
        if (dewPt != null && dewPt >= 21) return schwueleInfo(dewPt).label + ' — Schlaf stark beeinträchtigt.';
        if (dewPt != null && dewPt >= 16) return schwueleInfo(dewPt).label + ' — kann den Schlaf beeinträchtigen.';
        if (pressureDiff < -3) return 'Wetterwechsel — kann den Schlaf leicht stören.';
        return 'Gute Schlafbedingungen erwartet.';
    }

    function sportHint() {
        if (hasThunder) return 'Gewitter — Outdoor Sport nicht empfohlen!';
        if (temp != null && temp > 35) return 'Zu heiß — Überhitzungsgefahr beim Sport.';
        if (temp != null && temp < 2) return 'Zu kalt — Verletzungsgefahr durch gefrorenen Boden.';
        if (wind > 50) return 'Sehr starker Wind — draußen Sport gefährlich.';
        if (precip > 0.5) return 'Niederschlag — Sport nur mit entsprechender Ausrüstung.';
        if (dewPt != null && dewPt >= 21) return schwueleInfo(dewPt).label + ' — körperliche Belastung stark erhöht, viel trinken.';
        if (dewPt != null && dewPt >= 16) return schwueleInfo(dewPt).label + ' — erhöht die Belastung beim Sport.';
        if (cur.uv_index != null && cur.uv_index > 8) return 'Sehr hoher UV-Index — nur mit Sonnenschutz und in kühlen Stunden.';
        if (wind > 30) return 'Kräftiger Wind — leicht eingeschränkt, aber möglich.';
        if (temp != null && (temp < 8 || temp > 30)) return 'Temperatur am Grenzbereich — angepasste Kleidung empfohlen.';
        return 'Gute Bedingungen für Outdoor Sport!';
    }

    const pressureTrendText = pressureDiff > 0
        ? `+${pressureDiff.toFixed(1)} hPa` 
        : `${pressureDiff.toFixed(1)} hPa`;

    document.getElementById('bioContent').innerHTML = `
        <div class="bio-wrapper">
            ${bioCard('🏃', 'Outdoor Sport',  Math.min(sport,     2), sportHint(),     'sport')}
            ${bioCard('😴', 'Schlaf',          Math.min(schlaf,    2), schlafHint(),    'schlaf')}
            ${bioCard('🫀', 'Kreislauf',        Math.min(kreislauf, 2), kreislaufHint(), 'kreislauf')}
            ${bioCard('😪', 'Tagesmüdigkeit',  Math.min(muedigkeit,2), muedigkeitHint(),'muedigkeit')}
            ${bioCard('🧠', 'Kopf / Migräne',  Math.min(migraene,  2), migraeneHint(),  'migraene')}
            ${bioCard('🦴', 'Gelenke',          Math.min(gelenke,   2), gelenkeHint(),   'gelenke')}
            ${bioCard('🫁', 'Atemwege',         Math.min(atemwege,  2), atemwegeHint(),  'atemwege')}
            <p class="bio-disclaimer">Bio-Wetter basiert auf meteorologischen Schwellenwerten. Keine medizinische Aussage.</p>
        </div>
    `;
    document.getElementById('bioWelcome').classList.add('hidden');
    document.getElementById('bioContent').classList.remove('hidden');

    // Klick-Handler: nur eine Karte offen (Accordion)
    document.querySelectorAll('.bio-card-toggle').forEach(card => {
        card.addEventListener('click', () => {
            const detail = document.getElementById(card.dataset.detail);
            const arrow  = card.querySelector('.bio-arrow');
            if (!detail) return;
            const isOpen = detail.style.display === 'block';
            // Alle schließen
            closeBioCards();
            // Angeklickte öffnen (wenn sie vorher zu war)
            if (!isOpen) {
                detail.style.display = 'block';
                arrow.textContent = '▲';
            }
        });
    });
}

// =====================================================
// SERVICE WORKER REGISTRIERUNG (PWA)
// =====================================================
// Titel-Klick → Wetter Tab + aktueller Standort
const appTitle = document.getElementById('appTitle');
if (appTitle) {
    appTitle.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="wetter"]').classList.add('active');
        document.getElementById('tab-wetter').classList.add('active');
        if (!panelVisible) showPanel();
        tryGeolocation();
    });
}

// Impressum Modal
const impressumModal = document.getElementById('impressumModal');
const impressumClose = document.getElementById('impressumClose');
window.openImpressum = () => { impressumModal.style.display = 'block'; };
if (impressumClose) impressumClose.addEventListener('click', () => { impressumModal.style.display = 'none'; });
if (impressumModal) impressumModal.addEventListener('click', e => { if (e.target === impressumModal) impressumModal.style.display = 'none'; });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW aktiv:', reg.scope))
            .catch(err => console.warn('SW Fehler:', err));
    });
}

// =====================================================
// PULL-TO-REFRESH
// =====================================================
(function initPullToRefresh() {
    const panel = document.getElementById('panel');
    if (!panel) return;

    const indicator = document.getElementById('pullIndicator');
    const THRESHOLD = 72;
    let startY = 0;
    let pulling = false;
    let active  = false;

    panel.addEventListener('touchstart', e => {
        if (panel.scrollTop > 0) return;
        startY  = e.touches[0].clientY;
        pulling = true;
    }, { passive: true });

    panel.addEventListener('touchmove', e => {
        if (!pulling || !indicator) return;
        const dy = e.touches[0].clientY - startY;
        if (dy <= 0) return;

        const progress = Math.min(dy / THRESHOLD, 1);
        const translate = Math.min(dy * 0.45, THRESHOLD * 0.6);

        indicator.classList.add('pull-visible');
        indicator.style.transform  = `translateY(${translate}px)`;
        indicator.style.opacity    = String(progress);
        indicator.querySelector('.pull-icon').style.transform =
            `rotate(${progress * 180}deg)`;
        indicator.querySelector('.pull-label').textContent =
            progress >= 1 ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren ziehen';
    }, { passive: true });

    panel.addEventListener('touchend', e => {
        if (!pulling || !indicator) return;
        pulling = false;
        const dy = e.changedTouches[0].clientY - startY;

        if (dy >= THRESHOLD && lastLat !== null) {
            active = true;
            indicator.querySelector('.pull-label').textContent = 'Aktualisiert …';
            indicator.querySelector('.pull-icon').textContent  = '↻';
            indicator.querySelector('.pull-icon').style.animation = 'ptr-spin 0.8s linear infinite';
            loadWeatherForCoords(lastLat, lastLon).finally(() => {
                active = false;
                resetIndicator();
            });
        } else {
            resetIndicator();
        }
    }, { passive: true });

    function resetIndicator() {
        if (!indicator) return;
        indicator.classList.remove('pull-visible');
        indicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        indicator.style.transform  = 'translateY(0)';
        indicator.style.opacity    = '0';
        indicator.querySelector('.pull-icon').style.transform  = 'rotate(0deg)';
        indicator.querySelector('.pull-icon').style.animation  = '';
        indicator.querySelector('.pull-label').textContent = 'Zum Aktualisieren ziehen';
        setTimeout(() => { if (indicator) indicator.style.transition = ''; }, 350);
    }
})();

