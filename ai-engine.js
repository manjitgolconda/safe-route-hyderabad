/* ============================================================
   SafeRoute Hyderabad — AI Engine Module
   ============================================================
   Client-side AI features — no external APIs, no backend.
   Exposes global `AI` namespace.

   Features:
     1. Dynamic Risk Scoring (time-aware, multi-factor)
     2. Route Risk Assessment
     3. Crime Trend Forecast (linear regression)
     4. Anomaly Detection (statistical z-score)
     5. Personalized Safety Weights
     6. Rule-Based Civic AI Assistant
   ============================================================ */

const AI = (() => {
    'use strict';

    // ── Haversine helper (meters) ──────────────────────────────
    function _haversine(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Time period detection ──────────────────────────────────
    function _getTimePeriod(hour) {
        if (hour === undefined || hour === null) hour = new Date().getHours();
        if (hour >= 5 && hour < 12)  return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 20) return 'evening';
        return 'night'; // 20-5
    }

    function _isNight(hour) {
        if (hour === undefined || hour === null) hour = new Date().getHours();
        return hour >= 20 || hour < 5;
    }

    // ── Time weight multiplier ────────────────────────────────
    function _timeWeight(hour) {
        const period = _getTimePeriod(hour);
        switch (period) {
            case 'morning':   return 0.20;
            case 'afternoon': return 0.30;
            case 'evening':   return 0.65;
            case 'night':     return 1.00;
            default:          return 0.50;
        }
    }

    // ================================================================
    // FEATURE 1 — Dynamic AI Risk Score (point-level)
    // ================================================================
    /**
     * Compute risk score for a single lat/lng point.
     * @param {number} lat
     * @param {number} lng
     * @param {object} appState - Application state with crimeData, lightingData, etc.
     * @param {object} [opts] - { hour, safetyModes }
     * @returns {{ score: number, level: string, color: string }}
     */
    function computeRiskScore(lat, lng, appState, opts = {}) {
        const hour = opts.hour !== undefined ? opts.hour : new Date().getHours();
        const modes = opts.safetyModes || {};
        const weights = opts.adjustedWeights || null;

        // ── 1. Crime density & severity (40%) ──────────────
        let crimeRaw = 0;
        const CRIME_RADIUS = 800;
        let crimeCount = 0;

        (appState.crimeData || []).forEach(zone => {
            const dist = _haversine(lat, lng, zone.lat, zone.lng);
            if (dist < CRIME_RADIUS) {
                let sev = zone.severity_weight || zone.severity || 5;
                // Apply personalized weight adjustments
                if (weights && zone.crime_type) {
                    const key = zone.crime_type.toLowerCase().replace(/[\s\/]+/g, '_');
                    if (weights[key] !== undefined) sev = weights[key];
                }
                // Night boost for violent crimes
                if (_isNight(hour) && sev >= 8) sev = Math.min(10, sev * 1.25);
                const proximity = 1 - (dist / CRIME_RADIUS);
                crimeRaw += proximity * (sev / 10);
                crimeCount++;
            }
        });
        const crimeWeight = Math.min(1, crimeRaw / 5); // Normalize

        // ── 2. Time weight (20%) ──────────────────────────
        const timeW = _timeWeight(hour);

        // ── 3. Lighting proximity (15%) ───────────────────
        let lightingRaw = 0;
        (appState.lightingData || []).forEach(area => {
            const dist = _haversine(lat, lng, area.lat, area.lng);
            const darkness = 1 - area.lightingLevel;
            if (dist < area.radius * 1.5) {
                const prox = 1 - (dist / (area.radius * 1.5));
                lightingRaw += prox * darkness;
            }
        });
        // Night amplifies lighting concern
        let lightingWeight = Math.min(1, lightingRaw / 2);
        if (_isNight(hour)) lightingWeight = Math.min(1, lightingWeight * 1.5);
        else lightingWeight *= 0.5; // Day reduces lighting impact

        // ── 4. Hotspot proximity (15%) ────────────────────
        let hotspotRaw = 0;
        const hotspots = (appState.crimeTrends && appState.crimeTrends.top_hotspot_stations) || [];
        const stationCoords = {};
        (appState.policeData || []).forEach(ps => {
            const name = ps.name.replace(' Police Station', '').replace(' Commissionerate HQ', '');
            stationCoords[name] = { lat: ps.lat, lng: ps.lng };
        });
        hotspots.forEach(h => {
            const coords = stationCoords[h.station];
            if (!coords) return;
            const dist = _haversine(lat, lng, coords.lat, coords.lng);
            if (dist < 1500) {
                const prox = 1 - (dist / 1500);
                const intensity = h.cases / 1600; // Normalize by max
                hotspotRaw += prox * intensity;
            }
        });
        const hotspotWeight = Math.min(1, hotspotRaw);

        // ── 5. Incident recency (10%) ─────────────────────
        let incidentRaw = 0;
        (appState.highSeverityIncidents || []).forEach(inc => {
            const dist = _haversine(lat, lng, inc.lat, inc.lng);
            if (dist < 1000) {
                const prox = 1 - (dist / 1000);
                // Recency: more recent = higher weight
                const daysAgo = (Date.now() - new Date(inc.date).getTime()) / 86400000;
                const recency = Math.max(0.2, 1 - (daysAgo / 730)); // 2-year decay
                incidentRaw += prox * recency * (inc.severity_weight / 10);
            }
        });
        const incidentWeight = Math.min(1, incidentRaw);

        // ── Composite Score ───────────────────────────────
        const raw = (crimeWeight * 0.40) +
                    (timeW * 0.20) +
                    (lightingWeight * 0.15) +
                    (hotspotWeight * 0.15) +
                    (incidentWeight * 0.10);

        const score = Math.round(Math.min(100, raw * 100));

        // ── Risk Level ────────────────────────────────────
        let level, color;
        if (score <= 25)      { level = 'Low';      color = '#22c55e'; }
        else if (score <= 50) { level = 'Moderate';  color = '#f59e0b'; }
        else if (score <= 75) { level = 'High';      color = '#ef4444'; }
        else                  { level = 'Critical';  color = '#991b1b'; }

        return { score, level, color, breakdown: { crimeWeight, timeW, lightingWeight, hotspotWeight, incidentWeight } };
    }

    // ================================================================
    // FEATURE 2 — Route Risk Assessment
    // ================================================================
    /**
     * Compute average AI risk score for an entire route.
     * @param {object} routeGeojson - { coordinates: [[lng,lat],...] }
     * @param {object} appState
     * @param {object} [opts]
     * @returns {{ score, level, color, samples }}
     */
    function computeRouteRisk(routeGeojson, appState, opts = {}) {
        const coords = routeGeojson.coordinates;
        const sampleStep = Math.max(1, Math.floor(coords.length / 50));
        let totalScore = 0;
        let maxScore = 0;
        let sampleCount = 0;

        for (let i = 0; i < coords.length; i += sampleStep) {
            const result = computeRiskScore(coords[i][1], coords[i][0], appState, opts);
            totalScore += result.score;
            maxScore = Math.max(maxScore, result.score);
            sampleCount++;
        }

        const avgScore = Math.round(totalScore / sampleCount);
        let level, color;
        if (avgScore <= 25)      { level = 'Low';      color = '#22c55e'; }
        else if (avgScore <= 50) { level = 'Moderate';  color = '#f59e0b'; }
        else if (avgScore <= 75) { level = 'High';      color = '#ef4444'; }
        else                     { level = 'Critical';  color = '#991b1b'; }

        return { score: avgScore, level, color, maxScore, samples: sampleCount };
    }

    // ================================================================
    // FEATURE 3 — Linear Regression Trend Forecast
    // ================================================================
    /**
     * Simple least-squares linear regression on annual crime totals.
     * @param {Array} annualTotals - [{ year, total_ipc_cases }]
     * @returns {{ predictedYear, predictedCases, percentChange, confidence, rSquared, slope }}
     */
    function forecastTrends(annualTotals) {
        if (!annualTotals || annualTotals.length < 3) {
            return { predictedYear: null, predictedCases: 0, percentChange: 0, confidence: 0, rSquared: 0 };
        }

        // Use only complete years (exclude YTD like 2026)
        const data = annualTotals.filter(y => y.total_ipc_cases > 10000);
        const n = data.length;
        if (n < 3) return { predictedYear: null, predictedCases: 0, percentChange: 0, confidence: 0, rSquared: 0 };

        // Least squares
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        data.forEach(d => {
            sumX += d.year;
            sumY += d.total_ipc_cases;
            sumXY += d.year * d.total_ipc_cases;
            sumX2 += d.year * d.year;
            sumY2 += d.total_ipc_cases * d.total_ipc_cases;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // R² (coefficient of determination)
        const meanY = sumY / n;
        let ssRes = 0, ssTot = 0;
        data.forEach(d => {
            const predicted = slope * d.year + intercept;
            ssRes += (d.total_ipc_cases - predicted) ** 2;
            ssTot += (d.total_ipc_cases - meanY) ** 2;
        });
        const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

        // Predict next year
        const lastYear = data[data.length - 1].year;
        const predictedYear = lastYear + 1;
        const predictedCases = Math.round(slope * predictedYear + intercept);
        const lastCases = data[data.length - 1].total_ipc_cases;
        const percentChange = lastCases > 0 ? ((predictedCases - lastCases) / lastCases * 100).toFixed(1) : 0;

        // Confidence: based on R² and sample size
        const confidence = Math.min(100, Math.round(rSquared * 80 + Math.min(20, n * 4)));

        return { predictedYear, predictedCases, percentChange: +percentChange, confidence, rSquared: +rSquared.toFixed(3), slope: Math.round(slope) };
    }

    // ================================================================
    // FEATURE 4 — Anomaly Detection
    // ================================================================
    /**
     * Detect unusual spikes in crime categories.
     * Anomaly if current > mean + 1.5 × σ
     * @param {Array} detailedCrimes - [{ crime_type, cases_2024, cases_2025, percentage_change }]
     * @returns {Array} [{ crimeType, current, mean, stdDev, isAnomaly, zScore }]
     */
    function detectAnomalies(detailedCrimes) {
        if (!detailedCrimes || detailedCrimes.length < 2) return [];

        // Compute mean and stddev of percentage changes
        const changes = detailedCrimes.map(c => c.percentage_change).filter(c => c !== undefined);
        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((a, b) => a + (b - mean) ** 2, 0) / changes.length;
        const stdDev = Math.sqrt(variance);

        return detailedCrimes.map(crime => {
            const change = crime.percentage_change || 0;
            const threshold = mean + 1.5 * stdDev;
            const zScore = stdDev > 0 ? ((change - mean) / stdDev).toFixed(2) : 0;
            return {
                crimeType: crime.crime_type,
                current: crime.cases_2025,
                change,
                mean: +mean.toFixed(1),
                stdDev: +stdDev.toFixed(1),
                isAnomaly: change > threshold,
                zScore: +zScore,
            };
        });
    }

    // ================================================================
    // FEATURE 5 — Personalized Safety Weights
    // ================================================================
    /**
     * Adjust severity weights based on user-selected safety modes.
     * @param {object} baseWeights - From severity-engine.json
     * @param {object} modes - { womenSafety, avoidDarkAreas, avoidPropertyCrime, avoidCyberHotspots }
     * @returns {object} Modified weights
     */
    function personalizedWeights(baseWeights, modes) {
        const w = { ...baseWeights };

        if (modes.womenSafety) {
            w.rape = 10;
            w.sexual_assault = 10;
            w.crime_against_women = 10;
            w.pocso = 10;
            w.domestic_violence = 10;
            w.harassment = 9;
            w.kidnapping = 10;
        }

        if (modes.avoidDarkAreas) {
            w.poor_lighting = 8;    // up from 3
            w.robbery = 10;         // dark areas + robbery
            w.chain_snatching = 9;
            w.assault = 9;
        }

        if (modes.avoidPropertyCrime) {
            w.theft = 8;
            w.major_theft = 9;
            w.automobile_theft = 8;
            w.house_breaking = 9;
            w.robbery = 10;
        }

        if (modes.avoidCyberHotspots) {
            w.cybercrime = 8;       // up from 4
            w.cyber_fraud = 8;
            w.digital_arrest = 8;
        }

        return w;
    }

    // ================================================================
    // FEATURE 6 — Rule-Based Civic AI Assistant
    // ================================================================

    // Intent patterns
    const _intents = [
        {
            patterns: [/safe.*\b(at night|night|evening)\b/i, /\b(night|evening)\b.*safe/i, /danger.*(night|evening)/i],
            handler: _handleNightSafety,
        },
        {
            patterns: [/safe.*\b(\w+)\b/i, /\b(\w+)\b.*safe/i, /how.*safe.*\b(\w+)\b/i],
            handler: _handleAreaSafety,
        },
        {
            patterns: [/cyber\s?crime/i, /cyber.*stat/i, /online.*fraud/i, /digital.*arrest/i],
            handler: _handleCyberStats,
        },
        {
            patterns: [/women.*safe/i, /she.*team/i, /pocso/i, /crime.*against.*women/i],
            handler: _handleWomenSafety,
        },
        {
            patterns: [/highest.*crime/i, /most.*dangerous/i, /worst.*area/i, /top.*hotspot/i, /most.*crime/i],
            handler: _handleTopCrime,
        },
        {
            patterns: [/trend/i, /forecast/i, /predict/i, /next year/i],
            handler: _handleTrendForecast,
        },
        {
            patterns: [/total.*crime/i, /how many.*case/i, /crime.*stat/i, /overall.*crime/i],
            handler: _handleOverallStats,
        },
        {
            patterns: [/police.*station/i, /nearest.*station/i, /station.*near/i],
            handler: _handlePoliceInfo,
        },
        {
            patterns: [/help/i, /what can you/i, /commands/i],
            handler: _handleHelp,
        },
    ];

    // Known areas for matching
    const _knownAreas = [
        'gachibowli', 'madhapur', 'narsingi', 'kondapur', 'raidurgam', 'jubilee hills',
        'banjara hills', 'charminar', 'koti', 'secunderabad', 'kukatpally', 'miyapur',
        'uppal', 'lb nagar', 'l.b. nagar', 'chandrayangutta', 'vanasthalipuram',
        'malkajgiri', 'begumpet', 'falaknuma', 'abids', 'nampally', 'habsiguda',
    ];

    function _findArea(query) {
        const q = query.toLowerCase();
        return _knownAreas.find(a => q.includes(a));
    }

    function _handleNightSafety(query, appState) {
        const area = _findArea(query);
        if (area) {
            // Find crime zones in the area
            const areaZones = (appState.crimeData || []).filter(z =>
                z.area_name && z.area_name.toLowerCase().includes(area)
            );
            const avgSev = areaZones.length > 0
                ? (areaZones.reduce((s, z) => s + (z.severity_weight || 5), 0) / areaZones.length).toFixed(1)
                : 'N/A';
            const count = areaZones.length;

            // Check hotspot rank
            const hotspots = (appState.crimeTrends && appState.crimeTrends.top_hotspot_stations) || [];
            const hotspot = hotspots.find(h => h.station.toLowerCase().includes(area));

            let response = `🌙 **Night Safety — ${area.charAt(0).toUpperCase() + area.slice(1)}**\n\n`;
            response += `Crime zones nearby: **${count}**\nAvg severity: **${avgSev}/10**\n`;
            if (hotspot) {
                response += `⚠️ This is **Hotspot #${hotspot.rank}** with **${hotspot.cases.toLocaleString('en-IN')}** cases.\n`;
            }
            response += `\n**Night risk factors:** Violent crime weight increases 25%. Poor lighting zones become critical concern. Exercise caution.`;
            if (avgSev !== 'N/A' && avgSev > 6) {
                response += `\n\n🔴 **Not recommended** for travel at night without precaution.`;
            } else {
                response += `\n\n🟡 **Moderate risk.** Stay on well-lit main roads.`;
            }
            return { text: response };
        }
        return { text: '🌙 **Night Safety Tips**\n\nNight (8PM–5AM) increases violent crime risk by 25%. Poorly-lit areas are especially dangerous.\n\n**Recommendations:**\n• Use mapped routes via SafeRoute\n• Avoid poorly-lit stretches\n• Stay near police station corridors\n\nAsk about a specific area: e.g., "Is Gachibowli safe at night?"' };
    }

    function _handleAreaSafety(query, appState) {
        const area = _findArea(query);
        if (!area) {
            return { text: '🔍 I can check safety for known areas like Gachibowli, Madhapur, Charminar, Koti, Jubilee Hills, etc.\n\nTry: "Is Gachibowli safe?"' };
        }

        const areaZones = (appState.crimeData || []).filter(z =>
            z.area_name && z.area_name.toLowerCase().includes(area)
        );
        const count = areaZones.length;
        const avgSev = count > 0
            ? (areaZones.reduce((s, z) => s + (z.severity_weight || 5), 0) / count).toFixed(1)
            : 'N/A';

        const hotspots = (appState.crimeTrends && appState.crimeTrends.top_hotspot_stations) || [];
        const hotspot = hotspots.find(h => h.station.toLowerCase().includes(area));

        let response = `📍 **Safety Report — ${area.charAt(0).toUpperCase() + area.slice(1)}**\n\n`;
        response += `Crime zones: **${count}**\nAvg severity: **${avgSev}/10**\n`;
        if (hotspot) {
            response += `Hotspot rank: **#${hotspot.rank}** (${hotspot.cases.toLocaleString('en-IN')} cases)\nZone: ${hotspot.zone}\n`;
        }

        if (avgSev > 7) response += `\n🔴 **High risk area.** Use SafeRoute for safest paths.`;
        else if (avgSev > 4) response += `\n🟡 **Moderate risk.** Stay alert, especially at night.`;
        else response += `\n🟢 **Relatively safe.** Standard precautions recommended.`;

        return { text: response };
    }

    function _handleCyberStats(query, appState) {
        const cd = appState.crimeStats && appState.crimeStats.cybercrime_deep_dive;
        if (!cd) return { text: 'Cybercrime data not available.' };

        let response = `💻 **Cybercrime Statistics**\n\n`;
        response += `Total cases (2024): **${cd.total_cases_2024.toLocaleString('en-IN')}**\n`;
        response += `Financial loss: **₹${cd.financial_loss_2024_crore} Crore**\n`;
        response += `Recovery rate: **${cd.recovery_rate_percent}%** (₹${cd.recovery_2024_crore} Cr)\n`;
        response += `National rank: **${cd.national_rank}**\n\n`;
        response += `**Top fraud types:**\n`;
        (cd.top_typologies || []).forEach(t => {
            response += `• ${t.type}: ${t.cases.toLocaleString('en-IN')} cases (${t.trend})\n`;
        });
        return { text: response };
    }

    function _handleWomenSafety(query, appState) {
        const ws = appState.crimeStats && appState.crimeStats.women_safety;
        if (!ws) return { text: 'Women safety data not available.' };

        let response = `👩 **Women Safety Data**\n\n`;
        response += `Crimes against women (2025): **${ws.crimes_against_women_2025.toLocaleString('en-IN')}**\n`;
        response += `YoY change: **+${ws.percentage_change}%**\n`;
        response += `POCSO cases: **${ws.pocso_2025}** (${ws.pocso_change > 0 ? '+' : ''}${ws.pocso_change}%)\n`;
        response += `SHE Teams active: **${ws.she_teams_active}**\n\n`;
        response += `💡 **Tip:** Enable "Women Safety Priority" mode in Safety Modes panel for optimized routing.`;
        return { text: response };
    }

    function _handleTopCrime(query, appState) {
        const hotspots = (appState.crimeTrends && appState.crimeTrends.top_hotspot_stations) || [];
        if (hotspots.length === 0) return { text: 'Hotspot data not available.' };

        let response = `🔥 **Top 5 Crime Hotspots (2024–25)**\n\n`;
        hotspots.slice(0, 5).forEach(h => {
            response += `**#${h.rank} ${h.station}** — ${h.cases.toLocaleString('en-IN')} cases (${h.zone})\n`;
        });
        response += `\n📍 Gachibowli leads with 1,562 cases — driven by transient IT workforce and cybercrime.`;
        return { text: response };
    }

    function _handleTrendForecast(query, appState) {
        const trends = appState.crimeTrends;
        if (!trends) return { text: 'Trend data not available.' };

        const forecast = forecastTrends(trends.annual_totals);
        let response = `📈 **AI Crime Trend Forecast**\n\n`;
        response += `Predicted cases (${forecast.predictedYear}): **${forecast.predictedCases.toLocaleString('en-IN')}**\n`;
        response += `Projected change: **${forecast.percentChange > 0 ? '+' : ''}${forecast.percentChange}%**\n`;
        response += `Confidence: **${forecast.confidence}%** (R²=${forecast.rSquared})\n`;
        response += `Trend slope: **${forecast.slope > 0 ? '+' : ''}${forecast.slope.toLocaleString('en-IN')}** cases/year\n\n`;
        response += `⚠️ *Experimental: based on linear regression of ${trends.annual_totals.filter(y => y.total_ipc_cases > 10000).length} years.*`;
        return { text: response };
    }

    function _handleOverallStats(query, appState) {
        const stats = appState.crimeStats;
        if (!stats) return { text: 'Crime statistics not available.' };

        let response = `📊 **Overall Crime Statistics**\n\n`;
        response += `Total cases 2024: **${stats.overall_crime.total_cases_2024.toLocaleString('en-IN')}**\n`;
        response += `Total cases 2025: **${stats.overall_crime.total_cases_2025.toLocaleString('en-IN')}**\n`;
        response += `YoY change: **${stats.overall_crime.percentage_change}%**\n`;
        response += `Cases/day: **${stats.overall_crime.cases_per_day_2025}**\n\n`;
        response += `Property detection rate: **${stats.property_crime_statistics.detection_rate_percent}%**\n`;
        response += `Property recovery: **₹${stats.property_crime_statistics.property_recovered_crore} Cr**`;
        return { text: response };
    }

    function _handlePoliceInfo(query, appState) {
        const stations = appState.policeData || [];
        let response = `👮 **Police Infrastructure**\n\n`;
        response += `Total stations mapped: **${stations.length}**\n\n`;
        const hotStations = stations.filter(s => s.hotspot_rank).sort((a, b) => a.hotspot_rank - b.hotspot_rank);
        if (hotStations.length > 0) {
            response += `**Busiest stations:**\n`;
            hotStations.slice(0, 5).forEach(s => {
                response += `• #${s.hotspot_rank} ${s.name} — ${s.case_volume.toLocaleString('en-IN')} cases\n`;
            });
        }
        return { text: response };
    }

    function _handleHelp() {
        return {
            text: `🤖 **SafeRoute AI Assistant**\n\nI can answer questions about:\n\n• **Area safety:** "Is Gachibowli safe at night?"\n• **Cybercrime:** "Show cybercrime stats"\n• **Women safety:** "Show women safety data"\n• **Hotspots:** "Which area has highest crime?"\n• **Trends:** "Show crime forecast"\n• **Stats:** "Show total crime statistics"\n• **Police:** "Show police station info"\n\nAll analysis runs locally — no data leaves your device.`,
        };
    }

    /**
     * Process a user query and return a response.
     * @param {string} query
     * @param {object} appState
     * @returns {{ text: string }}
     */
    function chat(query, appState) {
        if (!query || !query.trim()) {
            return { text: 'Please type a question. Try "help" for examples.' };
        }

        const q = query.trim();

        // Try each intent pattern
        for (const intent of _intents) {
            for (const pattern of intent.patterns) {
                if (pattern.test(q)) {
                    return intent.handler(q, appState);
                }
            }
        }

        // Fallback — check if query contains a known area name
        const area = _findArea(q);
        if (area) {
            return _handleAreaSafety(q, appState);
        }

        return {
            text: `I couldn't understand that query. Try asking:\n• "Is Gachibowli safe at night?"\n• "Show cybercrime stats"\n• "Which area has highest crime?"\n\nType **help** for all available commands.`,
        };
    }

    // ── Public API ────────────────────────────────────────────
    return {
        computeRiskScore,
        computeRouteRisk,
        forecastTrends,
        detectAnomalies,
        personalizedWeights,
        chat,
        // Utilities
        getTimePeriod: _getTimePeriod,
        isNight: _isNight,
    };
})();
