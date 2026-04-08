# Approach and Implementation of SafeRoute Hyderabad

**SafeRoute Hyderabad — Civic AI Safety Intelligence Platform**
*Smart Navigation for Safer City Travel*

---

## 7.1 Introduction to Implementation Approach

SafeRoute Hyderabad is a client-side, AI-powered civic safety intelligence platform designed to assist commuters in navigating Hyderabad city through routes that prioritize personal safety over mere distance optimization. Unlike traditional navigation systems that recommend the shortest or fastest path, SafeRoute evaluates multiple environmental risk factors — including crime density, lighting conditions, police station proximity, and historical incident severity — to recommend the safest possible route between any two points within the city.

The system is built entirely on a **modular front-end architecture** using standard web technologies (HTML5, CSS3, and JavaScript ES6+), without reliance on any server-side backend or paid third-party APIs. The application is structured into four principal modules, each encapsulating a distinct domain of responsibility:

1. **Presentation Layer** (`index.html`, `style.css`) — Defines the user interface structure and visual design, encompassing the interactive sidebar, map container, analytics dashboard panels, AI chat interface, and mobile-responsive navigation.

2. **Core Application Logic** (`script.js`) — Manages the complete application lifecycle, including data loading, map initialization, safety layer rendering, route computation, safety score evaluation, dashboard analytics, and all user interaction handling.

3. **AI Engine Module** (`ai-engine.js`) — Houses all artificial intelligence and statistical analysis capabilities, including dynamic risk scoring, route risk assessment, linear regression-based trend forecasting, anomaly detection, personalized safety weight computation, and the rule-based civic AI chatbot.

4. **Data Layer** (`data/*.json`) — Comprises eight structured JSON files containing crime zone coordinates, police station records, poorly-lit area definitions, crime statistics, severity weight configurations, annual crime trends, high-severity incident records, and law enforcement organizational data.

This modular separation ensures that each component can be developed, tested, and maintained independently, while also enabling straightforward future enhancements such as real-time data integration or advanced machine learning model deployment.

---

## 7.2 Overall Working of the System

The SafeRoute Hyderabad application follows a well-defined sequential workflow from initialization to final route presentation. This section describes the complete step-by-step flow of the system.

### 7.2.1 Application Initialization

When the user loads the application in a web browser, the system executes an initialization sequence. The `index.html` file loads the required external libraries — Leaflet.js for interactive map rendering, Leaflet.heat for heatmap visualization, and Lucide for SVG iconography — followed by the application's own stylesheets and JavaScript modules. The map is initialized and centered on Hyderabad's geographic coordinates (latitude 17.3850, longitude 78.4867) at a default zoom level of 12, using the CARTO Dark Matter tile layer as the basemap for a professional, dark-themed cartographic presentation.

### 7.2.2 Data Loading and Processing

Immediately upon initialization, the `loadAllData()` function executes asynchronous parallel fetches of all eight JSON datasets using the JavaScript `Promise.all()` mechanism. This concurrent loading approach minimizes the total data acquisition time. The fetched datasets are parsed and stored in a centralized application state object (`state`), which serves as the single source of truth throughout the application's runtime. Additionally, any previously submitted user safety reports are retrieved from the browser's `localStorage` and merged into the application state.

### 7.2.3 Safety Layer Rendering

Once all data is loaded, the system renders three primary safety overlay layers on the map: the crime heatmap (displaying 300 geocoded crime zones with severity-weighted intensity), the poorly-lit area zones (visualized as translucent amber circles with opacity proportional to darkness levels), and the police station markers (rendered as green shield icons with interactive popup information). Each layer is controlled by toggle switches in the sidebar, allowing the user to selectively enable or disable individual overlays.

### 7.2.4 Dashboard Analytics Population

Concurrently with layer rendering, the system populates the analytics dashboard panels with processed crime statistics. This includes year-over-year crime comparisons, crime category breakdown visualizations, commissionerate performance cards, top hotspot station rankings, cybercrime impact figures, high-severity incident timelines, and law enforcement statistics. The AI engine also generates a crime trend forecast and performs anomaly detection, displaying the results in dedicated sub-sections of the dashboard.

### 7.2.5 Route Computation and Safety Evaluation

When the user selects an origin and destination — either by clicking on the map, using GPS geolocation, or entering coordinates — and initiates route computation, the system queries the OSRM (Open Source Routing Machine) public API for multiple alternative driving routes. Each returned route is then independently evaluated by the safety scoring algorithm, which samples approximately 100 points along the route geometry and assesses crime zone proximity, lighting conditions, police station coverage, and user-reported hazards at each sample point. The route with the minimum distance is designated the "Shortest Route," while the route with the highest computed safety score is labeled the "Safest Route." Both routes are displayed on the map with visually distinct styling and compared side-by-side in the route comparison panel with detailed metrics.

### 7.2.6 Continuous User Interaction

Throughout the session, the user may toggle data layers on and off, enable personalized safety modes (such as Women Safety Priority or Avoid Dark Areas), submit unsafe area reports through the report modal, or interact with the rule-based AI chatbot to query area-specific safety information, crime statistics, or trend forecasts. The system responds dynamically to all interactions, updating the map visualization and analytics in real time.

---

## 7.3 Data Handling Approach

### 7.3.1 JSON-Based Data Architecture

SafeRoute Hyderabad employs a JSON-based data storage architecture, where all safety, crime, and law enforcement information is organized into eight distinct JSON files within the `data/` directory. This approach was chosen for several practical reasons: JSON is natively supported by JavaScript without requiring additional parsing libraries; the data can be served as static files without any database infrastructure; and the file-based structure allows for straightforward data updates and version control.

### 7.3.2 Crime and Safety Datasets

The primary dataset, `crime-zones.json`, contains 300 geocoded crime zone entries, each consisting of geographic coordinates (latitude and longitude), a crime type classification, an area name, a severity weight on a scale of 1 to 10, and an intensity value normalized between 0 and 1. The severity weights are calibrated according to criminological principles — violent offences such as murder carry a weight of 10, while lesser offences like petty theft are assigned weights between 2 and 4.

The `police-stations.json` file contains records for 35 police stations and 3 commissionerate headquarters, each with geographic coordinates, address, contact information, commissionerate assignment, and case volume figures. The `poorly-lit-areas.json` file defines 20 zones with low lighting levels across IT corridors, Outer Ring Road stretches, and construction areas, specifying the lighting level (as a fractional value between 0 and 1), radius of the dark zone in meters, and a descriptive annotation.

### 7.3.3 Statistical and Analytical Datasets

Beyond the spatial datasets, the system utilizes four additional JSON files for analytical purposes. The `crime-data.json` file contains aggregate crime statistics including year-over-year case counts for over 15 crime categories, property crime detection and recovery rates, cybercrime deep-dive metrics (including financial loss and recovery figures), and women safety statistics. The `crime-trends.json` file provides longitudinal data spanning 2021 to 2026, including annual IPC case totals, commissionerate-level breakdowns, and national comparison benchmarks. The `high-severity-incidents.json` file records eight notable anonymized incidents with full details including date, location, severity weight, and descriptive summaries. Finally, the `severity-engine.json` file defines the severity weight mappings for over 30 crime types and the risk band boundary definitions used by the AI engine.

### 7.3.4 Data Provenance

The aggregate statistical data and organizational structures are sourced from genuine public records, including the National Crime Records Bureau (NCRB) Annual Report and the Hyderabad City Police Annual Report 2025. The GPS coordinates for individual crime zones represent plausible geo-spatial estimates rather than exact crime scene locations, positioned to reflect known crime concentration patterns across the city's jurisdictions. This approach ensures that the application demonstrates realistic safety intelligence capabilities while maintaining appropriate data sensitivity.

---

## 7.4 Safety and AI Engine

### 7.4.1 Overview of the AI Module

The AI capabilities of SafeRoute Hyderabad are implemented entirely in client-side JavaScript within the `ai-engine.js` module, which exposes a global `AI` namespace. This design eliminates any dependency on external machine learning APIs or cloud-based inference services, ensuring that all computations execute locally in the user's browser. The AI engine comprises six core features: dynamic risk scoring, route risk assessment, linear regression trend forecasting, statistical anomaly detection, personalized safety weight adjustment, and a rule-based civic AI chatbot.

### 7.4.2 Dynamic Risk Scoring

The dynamic risk scoring function (`AI.computeRiskScore`) computes a composite risk value (0–100) for any given geographic coordinate by evaluating five weighted factors:

**Crime Density and Severity (40% weight):** The function iterates over all crime zone records and identifies those within an 800-metre radius of the evaluation point. For each proximate crime zone, the severity weight is retrieved and, during nighttime hours (8 PM to 5 AM), violent crimes with severity values of 8 or above receive a 25% amplification. The proximity factor is calculated as a linear decay function, where penalty is inversely proportional to the distance from the crime zone centre. The cumulative crime penalty is normalized to a 0–1 range.

**Time-of-Day Weight (20% weight):** The system determines the current time period — morning, afternoon, evening, or night — and assigns a corresponding risk multiplier. Morning periods receive the lowest weight (0.20), while nighttime receives the maximum weight (1.00), reflecting the well-established criminological observation that most urban violent crimes peak during late night and early morning hours.

**Lighting Proximity (15% weight):** Each poorly-lit area's impact is computed based on both the darkness level (inverted lighting value) and the geographic proximity of the evaluation point to the dark zone. During nighttime, the lighting concern multiplier is amplified by a factor of 1.5, while during daytime it is reduced by 50%, accurately reflecting the diminished relevance of artificial lighting during daylight hours.

**Hotspot Proximity (15% weight):** The function evaluates the proximity of the evaluation point to the city's top 10 crime hotspot station jurisdictions. The intensity factor is derived from each hotspot's case volume, normalized against the maximum observed case count, and applied with a linear proximity decay within a 1,500-metre radius.

**Incident Recency (10% weight):** Recent high-severity incidents near the evaluation point contribute an additional risk factor, with a 2-year temporal decay function that assigns greater weight to more recent incidents.

The composite risk score is computed as the weighted sum of these five factors, scaled to a 0–100 range, and classified into four risk levels: Low (0–25), Moderate (26–50), High (51–75), and Critical (76–100).

### 7.4.3 Route Safety Scoring Algorithm

Independent of the AI risk score, the core safety scoring algorithm in `script.js` (`computeSafetyScore`) evaluates routes using a sampling-based approach. The algorithm selects approximately 100 evenly spaced sample points along the route geometry and, at each point, calculates cumulative penalties and bonuses:

The crime zone penalty uses an exponential severity-squared weighting scheme, where a crime with severity 10 (such as murder) produces a penalty weight of 1.0, while a severity 4 offence (such as cybercrime) produces a weight of only 0.16. This quadratic relationship ensures that routes passing through areas of violent crime are penalized far more heavily than routes near low-severity offence zones. The penalty is applied in two concentric zones: an inner zone (within 350 metres) where the full penalty applies, and an outer decay zone (350 to 800 metres) where the penalty diminishes linearly with distance.

The poorly-lit area penalty operates similarly, with the darkness level (inverted lighting value) serving as the penalty magnitude, applied within and around each defined dark zone. The police station bonus provides a significant positive contribution for route segments passing within 600 metres of a police station, with a moderate bonus extending to 1,500 metres. User-reported unsafe areas impose additional penalties within a 400-metre radius.

The final safety score is computed as 100 minus the average penalty per sample point (scaled by a tuned multiplier of 12) plus the average bonus per sample point (scaled by a multiplier of 18), clamped to the range 0–100. A higher score indicates a safer route.

### 7.4.4 Linear Regression Trend Forecasting

The trend forecasting feature (`AI.forecastTrends`) implements a least-squares linear regression model on annual IPC (Indian Penal Code) crime case totals. The function accepts an array of year-total pairs, filters out partial-year data (such as year-to-date figures with fewer than 10,000 total cases), and computes the regression coefficients (slope and intercept) using the standard least-squares formulae. The coefficient of determination (R²) is calculated to measure the goodness of fit, and a confidence score is derived as a composite of R² (contributing up to 80%) and sample size (contributing up to 20%). The predicted case count for the next year is computed by evaluating the regression equation at the next year value.

This approach, while simplified compared to advanced time-series models, provides a reasonable directional forecast given the limited data points (5–6 years) and the inherent variability in annual crime reporting.

### 7.4.5 Anomaly Detection

The anomaly detection function (`AI.detectAnomalies`) applies a statistical z-score method across crime categories to identify unusual spikes. The function computes the mean and standard deviation of year-over-year percentage changes across all crime categories, then flags any category whose percentage change exceeds the threshold of mean plus 1.5 times the standard deviation (μ + 1.5σ). For each flagged anomaly, the z-score is reported, providing a quantitative measure of how many standard deviations the observed change lies above the mean. This technique, drawn from classical statistical process control, enables the system to automatically surface crime categories experiencing atypically large increases without requiring manually defined thresholds for each category.

---

## 7.5 Routing Mechanism

### 7.5.1 OSRM Integration

SafeRoute Hyderabad utilizes the Open Source Routing Machine (OSRM) public API for all route computation. OSRM is a high-performance, open-source routing engine that operates on OpenStreetMap road network data. The application sends HTTP GET requests to the OSRM demonstration server at `router.project-osrm.org`, requesting driving routes between the user-specified origin and destination coordinates. The API call is configured with the `alternatives=true` parameter to request multiple route alternatives (typically returning 2 to 5 distinct routes), `overview=full` for complete route geometry, and `geometries=geojson` to receive the route geometry in GeoJSON format compatible with Leaflet.js.

The use of the public OSRM API is a deliberate architectural decision: it requires no API key, incurs no cost, and provides reliable routing data based on the comprehensive OpenStreetMap road network. However, as a public demonstration server, it is subject to rate limiting for high-traffic applications, making it suitable for academic and demonstration purposes.

### 7.5.2 Shortest Route Versus Safest Route

Upon receiving the route alternatives from OSRM, the application evaluates each route through two distinct lenses:

The **Shortest Route** is determined by sorting all returned routes by their total distance in metres and selecting the route with the minimum distance. This corresponds to the conventional navigation approach and serves as the baseline for comparison.

The **Safest Route** is determined by computing the safety score for each returned route using the sampling-based safety scoring algorithm described in Section 7.4.3, and selecting the route with the highest safety score. If the shortest route also happens to be the safest (which can occur when all alternatives pass through similar areas), the system clearly indicates this to the user. Otherwise, the system displays both routes simultaneously on the map — the shortest route rendered as a dashed cyan polyline and the safest route as a solid green polyline — with a side-by-side comparison panel showing distance, estimated travel time, safety score, and AI risk assessment for each route.

This dual-route approach enables the user to make an informed decision, weighing the trade-off between travel distance (or time) and personal safety based on their individual priorities and circumstances.

---

## 7.6 Map Visualization

### 7.6.1 Leaflet.js Interactive Map

The map visualization is built on Leaflet.js (version 1.9.4), a lightweight, open-source JavaScript library widely used for interactive web mapping. The map is initialized with the CARTO Dark Matter tile layer, which provides a dark-themed, minimalist cartographic basemap that offers high contrast for overlaid safety data. The dark theme was selected for both aesthetic and functional reasons: it reduces visual clutter, enhances the visibility of heatmap gradients and coloured markers, and aligns with the application's professional, enterprise-grade design language.

### 7.6.2 Crime Heatmap Layer

The crime heatmap is rendered using the Leaflet.heat plugin, which generates a WebGL-accelerated heat visualization from an array of weighted geographic points. Each crime zone contributes a point to the heatmap with intensity proportional to its severity weight (normalized to the 0–1 range). The heatmap uses a custom six-stop colour gradient progressing from pale red (#FFE5E5, representing very low crime) through moderate red (#FF6B6B) to deep crimson (#660000, representing the most severe crime concentrations). The rendering parameters — a blur radius of 18 pixels, a point radius of 22 pixels, and a minimum opacity of 0.35 — are calibrated to produce a smooth, informative visualization at typical urban zoom levels.

### 7.6.3 Markers and Zone Overlays

Police stations are represented by custom SVG shield-shaped markers in green, with interactive popups displaying the station name, address, and contact information. Poorly-lit areas are visualized as translucent amber circles with opacity dynamically adjusted based on the darkness level — darker areas appear more opaque. User-reported unsafe locations are marked with red warning triangle icons. Crime hotspot zones (the top 10 high-case-volume police station jurisdictions) can be displayed as radius overlays when the user enables the "Hotspot Zones" toggle.

### 7.6.4 Route Visualization

Computed routes are drawn on the map using Leaflet polylines with a three-layer visual treatment for each route: an outer glow layer (wide, low-opacity), an inner glow layer (moderate width and opacity), and the main route line with the full colour and styling. The shortest route is rendered in cyan (#00D1FF) with a dashed pattern, while the safest route is rendered in green (#22C55E) as a solid line. Both routes feature a progressive reveal animation that draws the polyline from start to finish over approximately 1.5 seconds, providing a polished user experience.

---

## 7.7 User Interaction Flow

### 7.7.1 Selecting Origin and Destination

Upon loading the application, the user is presented with the interactive map and a sidebar containing the Route Planner panel. The user selects the origin (Point A) by clicking on the map; the first click places a green pin-shaped marker at the chosen location and populates the Origin input field with the coordinates. The second click places the destination (Point B) as a red marker. Alternatively, the user may tap the GPS button to use their device's Geolocation API and set their current physical location as the origin point. Once both points are set, the user clicks "Find Routes" to initiate route computation.

### 7.7.2 Toggling Safety Layers

The Safety Layers panel in the sidebar provides three toggle switches corresponding to the Crime Heatmap, Low-Light Zones, and Police Stations layers. Each toggle adds or removes the corresponding visual overlay on the map in real time, allowing the user to customize the information density of the display according to their analytical needs. Additional toggles for Specialized Police Units and Hotspot Zones are available in the Law Enforcement panel.

### 7.7.3 Applying Safety Filters and Modes

The Personalized Safety Modes panel offers four AI-powered safety toggles: Women Safety Priority, Avoid Poorly Lit Areas, Avoid Property Crime Zones, and Avoid Cybercrime Hotspots. When enabled, these modes dynamically adjust the severity weights used by the AI risk scoring engine. For example, activating Women Safety Priority elevates the weights for rape, sexual assault, POCSO, and kidnapping offences to the maximum value of 10, causing the risk assessment to heavily penalize routes passing through areas with concentrations of these specific crime types.

### 7.7.4 Dynamic System Updates

The system updates its visualizations and computations dynamically in response to user interactions. When safety modes are toggled, the AI risk scores displayed in the route comparison panel are recalculated immediately. The crime analytics dashboard panels, including trend charts it, commissionerate comparisons, and hotspot rankings, are populated on initial load and remain accessible through the sidebar's tabbed navigation. The AI chatbot in the floating chat panel processes user queries in real time, matching them against nine intent patterns using regular expressions and returning area-specific safety reports, crime statistics, or trend forecasts derived entirely from the loaded local datasets.

---

## 7.8 Storage Mechanism

### 7.8.1 Browser LocalStorage

SafeRoute Hyderabad utilizes the browser's `localStorage` API as its sole persistent storage mechanism. This web-native key-value store persists data across browser sessions without requiring any server-side storage infrastructure, aligning with the application's fully client-side architecture.

### 7.8.2 Storing User Reports

When a user submits an unsafe area report through the report modal — specifying the location coordinates, incident type (theft, assault, harassment, poor lighting, accident, or other), and a textual description — the report object is appended to the existing array of user reports and saved to `localStorage` under the key `unsafeReports`. Each report includes a timestamp generated at submission time. Upon subsequent application loads, these stored reports are retrieved from `localStorage`, merged into the application state, rendered as red warning markers on the map, and factored into the safety scoring algorithm for future route computations.

### 7.8.3 Storing User Preferences

The personalized safety mode selections (Women Safety Priority, Avoid Dark Areas, Avoid Property Crime, Avoid Cyber Hotspots) are maintained in the application's runtime state object. While the current implementation retains these preferences only for the duration of the session, the `localStorage` infrastructure is readily available for persisting these preferences across sessions in future iterations.

---

## 7.9 Deployment Approach

### 7.9.1 Static Site Architecture

SafeRoute Hyderabad is designed as a fully static web application, meaning it consists entirely of HTML, CSS, JavaScript, and JSON files that can be served by any standard HTTP file server. There is no server-side application logic, no database server, and no backend API — all processing, including AI computations, safety scoring, and data analysis, occurs exclusively within the user's web browser.

This architectural decision offers several significant advantages: zero server infrastructure cost, elimination of backend security vulnerabilities, unlimited horizontal scalability (as each client bears its own computational load), and the ability to deploy on any static file hosting platform without configuration.

### 7.9.2 Hosting Platforms

The application is compatible with all major static site hosting services:

**GitHub Pages** provides free hosting directly from a GitHub repository, accessible by enabling Pages in the repository settings and pointing to the main branch. The application becomes available at `https://<username>.github.io/safe-route-hyderabad/`.

**Vercel** offers zero-configuration deployment via the `npx vercel --prod` command, automatically detecting the project as a static site and deploying it to a global CDN with an SSL certificate.

**Netlify** supports drag-and-drop deployment, where the entire project folder can be uploaded through the Netlify web interface, with automatic SSL provisioning and a globally distributed CDN.

### 7.9.3 Runtime Requirements

The only runtime requirement is that the application be served over the HTTP or HTTPS protocol, rather than being opened directly as a local `file://` resource. This is because the `fetch()` API, used to load the JSON datasets, requires an HTTP origin for Cross-Origin Resource Sharing (CORS) compliance. For local development, a simple HTTP server — such as Python's built-in `http.server` module or the Node.js `serve` package — is sufficient.

---

## 7.10 System Workflow Summary

SafeRoute Hyderabad operates as a self-contained, client-side intelligence platform that transforms static crime and safety data into actionable, personalized navigation recommendations. When a user opens the application, the system initializes an interactive dark-themed map centred on Hyderabad and concurrently loads eight structured JSON datasets encompassing 300 crime zones, 35 police stations, 20 poorly-lit areas, multi-year crime trends, high-severity incident records, and law enforcement organizational data. These datasets are processed and rendered as interactive overlay layers — a severity-weighted crime heatmap, translucent dark zone circles, and police station markers — on the Leaflet.js map canvas.

The user designates an origin and destination through map clicks or GPS geolocation, and the system queries the OSRM public routing API for multiple alternative driving routes. Each route alternative is independently evaluated by a multi-factor safety scoring algorithm that samples 100 points along the route geometry and computes cumulative penalties for crime zone proximity (using exponential severity-squared weighting), poor lighting exposure, and user-reported hazards, while awarding bonuses for police station coverage. The route with the lowest distance is presented as the Shortest Route, while the route with the highest safety score is presented as the Safest Route, with both displayed simultaneously on the map and compared in a detailed side-by-side metrics panel.

In parallel, the AI engine computes a complementary risk assessment for each route by evaluating five weighted factors — crime density, time-of-day risk, lighting conditions, hotspot proximity, and incident recency — producing a composite score classified as Low, Moderate, High, or Critical. The analytics dashboard presents crime trend visualizations, commissionerate comparisons, hotspot rankings, cybercrime impact statistics, and an AI-powered linear regression forecast with confidence metrics and z-score anomaly detection. Users may further personalize the system by enabling safety modes that dynamically adjust crime category weights, submitting community safety reports that persist in the browser's localStorage and influence future route scoring, or querying the rule-based AI chatbot for area-specific safety assessments and crime statistics — all processed entirely within the browser without any data leaving the user's device.

---

*Document prepared for inclusion in the System Implementation chapter of the B.Tech project report.*
*Project: SafeRoute Hyderabad — Civic AI Safety Intelligence Platform*
