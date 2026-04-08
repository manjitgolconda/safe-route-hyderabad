/* ============================================================
   SafeRoute Hyderabad — Main Application Logic
   ============================================================
   Sections:
     1. Constants & State
     2. Map Initialization
     3. Data Loading
     4. Safety Layers (Crime Heatmap, Poorly-Lit, Police)
     5. Location Selection (Click / Geolocation / Input)
     6. Routing (OSRM + Safety Scoring Algorithm)
     7. Route Drawing & Animation
     8. UI Interaction (Sidebar, Toggles, Modal, Toasts)
     9. Report Unsafe Area
    10. Initialization
   ============================================================ */

// ============================================================
// 1. CONSTANTS & STATE
// ============================================================

const HYD_CENTER = [17.3850, 78.4867];
const DEFAULT_ZOOM = 12;

/** Application state — single source of truth */
const state = {
    startLatLng: null,
    endLatLng: null,
    selectingStart: true,
    crimeData: [],
    lightingData: [],
    policeData: [],
    userReports: [],
    crimeStats: null,
    severityEngine: null,
    crimeTrends: null,
    highSeverityIncidents: null,
    lawEnforcement: null,
    shortestRoute: null,
    safestRoute: null,
    reportMode: false,
    safetyModes: {
        womenSafety: false,
        avoidDarkAreas: false,
        avoidPropertyCrime: false,
        avoidCyberHotspots: false,
    },
};

/** Map layer references */
const layers = {
    heatmap: null,
    lightingCircles: [],
    policeMarkers: [],
    reportMarkers: [],
    unitMarkers: [],
    hotspotCircles: [],
    startMarker: null,
    endMarker: null,
    shortestLine: null,
    safestLine: null,
};

// ============================================================
// 2. MAP INITIALIZATION
// ============================================================

const map = L.map('map', {
    center: HYD_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
});

// CartoDB Dark Matter — clean, professional dark basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
}).addTo(map);

// ============================================================
// 3. DATA LOADING
// ============================================================

async function loadAllData() {
    try {
        const [crimeRes, lightRes, policeRes, statsRes, engineRes, trendsRes, incidentsRes, enforcementRes] = await Promise.all([
            fetch('data/crime-zones.json'),
            fetch('data/poorly-lit-areas.json'),
            fetch('data/police-stations.json'),
            fetch('data/crime-data.json'),
            fetch('data/severity-engine.json'),
            fetch('data/crime-trends.json'),
            fetch('data/high-severity-incidents.json'),
            fetch('data/law-enforcement.json'),
        ]);

        state.crimeData             = await crimeRes.json();
        state.lightingData          = await lightRes.json();
        state.policeData            = await policeRes.json();
        state.crimeStats            = await statsRes.json();
        state.severityEngine        = await engineRes.json();
        state.crimeTrends           = await trendsRes.json();
        state.highSeverityIncidents = await incidentsRes.json();
        state.lawEnforcement        = await enforcementRes.json();

        // Load user reports from localStorage
        const saved = localStorage.getItem('unsafeReports');
        state.userReports = saved ? JSON.parse(saved) : [];

        renderCrimeHeatmap();
        renderLightingAreas();
        renderPoliceStations();
        renderUserReports();
        updateAnalytics();
        renderCrimeAnalytics();
        renderCrimeTrends();
        renderCommissionerates();
        renderTopHotspots();
        renderCybercrimeImpact();
        renderIncidentTimeline();
        renderLawEnforcement();

        // Initialize AI features
        initAIFeatures();

    } catch (err) {
        console.error('Failed to load safety data:', err);
        showToast('Could not load safety data — check console.');
    }
}

// ============================================================
// 4. SAFETY LAYERS
// ============================================================

/**
 * Crime heatmap using Leaflet.heat
 * Gradient: light red (low severity) → dark red (high severity)
 * Intensity scales with the severity value (1–10 normalized to 0–1)
 */
function renderCrimeHeatmap() {
    if (layers.heatmap) map.removeLayer(layers.heatmap);

    // Build heat points: [lat, lng, intensity]
    // Supports both schemas:
    //   New: { severity_weight, intensity }  (250-point synthetic dataset)
    //   Old: { severity, type }              (legacy zone dataset)
    const heatPoints = state.crimeData.map(z => {
        const intensity = z.intensity !== undefined
            ? z.intensity
            : (z.severity_weight || z.severity || 5) / 10;
        return [z.lat, z.lng, Math.max(0.2, intensity)];
    });

    layers.heatmap = L.heatLayer(heatPoints, {
        radius: 22,
        blur: 18,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
            0.2: '#FFE5E5',   // Very Low Crime
            0.35: '#FFB3B3',  // Low Crime
            0.5: '#FF6B6B',   // Moderate
            0.7: '#FF2E2E',   // High Crime
            0.85: '#B30000',  // Serious
            1.0: '#660000',   // Most Severe
        },
    }).addTo(map);
}

/** Poorly-lit areas as translucent circles */
function renderLightingAreas() {
    layers.lightingCircles.forEach(c => map.removeLayer(c));
    layers.lightingCircles = [];

    state.lightingData.forEach(area => {
        const opacity = 0.1 + (1 - area.lightingLevel) * 0.2;
        const circle = L.circle([area.lat, area.lng], {
            radius: area.radius,
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: opacity,
            weight: 1,
            dashArray: '6 4',
        }).addTo(map);

        circle.bindPopup(`
            <strong>${area.name}</strong><br>
            Lighting: <b>${Math.round(area.lightingLevel * 100)}%</b><br>
            <span style="color:#a1a1aa">${area.description}</span>
        `);

        layers.lightingCircles.push(circle);
    });
}

/** Police station markers with SVG shield icon */
function renderPoliceStations() {
    layers.policeMarkers.forEach(m => map.removeLayer(m));
    layers.policeMarkers = [];

    const policeIcon = L.divIcon({
        html: `<div class="marker-police">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
        </div>`,
        className: 'marker-icon-wrapper',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });

    state.policeData.forEach(ps => {
        const marker = L.marker([ps.lat, ps.lng], { icon: policeIcon }).addTo(map);
        marker.bindPopup(`
            <strong>${ps.name}</strong><br>
            ${ps.address}<br>
            <span style="color:#a1a1aa">${ps.contact}</span>
        `);
        layers.policeMarkers.push(marker);
    });
}

/** User-reported unsafe areas */
function renderUserReports() {
    layers.reportMarkers.forEach(m => map.removeLayer(m));
    layers.reportMarkers = [];

    const reportIcon = L.divIcon({
        html: `<div class="marker-report">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        </div>`,
        className: 'marker-icon-wrapper',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });

    state.userReports.forEach(r => {
        const marker = L.marker([r.lat, r.lng], { icon: reportIcon }).addTo(map);
        marker.bindPopup(`
            <strong>User Report</strong><br>
            Type: <b>${r.type}</b><br>
            <span style="color:#a1a1aa">${r.description}</span><br>
            <small style="color:#71717a">${new Date(r.timestamp).toLocaleString()}</small>
        `);
        layers.reportMarkers.push(marker);
    });
}

// ============================================================
// 5. LOCATION SELECTION
// ============================================================

/** Create clean SVG-based location markers */
function createLocationMarker(latlng, type) {
    const isStart = type === 'start';
    const color = isStart ? '#22c55e' : '#ef4444';
    const label = isStart ? 'A' : 'B';

    const icon = L.divIcon({
        html: `<div style="
            width: 28px; height: 28px;
            background: ${color};
            border: 2px solid #fff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">
            <span style="
                transform: rotate(45deg);
                font-size: 11px;
                font-weight: 700;
                color: #fff;
                font-family: 'Inter', sans-serif;
            ">${label}</span>
        </div>`,
        className: 'marker-icon-wrapper',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
    });

    return L.marker(latlng, { icon, draggable: true });
}

/** Handle map click — set start or end point */
map.on('click', function (e) {
    if (state.reportMode) {
        document.getElementById('report-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('report-lng').value = e.latlng.lng.toFixed(6);
        return;
    }

    if (state.selectingStart) {
        setStart(e.latlng);
    } else {
        setEnd(e.latlng);
    }
});

function setStart(latlng) {
    state.startLatLng = latlng;
    if (layers.startMarker) map.removeLayer(layers.startMarker);
    layers.startMarker = createLocationMarker(latlng, 'start').addTo(map);
    layers.startMarker.on('dragend', (e) => { state.startLatLng = e.target.getLatLng(); });
    document.getElementById('start-input').value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
    state.selectingStart = false;
}

function setEnd(latlng) {
    state.endLatLng = latlng;
    if (layers.endMarker) map.removeLayer(layers.endMarker);
    layers.endMarker = createLocationMarker(latlng, 'end').addTo(map);
    layers.endMarker.on('dragend', (e) => { state.endLatLng = e.target.getLatLng(); });
    document.getElementById('end-input').value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
    state.selectingStart = true;
}

/** Use browser Geolocation API */
function useMyLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.');
        return;
    }

    showToast('Acquiring your location…');

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
            setStart(latlng);
            map.flyTo(latlng, 15, { duration: 1.2 });
            showToast('Location acquired successfully.');
        },
        () => {
            showToast('Could not access your location. Please allow GPS permissions.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ============================================================
// 6. ROUTING — OSRM + SAFETY SCORING
// ============================================================

/** Fetch routes from OSRM — requests max alternatives for diversity */
async function fetchRoutes(start, end) {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?alternatives=true&overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM API error: ${res.status}`);

    const data = await res.json();
    if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found between selected points.');
    }

    return data.routes;
}

/**
 * ENHANCED SAFETY SCORE ALGORITHM (v2)
 * ─────────────────────────────────────
 * Designed to MAXIMIZE differentiation between safe and unsafe routes.
 *
 * Samples ~100 points along a route and evaluates:
 *   1. Crime zone proximity  → heavy penalty (exponential decay, severity²)
 *   2. Poorly-lit areas      → strong penalty (darkness-weighted)
 *   3. Police station nearby → significant bonus
 *   4. User-reported areas   → additional penalty
 *
 * Returns a normalized score between 0 and 100.
 * Higher = safer.
 */
function computeSafetyScore(routeGeojson) {
    const coords = routeGeojson.coordinates;
    // Dense sampling — 100 points for accurate safety evaluation
    const sampleStep = Math.max(1, Math.floor(coords.length / 100));
    const samplePoints = [];

    for (let i = 0; i < coords.length; i += sampleStep) {
        samplePoints.push({ lat: coords[i][1], lng: coords[i][0] });
    }

    let totalPenalty = 0;
    let totalBonus = 0;

    // ── Tuning Constants ─────────────────────────────────────
    // Calibrated for 250-point dense crime dataset.
    // Smaller radii + moderate multipliers prevent score collapse.
    const CRIME_INNER_RADIUS = 350;    // Full penalty within 350m
    const CRIME_OUTER_RADIUS = 800;    // Decaying penalty up to 800m
    const CRIME_PENALTY_BASE = 1.8;    // Inner-zone penalty multiplier
    const CRIME_PENALTY_OUTER = 0.6;   // Outer-zone penalty multiplier

    const LIGHT_PENALTY_INNER = 1.5;   // Penalty inside poorly-lit zone
    const LIGHT_PENALTY_OUTER = 0.7;   // Decaying penalty near dark zone

    const POLICE_INNER_RADIUS = 600;   // Strong bonus within 600m
    const POLICE_OUTER_RADIUS = 1500;  // Moderate bonus up to 1.5km
    const POLICE_BONUS_INNER = 3.0;    // Inner bonus
    const POLICE_BONUS_OUTER = 1.2;    // Outer bonus

    const REPORT_RADIUS = 400;         // User-reported unsafe zone
    const REPORT_PENALTY = 2.0;        // Penalty for user reports

    samplePoints.forEach(pt => {
        // ── 1. Crime Zone Penalty ────────────────────────────
        // Uses severity² for exponential weighting:
        //   Murder (10) → weight 100  vs  Cybercrime (4) → weight 16
        //   This makes routes near violent crime MUCH more penalized
        state.crimeData.forEach(zone => {
            const dist = haversineDistance(pt.lat, pt.lng, zone.lat, zone.lng);
            const radius = zone.radius || CRIME_INNER_RADIUS;
            const sev = zone.severity_weight || zone.severity || 5;
            const sevSquared = (sev / 10) * (sev / 10); // Exponential weight

            if (dist < radius) {
                // Inside zone — full penalty with severity²
                totalPenalty += sevSquared * CRIME_PENALTY_BASE;
            } else if (dist < CRIME_OUTER_RADIUS) {
                // Proximity zone — linear decay with severity²
                const proximity = 1 - ((dist - radius) / (CRIME_OUTER_RADIUS - radius));
                totalPenalty += proximity * sevSquared * CRIME_PENALTY_OUTER;
            }
        });

        // ── 2. Poorly-Lit Area Penalty ───────────────────────
        // Darkness level inverted: lower lighting = higher penalty
        state.lightingData.forEach(area => {
            const dist = haversineDistance(pt.lat, pt.lng, area.lat, area.lng);
            const darkness = 1 - area.lightingLevel; // 0 = bright, 1 = pitch dark

            if (dist < area.radius) {
                totalPenalty += darkness * LIGHT_PENALTY_INNER;
            } else if (dist < area.radius * 1.5) {
                const proximity = 1 - ((dist - area.radius) / (area.radius * 0.5));
                totalPenalty += proximity * darkness * LIGHT_PENALTY_OUTER;
            }
        });

        // ── 3. Police Station Bonus ──────────────────────────
        // Being near a police station significantly boosts safety
        state.policeData.forEach(ps => {
            const dist = haversineDistance(pt.lat, pt.lng, ps.lat, ps.lng);
            if (dist < POLICE_INNER_RADIUS) {
                totalBonus += POLICE_BONUS_INNER;
            } else if (dist < POLICE_OUTER_RADIUS) {
                const proximity = 1 - ((dist - POLICE_INNER_RADIUS) / (POLICE_OUTER_RADIUS - POLICE_INNER_RADIUS));
                totalBonus += proximity * POLICE_BONUS_OUTER;
            }
        });

        // ── 4. User-Reported Unsafe Areas ────────────────────
        state.userReports.forEach(report => {
            const dist = haversineDistance(pt.lat, pt.lng, report.lat, report.lng);
            if (dist < REPORT_RADIUS) {
                totalPenalty += REPORT_PENALTY;
            }
        });
    });

    // ── Final Score Computation ──────────────────────────────
    // Normalized per sample point, then scaled.
    // Penalty drops score, bonus raises it.
    const avgPenalty = totalPenalty / samplePoints.length;
    const avgBonus = totalBonus / samplePoints.length;

    const rawScore = 100
        - avgPenalty * 12   // Moderate penalty influence (tuned for 250 points)
        + avgBonus * 18;    // Strong bonus for police proximity

    return Math.round(Math.max(0, Math.min(100, rawScore)));
}

/** Haversine distance (meters) between two lat/lng points */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Main routing function — always picks the MAXIMUM safety route */
async function findRoutes() {
    if (!state.startLatLng || !state.endLatLng) {
        showToast('Set both origin and destination to compute routes.');
        return;
    }

    showLoading(true);
    clearRoutes();

    try {
        const routes = await fetchRoutes(state.startLatLng, state.endLatLng);

        const scored = routes.map((route, i) => ({
            index: i,
            route,
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry,
            safety: computeSafetyScore(route.geometry),
        }));

        // Shortest = minimum distance
        scored.sort((a, b) => a.distance - b.distance);
        const shortest = scored[0];

        // Safest = MAXIMUM safety score (pure safety priority)
        scored.sort((a, b) => b.safety - a.safety);
        const safest = scored[0];

        // Only show a different "Safest Route" if it's genuinely
        // safer (or equal) AND a different route from shortest.
        // Never label a route "Safest" if it has a LOWER safety score.
        let finalSafest = safest;
        if (safest.index === shortest.index && scored.length > 1) {
            // The shortest route is also the safest.
            // Only use an alternative if it has equal or higher safety.
            const alt = scored.find(s => s.index !== shortest.index && s.safety >= shortest.safety);
            finalSafest = alt || safest; // Fall back to same route if no equal/better alt
        }

        state.shortestRoute = shortest;
        state.safestRoute = finalSafest;

        drawRoute(shortest.geometry, 'shortest');
        drawRoute(finalSafest.geometry, 'safest');
        updateRoutePanel(shortest, finalSafest);

        // Show safety difference in toast
        const diff = finalSafest.safety - shortest.safety;
        let safetyMsg;
        if (finalSafest.index === shortest.index) {
            safetyMsg = `Shortest route is already the safest! (${shortest.safety}/100)`;
        } else if (diff > 0) {
            safetyMsg = `Safest route is ${diff} pts safer (${finalSafest.safety}/100).`;
        } else {
            safetyMsg = `Routes computed — safety: ${finalSafest.safety}/100.`;
        }
        showToast(safetyMsg);

        // Fit map to show both routes
        const allCoords = [
            ...shortest.geometry.coordinates.map(c => [c[1], c[0]]),
            ...finalSafest.geometry.coordinates.map(c => [c[1], c[0]]),
        ];
        if (allCoords.length > 0) {
            map.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60] });
        }

    } catch (err) {
        console.error('Routing error:', err);
        showToast(err.message);
    } finally {
        showLoading(false);
    }

}

// ============================================================
// 7. ROUTE DRAWING & ANIMATION
// ============================================================

function drawRoute(geometry, type) {
    const latlngs = geometry.coordinates.map(c => [c[1], c[0]]);

    const styles = {
        shortest: { color: '#00D1FF', weight: 4, opacity: 0.85, dashArray: '10 6' },
        safest:   { color: '#22C55E', weight: 5, opacity: 0.9, dashArray: null },
    };

    const style = styles[type];
    const glowColor = type === 'safest' ? 'rgba(34,197,94,0.6)' : 'rgba(0,209,255,0.4)';

    // Outer glow behind route
    const glowLine = L.polyline(latlngs, {
        color: style.color,
        weight: style.weight + 8,
        opacity: 0.12,
    }).addTo(map);

    // Inner glow
    const innerGlow = L.polyline(latlngs, {
        color: style.color,
        weight: style.weight + 3,
        opacity: 0.2,
    }).addTo(map);

    // Main route line
    const mainLine = L.polyline(latlngs, { ...style }).addTo(map);

    if (type === 'shortest') {
        layers.shortestLine = L.layerGroup([glowLine, innerGlow, mainLine]).addTo(map);
    } else {
        layers.safestLine = L.layerGroup([glowLine, innerGlow, mainLine]).addTo(map);
    }

    animateRoute(mainLine, latlngs);
}

/** Progressive route reveal animation */
function animateRoute(polyline, fullLatLngs) {
    const step = Math.max(1, Math.floor(fullLatLngs.length / 60));
    let idx = 2;
    polyline.setLatLngs(fullLatLngs.slice(0, 2));

    const interval = setInterval(() => {
        idx = Math.min(idx + step, fullLatLngs.length);
        polyline.setLatLngs(fullLatLngs.slice(0, idx));
        if (idx >= fullLatLngs.length) clearInterval(interval);
    }, 25);
}

function clearRoutes() {
    if (layers.shortestLine) { map.removeLayer(layers.shortestLine); layers.shortestLine = null; }
    if (layers.safestLine) { map.removeLayer(layers.safestLine); layers.safestLine = null; }
    state.shortestRoute = null;
    state.safestRoute = null;
    document.getElementById('route-panel').style.display = 'none';
}

// ============================================================
// 8. UI INTERACTION
// ============================================================

function updateRoutePanel(shortest, safest) {
    const panel = document.getElementById('route-panel');
    panel.style.display = 'block';

    document.getElementById('shortest-distance').textContent = (shortest.distance / 1000).toFixed(1) + ' km';
    document.getElementById('shortest-time').textContent = Math.round(shortest.duration / 60) + ' min';
    const sSafety = document.getElementById('shortest-safety');
    sSafety.textContent = shortest.safety + '/100';
    sSafety.style.color = safetyColor(shortest.safety);

    document.getElementById('safest-distance').textContent = (safest.distance / 1000).toFixed(1) + ' km';
    document.getElementById('safest-time').textContent = Math.round(safest.duration / 60) + ' min';
    const fSafety = document.getElementById('safest-safety');
    fSafety.textContent = safest.safety + '/100';
    fSafety.style.color = safetyColor(safest.safety);

    // ── AI Risk Score overlay ─────────────────────────────
    if (typeof AI !== 'undefined') {
        const opts = { safetyModes: state.safetyModes };
        if (state.severityEngine && state.severityEngine.weights) {
            opts.adjustedWeights = AI.personalizedWeights(state.severityEngine.weights, state.safetyModes);
        }

        const shortRisk = AI.computeRouteRisk(shortest.geometry, state, opts);
        const safeRisk  = AI.computeRouteRisk(safest.geometry, state, opts);

        _displayRouteRisk('shortest', shortRisk);
        _displayRouteRisk('safest', safeRisk);
    }
}

/** Helper: display AI risk badge on a route card */
function _displayRouteRisk(prefix, risk) {
    const row = document.getElementById(prefix + '-ai-risk');
    const badge = document.getElementById(prefix + '-risk-badge');
    if (row && badge) {
        row.style.display = 'flex';
        badge.textContent = risk.level + ' (' + risk.score + ')';
        badge.style.background = risk.color + '22';
        badge.style.color = risk.color;
        badge.style.borderColor = risk.color + '44';
    }
}

function safetyColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
}

function updateAnalytics() {
    document.getElementById('stat-crime-zones').textContent = state.crimeData.length;
    document.getElementById('stat-dark-areas').textContent = state.lightingData.length;
    document.getElementById('stat-police').textContent = state.policeData.length;
    document.getElementById('stat-reports').textContent = state.userReports.length;
}

/**
 * Crime Analytics Dashboard
 * Renders YoY overview, crime breakdown bars, and recovery stats
 * using data from crime-data.json + severity-engine.json
 */
function renderCrimeAnalytics() {
    const stats = state.crimeStats;
    const engine = state.severityEngine;
    if (!stats || !engine) return;

    // --- YoY Overview ---
    const total24 = document.getElementById('ca-total-2024');
    const total25 = document.getElementById('ca-total-2025');
    const pill    = document.getElementById('ca-change-pill');
    if (total24) total24.textContent = stats.overall_crime.total_cases_2024.toLocaleString('en-IN');
    if (total25) total25.textContent = stats.overall_crime.total_cases_2025.toLocaleString('en-IN');
    if (pill) {
        const pct = stats.overall_crime.percentage_change;
        pill.textContent = (pct > 0 ? '+' : '') + pct + '%';
        pill.className = 'change-pill ' + (pct <= 0 ? 'down' : 'up');
    }

    // --- Crime Breakdown Bars ---
    const container = document.getElementById('crime-breakdown');
    if (container && stats.detailed_crimes) {
        const maxCases = Math.max(...stats.detailed_crimes.map(d => d.cases_2025));
        container.innerHTML = stats.detailed_crimes.map(crime => {
            const pct = Math.round((crime.cases_2025 / maxCases) * 100);
            const band = getSeverityBand(crime.severity_weight, engine.risk_bands);
            return `
                <div class="crime-bar-row">
                    <span class="crime-bar-label" title="${crime.crime_type}">${crime.crime_type}</span>
                    <div class="crime-bar-track">
                        <div class="crime-bar-fill" style="width:${pct}%;background:${band.color};"></div>
                    </div>
                    <span class="crime-bar-cases">${crime.cases_2025.toLocaleString('en-IN')}</span>
                    <span class="severity-badge" style="background:${band.color}22;color:${band.color};border:1px solid ${band.color}44;">${band.label}</span>
                </div>
            `;
        }).join('');
    }

    // --- Property Recovery Stats ---
    const ps = stats.property_crime_statistics;
    if (ps) {
        const dr = document.getElementById('ca-detection-rate');
        const rr = document.getElementById('ca-recovery-rate');
        const pr = document.getElementById('ca-property-recovered');
        if (dr) dr.textContent = ps.detection_rate_percent + '%';
        if (rr) rr.textContent = ps.recovery_rate_percent + '%';
        if (pr) pr.textContent = '₹' + ps.property_recovered_crore;
    }
}

// ============================================================
// 8b. NEW DASHBOARD PANEL RENDERERS
// ============================================================

/**
 * Crime Trends — 5-year bar chart with annotations
 */
function renderCrimeTrends() {
    const trends = state.crimeTrends;
    if (!trends) return;

    const chart = document.getElementById('trend-chart');
    const insight = document.getElementById('trend-insight');
    if (!chart) return;

    const years = trends.annual_totals;
    const maxCases = Math.max(...years.map(y => y.total_ipc_cases));

    chart.innerHTML = years.map(y => {
        const pct = Math.round((y.total_ipc_cases / maxCases) * 100);
        const isMax = y.total_ipc_cases === maxCases;
        const isCurrent = y.year === 2025;
        const cls = isMax ? 'trend-bar peak' : isCurrent ? 'trend-bar current' : 'trend-bar';
        return `
            <div class="trend-col">
                <div class="trend-bar-container">
                    <span class="trend-bar-value">${(y.total_ipc_cases / 1000).toFixed(1)}K</span>
                    <div class="${cls}" style="height:${pct}%;" title="${y.annotation}"></div>
                </div>
                <span class="trend-bar-year">${y.year}</span>
            </div>
        `;
    }).join('');

    if (insight) {
        insight.innerHTML = `<span class="insight-icon">●</span> 2024 spike due to free FIR registration policy. 2025 shows 15% correction with spatial displacement to urban fringes.`;
    }

    // National comparison
    const nc = trends.national_comparison;
    if (nc) {
        const hydRate = document.getElementById('hyd-crime-rate');
        const natRate = document.getElementById('nat-crime-rate');
        if (hydRate) hydRate.textContent = nc.hyderabad_rate_2023;
        if (natRate) natRate.textContent = nc.national_metro_average_2023;
    }
}

/**
 * Commissionerate Comparison — cards with YoY data
 */
function renderCommissionerates() {
    const trends = state.crimeTrends;
    if (!trends || !trends.commissionerate_trends) return;

    const container = document.getElementById('comm-cards');
    if (!container) return;

    const comms = trends.commissionerate_trends;
    container.innerHTML = Object.values(comms).map(c => {
        const changeClass = c.change_percent <= 0 ? 'down' : 'up';
        const changeSign = c.change_percent > 0 ? '+' : '';
        return `
            <div class="comm-card">
                <div class="comm-card-header">
                    <span class="comm-name">${c.name}</span>
                    <span class="change-pill ${changeClass}">${changeSign}${c.change_percent}%</span>
                </div>
                <div class="comm-cases">${c.cases_2025 ? c.cases_2025.toLocaleString('en-IN') : 'N/A'}</div>
                <div class="comm-label">cases in 2025</div>
                <div class="comm-insight">${c.key_insight}</div>
            </div>
        `;
    }).join('');
}

/**
 * Top Hotspots — ranked list with case volume bars
 */
function renderTopHotspots() {
    const trends = state.crimeTrends;
    if (!trends || !trends.top_hotspot_stations) return;

    const container = document.getElementById('hotspot-list');
    if (!container) return;

    const hotspots = trends.top_hotspot_stations;
    const maxCases = hotspots[0].cases;

    container.innerHTML = hotspots.map(h => {
        const pct = Math.round((h.cases / maxCases) * 100);
        const isTop3 = h.rank <= 3;
        return `
            <div class="hotspot-row ${isTop3 ? 'top3' : ''}">
                <span class="hotspot-rank">#${h.rank}</span>
                <div class="hotspot-info">
                    <div class="hotspot-name">${h.station}</div>
                    <div class="hotspot-bar-track">
                        <div class="hotspot-bar-fill" style="width:${pct}%;"></div>
                    </div>
                </div>
                <div class="hotspot-meta">
                    <span class="hotspot-cases">${h.cases.toLocaleString('en-IN')}</span>
                    <span class="hotspot-zone">${h.zone}</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Cybercrime Impact — financial stats and typology
 */
function renderCybercrimeImpact() {
    const stats = state.crimeStats;
    if (!stats || !stats.cybercrime_deep_dive) return;

    const cd = stats.cybercrime_deep_dive;

    const lossEl = document.getElementById('cyber-loss');
    const casesEl = document.getElementById('cyber-cases');
    const recoveryEl = document.getElementById('cyber-recovery');
    const rankEl = document.getElementById('cyber-rank');

    if (lossEl) lossEl.textContent = '₹' + cd.financial_loss_2024_crore + ' Cr';
    if (casesEl) casesEl.textContent = cd.total_cases_2024.toLocaleString('en-IN');
    if (recoveryEl) recoveryEl.textContent = cd.recovery_rate_percent + '%';
    if (rankEl) rankEl.textContent = cd.national_rank;

    const typologyEl = document.getElementById('cyber-typology');
    if (typologyEl && cd.top_typologies) {
        const maxVol = Math.max(...cd.top_typologies.map(t => t.cases));
        typologyEl.innerHTML = cd.top_typologies.map(t => {
            const pct = Math.round((t.cases / maxVol) * 100);
            const trendIcon = t.trend === 'rising' ? '↑' : t.trend === 'declining' ? '↓' : '●';
            const trendClass = t.trend === 'rising' ? 'trend-up' : t.trend === 'declining' ? 'trend-down' : 'trend-new';
            return `
                <div class="cyber-type-row">
                    <span class="cyber-type-name">${t.type}</span>
                    <div class="cyber-type-bar-track">
                        <div class="cyber-type-bar-fill" style="width:${pct}%;"></div>
                    </div>
                    <span class="cyber-type-cases">${t.cases.toLocaleString('en-IN')}</span>
                    <span class="cyber-type-trend ${trendClass}">${trendIcon}</span>
                </div>
            `;
        }).join('');
    }
}

/**
 * Incident Timeline — scrollable list of notable incidents
 */
function renderIncidentTimeline() {
    const incidents = state.highSeverityIncidents;
    if (!incidents) return;

    const container = document.getElementById('incident-timeline');
    if (!container) return;

    container.innerHTML = incidents.map(inc => {
        const date = new Date(inc.date);
        const month = date.toLocaleString('en', { month: 'short' });
        const year = date.getFullYear();
        const sevClass = inc.severity === 'Critical' ? 'sev-critical' : inc.severity === 'High' ? 'sev-high' : 'sev-medium';
        return `
            <div class="incident-card" data-lat="${inc.lat}" data-lng="${inc.lng}">
                <div class="incident-date">
                    <span class="incident-month">${month}</span>
                    <span class="incident-year">${year}</span>
                </div>
                <div class="incident-content">
                    <div class="incident-title">${inc.title}</div>
                    <div class="incident-area">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${inc.area}
                    </div>
                    <span class="incident-badge ${sevClass}">${inc.crime_type}</span>
                </div>
            </div>
        `;
    }).join('');

    // Click to fly to incident location
    container.querySelectorAll('.incident-card').forEach(card => {
        card.addEventListener('click', () => {
            const lat = parseFloat(card.dataset.lat);
            const lng = parseFloat(card.dataset.lng);
            if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1 });
        });
    });
}

/**
 * Law Enforcement — stats grid and specialized unit markers
 */
function renderLawEnforcement() {
    const le = state.lawEnforcement;
    if (!le) return;

    const container = document.getElementById('enforcement-stats');
    if (!container) return;

    const eh = le.enforcement_highlights;
    container.innerHTML = `
        <div class="enforcement-grid">
            <div class="enforcement-stat">
                <span class="enforcement-val">${(eh.drunk_driving_booked_2024 / 1000).toFixed(0)}K</span>
                <span class="enforcement-label">Drunk Driving Cases</span>
            </div>
            <div class="enforcement-stat">
                <span class="enforcement-val">${eh.she_teams_count}</span>
                <span class="enforcement-label">SHE Teams Active</span>
            </div>
            <div class="enforcement-stat">
                <span class="enforcement-val">${eh.minor_driving_booked_2025.toLocaleString('en-IN')}</span>
                <span class="enforcement-label">Minor Driving (2025)</span>
            </div>
            <div class="enforcement-stat">
                <span class="enforcement-val">₹${eh.cyber_fraud_loss_2024_crore} Cr</span>
                <span class="enforcement-label">Cyber Loss (Hyd 2024)</span>
            </div>
        </div>
    `;
}

/**
 * Specialized Unit Map Markers
 */
function renderSpecializedUnits() {
    layers.unitMarkers.forEach(m => map.removeLayer(m));
    layers.unitMarkers = [];

    const le = state.lawEnforcement;
    if (!le || !le.specialized_units) return;

    const unitIcon = L.divIcon({
        html: `<div class="marker-unit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>
        </div>`,
        className: 'marker-icon-wrapper',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });

    le.specialized_units.forEach(unit => {
        const marker = L.marker([unit.lat, unit.lng], { icon: unitIcon }).addTo(map);
        marker.bindPopup(`
            <strong>${unit.name}</strong><br>
            <span style="color:#a1a1aa">${unit.description}</span>
        `);
        layers.unitMarkers.push(marker);
    });
}

/**
 * Hotspot Zone Overlays — circles around top hotspot stations
 */
function renderHotspotZones() {
    layers.hotspotCircles.forEach(c => map.removeLayer(c));
    layers.hotspotCircles = [];

    const trends = state.crimeTrends;
    if (!trends || !trends.top_hotspot_stations) return;

    // Map station names to police station coordinates
    const stationCoords = {};
    state.policeData.forEach(ps => {
        stationCoords[ps.name.replace(' Police Station', '').replace(' Commissionerate HQ', '')] = { lat: ps.lat, lng: ps.lng };
    });

    trends.top_hotspot_stations.forEach(h => {
        const coords = stationCoords[h.station];
        if (!coords) return;

        const opacity = 0.08 + (h.cases / 2000) * 0.12;
        const radius = 800 + (h.rank <= 3 ? 400 : 0);

        const circle = L.circle([coords.lat, coords.lng], {
            radius,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: opacity,
            weight: 1.5,
            dashArray: '4 4',
        }).addTo(map);

        circle.bindPopup(`
            <strong>#${h.rank} ${h.station}</strong><br>
            Cases: <b>${h.cases.toLocaleString('en-IN')}</b><br>
            <span style="color:#a1a1aa">${h.zone}</span>
        `);

        layers.hotspotCircles.push(circle);
    });
}

/** Look up risk band from severity-engine.json */
function getSeverityBand(weight, bands) {
    for (const band of bands) {
        if (weight >= band.min && weight <= band.max) return band;
    }
    return { label: '?', color: '#71717a' };
}

/** Compute severity score for a crime type (utility) */
function computeSeverityScore(crimeType, cases) {
    if (!state.severityEngine) return cases;
    const typeKey = crimeType.toLowerCase().replace(/ /g, '_');
    const weight = state.severityEngine.weights[typeKey] || 5;
    return cases * weight;
}

function showLoading(show) {
    let overlay = document.querySelector('.loading-overlay');
    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="spinner"></div><div class="loading-text">Computing routes</div>';
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function clearAll() {
    if (layers.startMarker) { map.removeLayer(layers.startMarker); layers.startMarker = null; }
    if (layers.endMarker) { map.removeLayer(layers.endMarker); layers.endMarker = null; }
    state.startLatLng = null;
    state.endLatLng = null;
    state.selectingStart = true;
    document.getElementById('start-input').value = '';
    document.getElementById('end-input').value = '';
    clearRoutes();
}

function toggleLayer(layerType, visible) {
    switch (layerType) {
        case 'crime':
            if (layers.heatmap) visible ? layers.heatmap.addTo(map) : map.removeLayer(layers.heatmap);
            // Sync legend visibility with heatmap
            const legend = document.getElementById('heatmap-legend');
            if (legend) legend.classList.toggle('hidden', !visible);
            break;
        case 'lighting':
            layers.lightingCircles.forEach(c => visible ? c.addTo(map) : map.removeLayer(c));
            break;
        case 'police':
            layers.policeMarkers.forEach(m => visible ? m.addTo(map) : map.removeLayer(m));
            break;
    }
}

function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');

    // Desktop: old sidebar toggle (only used on tablet-ish widths if visible)
    if (toggle) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Mobile: initialize bottom sheet + tabs + FAB
    if (window.innerWidth <= 768) {
        initMobileUI();
    }

    // Re-check on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            initMobileUI();
        }
    });
}

/** Mobile state */
let _mobileInitialized = false;

function initMobileUI() {
    if (_mobileInitialized) return;
    _mobileInitialized = true;

    initBottomSheet();
    initTabNavigation();
    initFAB();

    // Default: show map tab (sheet hidden), route tab content loaded
    switchTab('map');
}

// ── Bottom Sheet Drag ──────────────────────────────────────
function initBottomSheet() {
    const sidebar = document.getElementById('sidebar');
    const handle = document.getElementById('sheet-handle');
    if (!handle || !sidebar) return;

    let startY = 0;
    let startTranslateY = 0;
    let isDragging = false;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;

    function getCurrentTranslateY() {
        const style = window.getComputedStyle(sidebar);
        const transform = style.transform;
        if (transform === 'none') return sidebar.offsetHeight;
        const matrix = new DOMMatrix(transform);
        return matrix.m42;
    }

    function setTranslateY(y) {
        const maxY = sidebar.offsetHeight;
        const clamped = Math.max(0, Math.min(maxY, y));
        sidebar.style.transition = 'none';
        sidebar.style.transform = `translateY(${clamped}px)`;
    }

    function snapTo(position) {
        const h = sidebar.offsetHeight;
        sidebar.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
        // Remove all sheet state classes
        sidebar.classList.remove('sheet-peek', 'sheet-half', 'sheet-full');

        switch (position) {
            case 'hidden':
                sidebar.style.transform = `translateY(${h}px)`;
                break;
            case 'peek':
                sidebar.classList.add('sheet-peek');
                sidebar.style.transform = '';
                break;
            case 'half':
                sidebar.classList.add('sheet-half');
                sidebar.style.transform = '';
                break;
            case 'full':
                sidebar.classList.add('sheet-full');
                sidebar.style.transform = '';
                break;
        }
    }

    handle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        startTranslateY = getCurrentTranslateY();
        lastY = startY;
        lastTime = Date.now();
        velocity = 0;
        sidebar.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        const now = Date.now();
        const dt = now - lastTime;

        if (dt > 0) {
            velocity = (currentY - lastY) / dt; // px/ms
        }

        lastY = currentY;
        lastTime = now;

        setTranslateY(startTranslateY + deltaY);
    }, { passive: true });

    handle.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        const currentY = getCurrentTranslateY();
        const h = sidebar.offsetHeight;
        const ratio = currentY / h;

        // Velocity-based snapping (flick up or down)
        if (velocity < -0.5) {
            // Fast swipe up → full
            snapTo('full');
        } else if (velocity > 0.5) {
            // Fast swipe down → hidden
            snapTo('hidden');
        } else {
            // Position-based snapping
            if (ratio < 0.25) {
                snapTo('full');
            } else if (ratio < 0.55) {
                snapTo('half');
            } else if (ratio < 0.85) {
                snapTo('peek');
            } else {
                snapTo('hidden');
            }
        }
    }, { passive: true });
}

// ── Tab Navigation ──────────────────────────────────────────
function initTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(10);
        });
    });
}

function switchTab(tabName) {
    const sidebar = document.getElementById('sidebar');
    const navItems = document.querySelectorAll('.nav-item');

    // Update nav active state
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });

    if (tabName === 'map') {
        // Map tab: hide bottom sheet, show only the map
        sidebar.classList.remove('sheet-peek', 'sheet-half', 'sheet-full');
        sidebar.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
        sidebar.style.transform = `translateY(${sidebar.offsetHeight}px)`;
    } else {
        // Show the bottom sheet in half position
        sidebar.classList.remove('sheet-peek', 'sheet-half', 'sheet-full');
        sidebar.classList.add('sheet-half');
        sidebar.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
        sidebar.style.transform = '';
    }

    // Toggle visibility of tab-content panels
    const allPanels = document.querySelectorAll('.tab-content');
    allPanels.forEach(panel => {
        if (panel.dataset.tab === tabName) {
            panel.classList.add('tab-active');
        } else {
            panel.classList.remove('tab-active');
        }
    });
}

// ── FAB — Report Unsafe Area ────────────────────────────────
function initFAB() {
    const fab = document.getElementById('fab-report');
    if (fab) {
        fab.addEventListener('click', () => {
            openReportModal();
            if (navigator.vibrate) navigator.vibrate(15);
        });
    }
}

// ============================================================
// 9. REPORT UNSAFE AREA
// ============================================================

function openReportModal() {
    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-lat').value = '';
    document.getElementById('report-lng').value = '';
    document.getElementById('report-desc').value = '';
    state.reportMode = true;
    showToast('Click on the map to pin the unsafe location.');
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
    state.reportMode = false;
}

function submitReport() {
    const lat = parseFloat(document.getElementById('report-lat').value);
    const lng = parseFloat(document.getElementById('report-lng').value);
    const type = document.getElementById('report-type').value;
    const desc = document.getElementById('report-desc').value.trim();

    if (isNaN(lat) || isNaN(lng)) {
        showToast('Select a location on the map first.');
        return;
    }
    if (!desc) {
        showToast('Please provide a description.');
        return;
    }

    state.userReports.push({ lat, lng, type, description: desc, timestamp: Date.now() });
    localStorage.setItem('unsafeReports', JSON.stringify(state.userReports));

    renderUserReports();
    updateAnalytics();
    closeReportModal();
    showToast('Report submitted successfully.');
}

// ============================================================
// 10. INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Button events
    document.getElementById('btn-find-route').addEventListener('click', findRoutes);
    document.getElementById('btn-clear').addEventListener('click', clearAll);
    document.getElementById('btn-my-location').addEventListener('click', useMyLocation);
    document.getElementById('btn-report').addEventListener('click', openReportModal);
    document.getElementById('btn-submit-report').addEventListener('click', submitReport);
    document.getElementById('btn-cancel-report').addEventListener('click', closeReportModal);

    // Close modal button (X)
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeReportModal);

    // Layer toggles
    document.getElementById('toggle-crime').addEventListener('change', (e) => toggleLayer('crime', e.target.checked));
    document.getElementById('toggle-lighting').addEventListener('change', (e) => toggleLayer('lighting', e.target.checked));
    document.getElementById('toggle-police').addEventListener('change', (e) => toggleLayer('police', e.target.checked));
    document.getElementById('toggle-units').addEventListener('change', (e) => {
        if (e.target.checked) {
            renderSpecializedUnits();
        } else {
            layers.unitMarkers.forEach(m => map.removeLayer(m));
            layers.unitMarkers = [];
        }
    });
    document.getElementById('toggle-hotspots').addEventListener('change', (e) => {
        if (e.target.checked) {
            renderHotspotZones();
        } else {
            layers.hotspotCircles.forEach(c => map.removeLayer(c));
            layers.hotspotCircles = [];
        }
    });

    // Sidebar mobile toggle
    setupSidebarToggle();

    // Close modal on overlay click
    document.getElementById('report-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeReportModal();
    });

    // ── AI: Safety Mode toggles ────────────────────────────
    ['mode-women-safety', 'mode-avoid-dark', 'mode-avoid-property', 'mode-avoid-cyber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', _onSafetyModeChange);
    });

    // ── AI: Chat Assistant ─────────────────────────────────
    const chatToggle = document.getElementById('ai-chat-toggle');
    const chatBody = document.getElementById('ai-chat-body');
    if (chatToggle && chatBody) {
        chatToggle.addEventListener('click', () => {
            chatBody.classList.toggle('open');
            const chevron = document.getElementById('ai-chat-chevron');
            if (chevron) chevron.style.transform = chatBody.classList.contains('open') ? 'rotate(180deg)' : '';
        });
    }
    const chatInput = document.getElementById('ai-chat-input');
    const chatSend = document.getElementById('ai-chat-send');
    if (chatInput && chatSend) {
        chatSend.addEventListener('click', _sendChatMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') _sendChatMessage();
        });
    }

    // Load data and render layers
    loadAllData();
});

// ============================================================
// AI FEATURE INTEGRATIONS
// ============================================================

/** Initialize AI-powered features after data load */
function initAIFeatures() {
    if (typeof AI === 'undefined') return;

    // Render forecast
    if (state.crimeTrends && state.crimeTrends.annual_totals) {
        const forecast = AI.forecastTrends(state.crimeTrends.annual_totals);
        _renderForecast(forecast);
    }

    // Detect anomalies
    if (state.crimeStats && state.crimeStats.detailed_crimes) {
        const anomalies = AI.detectAnomalies(state.crimeStats.detailed_crimes);
        _renderAnomalies(anomalies);
    }
}

/** Render AI Forecast panel */
function _renderForecast(forecast) {
    const yearEl = document.getElementById('forecast-year');
    const valueEl = document.getElementById('forecast-value');
    const changeEl = document.getElementById('forecast-change');
    const confFill = document.getElementById('forecast-conf-fill');
    const confVal = document.getElementById('forecast-conf-val');

    if (yearEl) yearEl.textContent = forecast.predictedYear || '—';
    if (valueEl) valueEl.textContent = forecast.predictedCases > 0 ? forecast.predictedCases.toLocaleString('en-IN') : '—';
    if (changeEl) {
        const sign = forecast.percentChange > 0 ? '+' : '';
        changeEl.textContent = sign + forecast.percentChange + '%';
        changeEl.className = 'forecast-change ' + (forecast.percentChange > 0 ? 'up' : 'down');
    }
    if (confFill) confFill.style.width = forecast.confidence + '%';
    if (confVal) confVal.textContent = forecast.confidence + '%';
}

/** Render anomaly badges */
function _renderAnomalies(anomalies) {
    const container = document.getElementById('ai-anomalies');
    if (!container) return;

    const flagged = anomalies.filter(a => a.isAnomaly);
    if (flagged.length === 0) {
        container.innerHTML = '<div class="anomaly-none">No unusual spikes detected</div>';
        return;
    }

    container.innerHTML = flagged.map(a => `
        <div class="anomaly-badge">
            <span class="anomaly-pulse"></span>
            <span class="anomaly-text">Unusual Spike: <strong>${a.crimeType}</strong> (+${a.change}% YoY, z=${a.zScore})</span>
        </div>
    `).join('');
}

/** Handle safety mode toggle changes */
function _onSafetyModeChange() {
    state.safetyModes.womenSafety = document.getElementById('mode-women-safety')?.checked || false;
    state.safetyModes.avoidDarkAreas = document.getElementById('mode-avoid-dark')?.checked || false;
    state.safetyModes.avoidPropertyCrime = document.getElementById('mode-avoid-property')?.checked || false;
    state.safetyModes.avoidCyberHotspots = document.getElementById('mode-avoid-cyber')?.checked || false;

    // Recalculate routes if they exist
    if (state.shortestRoute && state.safestRoute) {
        updateRoutePanel(state.shortestRoute, state.safestRoute);
        showToast('AI Risk scores updated with new safety priorities.');
    }
}

/** Send chat message to AI assistant */
function _sendChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const messages = document.getElementById('ai-chat-messages');
    if (!input || !messages) return;

    const query = input.value.trim();
    if (!query) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg user';
    userMsg.innerHTML = `<div class="ai-msg-text">${_escapeHtml(query)}</div>`;
    messages.appendChild(userMsg);

    // Get AI response
    const result = AI.chat(query, state);

    // Add bot response (with simple markdown-like rendering)
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-msg bot';
    botMsg.innerHTML = `<div class="ai-msg-text">${_formatChat(result.text)}</div>`;
    messages.appendChild(botMsg);

    // Scroll to bottom
    messages.scrollTop = messages.scrollHeight;
    input.value = '';
}

/** Escape HTML special chars */
function _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Format chat response (basic markdown) */
function _formatChat(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/•/g, '&bull;');
}
