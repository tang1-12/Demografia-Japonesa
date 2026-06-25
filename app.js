/**
 * =============================================================
 *  JAPÓN 2080 — SIMULADOR DEMOGRÁFICO INTERACTIVO
 *  app.js  |  Lógica principal cliente (sin dependencias npm)
 * =============================================================
 *
 *  Módulos:
 *    1. DATOS BASE — Dataset estático real de Japón
 *    2. MODELO MATEMÁTICO — Proyección poblacional anual
 *    3. MAPA LEAFLET — Coropleta con polígonos de prefecturas
 *    4. CONTROLES — Sliders, radios, reproducción automática
 *    5. KPIs — Métricas globales y por región
 *    6. GRÁFICO — Chart.js proyección 2026–2080
 *    7. INICIALIZACIÓN
 */

'use strict';

/* =============================================================
   1. DATOS BASE — Demográficos reales de Japón (2026)
============================================================= */

/**
 * Parámetros globales de Japón según datos del
 * Statistics Bureau of Japan / World Bank 2024.
 */
const JAPAN_GLOBAL = {
    añoInicio:          2026,
    añoFin:             2080,
    poblacionInicial:   123_500_000,   // ~123.5 millones (2024 est.)
    tasaFertilidad:     1.20,          // hijos por mujer (2023)
    tasaFertReemplazo:  2.10,          // nivel de reemplazo
    esperanzaVida:      84.6,          // años (promedio)
    tasaMortalidad:     0.01230,       // tasa bruta de mortalidad anual (~ 12.3 por mil)
    tasaNatalidadBase:  0.00670,       // tasa bruta de natalidad (2023, ~6.7 por mil)
    porcentajeMayores65: 0.300,        // 30 % en 2024
    edadMedianiana:     49.1,          // años
};

/**
 * Tasas de inmigración anual según escenario.
 *  - Baja  : tendencia histórica (~10 000/año netos)
 *  - Media : escenario moderado de apertura (~100 000/año)
 *  - Alta  : política de inmigración activa (~300 000/año)
 */
const IMMIGRATION_RATES = {
    low:    10_000,
    medium: 100_000,
    high:   300_000,
};

/**
 * Dataset de regiones principales de Japón.
 * Cada región incluye su proporción de la población total,
 * su porcentaje de adultos mayores (+65), fertilidad local
 * y coordenadas geográficas para el polígono del mapa.
 *
 * Las proporciones suman 1.0 (100 %).
 * Fuentes: Statistics Bureau of Japan, prefectural vital stats 2022–2024.
 */
const REGIONS = {
    kanto: {
        id:       'kanto',
        nombre:   'Kantō / Tokio',
        emoji:    '🗼',
        proporcion:      0.284,   // 35.1 M / 123.5 M  (Tokio, Kanagawa, Saitama, Chiba, etc.)
        pctMayores65:    0.235,   // envejecimiento menor que media (alta natalidad relativa)
        fertilidadLocal: 1.08,   // Tokio tiene la fertilidad más baja del país
        descripcion: 'Región más densamente poblada. Tokio concentra el poder económico pero tiene la fertilidad más baja del país.',
        // Bounding-box aproximado de polígono (lat/lng GeoJSON simplificado)
        centro: [35.7, 139.7],
        zoom: 7,
        // Polígono simplificado (lat, lng)
        poligono: [
            [36.80, 138.60],
            [36.80, 140.80],
            [35.00, 140.90],
            [35.00, 138.80],
        ],
    },
    kansai: {
        id:       'kansai',
        nombre:   'Kansai / Osaka',
        emoji:    '🏯',
        proporcion:      0.175,   // ~21.6 M
        pctMayores65:    0.295,
        fertilidadLocal: 1.25,
        descripcion: 'Segundo polo urbano de Japón. Osaka y Kioto presentan un envejecimiento acelerado pese a su densidad.',
        centro: [34.7, 135.5],
        zoom: 7,
        poligono: [
            [35.60, 134.50],
            [35.60, 136.30],
            [33.80, 136.30],
            [33.80, 134.50],
        ],
    },
    tohoku: {
        id:       'tohoku',
        nombre:   'Tōhoku',
        emoji:    '🌨️',
        proporcion:      0.072,   // ~8.9 M
        pctMayores65:    0.370,   // envejecimiento extremo
        fertilidadLocal: 1.35,
        descripcion: 'Región del noreste duramente afectada por el terremoto de 2011. La diáspora de jóvenes hacia Tokio acelera el vaciamiento.',
        centro: [38.5, 141.0],
        zoom: 7,
        poligono: [
            [41.50, 139.50],
            [41.50, 142.00],
            [36.90, 141.50],
            [36.90, 139.80],
        ],
    },
    hokkaido: {
        id:       'hokkaido',
        nombre:   'Hokkaidō',
        emoji:    '🦊',
        proporcion:      0.042,   // ~5.2 M
        pctMayores65:    0.345,
        fertilidadLocal: 1.20,
        descripcion: 'La isla más septentrional es la más despoblada. Alta mortalidad, baja natalidad y escasa inmigración interior.',
        centro: [43.5, 142.8],
        zoom: 6,
        poligono: [
            [45.60, 139.40],
            [45.60, 145.90],
            [41.30, 145.90],
            [41.30, 139.40],
        ],
    },
    kyushu: {
        id:       'kyushu',
        nombre:   'Kyūshū / Okinawa',
        emoji:    '🌺',
        proporcion:      0.120,   // ~14.8 M
        pctMayores65:    0.300,
        fertilidadLocal: 1.48,   // Okinawa eleva el promedio (fertilidad más alta de Japón)
        descripcion: 'Okinawa tiene la tasa de fertilidad más alta de Japón (~1.8). Sin embargo, el resto de Kyūshū envejece a ritmo acelerado.',
        centro: [32.0, 130.5],
        zoom: 7,
        poligono: [
            [34.00, 128.50],
            [34.00, 131.80],
            [30.20, 131.80],
            [30.20, 128.50],
        ],
    },
    chugoku: {
        id:       'chugoku',
        nombre:   'Chūgoku',
        emoji:    '⛩️',
        proporcion:      0.058,   // ~7.2 M
        pctMayores65:    0.340,
        fertilidadLocal: 1.30,
        descripcion: 'Región occidental de Honshū. Hiroshima es su centro urbano. Despoblamiento rural severo.',
        centro: [34.7, 133.2],
        zoom: 7,
        poligono: [
            [35.50, 131.40],
            [35.50, 134.40],
            [33.80, 134.40],
            [33.80, 131.40],
        ],
    },
    shikoku: {
        id:       'shikoku',
        nombre:   'Shikoku',
        emoji:    '🍋',
        proporcion:      0.031,   // ~3.8 M
        pctMayores65:    0.355,
        fertilidadLocal: 1.28,
        descripcion: 'La isla más pequeña de las cuatro principales. Kochi y Tokushima tienen algunos de los índices de envejecimiento más altos del país.',
        centro: [33.8, 133.5],
        zoom: 7,
        poligono: [
            [34.60, 132.40],
            [34.60, 134.70],
            [32.90, 134.70],
            [32.90, 132.40],
        ],
    },
    chubu: {
        id:       'chubu',
        nombre:   'Chūbu / Nagoya',
        emoji:    '🏭',
        proporcion:      0.143,   // ~17.7 M
        pctMayores65:    0.280,
        fertilidadLocal: 1.38,
        descripcion: 'Corazón industrial de Japón. Toyota y la industria automotriz sostienen una economía fuerte, pero el envejecimiento avanza.',
        centro: [35.1, 137.2],
        zoom: 7,
        poligono: [
            [37.00, 136.00],
            [37.00, 138.70],
            [33.90, 138.70],
            [33.90, 136.00],
        ],
    },
};

/* =============================================================
   2. MODELO MATEMÁTICO — Proyección Poblacional Anual
============================================================= */

/**
 * Estado mutable de la simulación.
 * Se recalcula cada vez que el usuario mueve un slider.
 */
let estado = {
    año: 2026,
    fertilidad: 1.20,
    inmigracion: 'low',
    regionActiva: null,
    simulacion: [],          // Array de snapshots año a año (global)
    simRegiones: {},         // simulaciones por región
};

/**
 * Ejecuta la proyección demográfica año a año usando la fórmula:
 *
 *   P(t+1) = P(t) + Nacimientos(t) - Defunciones(t) + Inmigración
 *
 * donde:
 *   Nacimientos(t) = P(t) × [TFT / mujeres_por_persona] × [proporción_edad_fértil]
 *   Defunciones(t) = P(t) / esperanza_vida  (simplificado)
 *
 * También evoluciona el porcentaje de mayores de 65 mediante
 * una función de envejecimiento progresivo.
 *
 * @param {number} p0       - Población inicial
 * @param {number} tft      - Tasa de fertilidad total (sliders)
 * @param {number} inmiAnual - Inmigración anual (personas)
 * @param {number} pct65_0  - % iniciales de mayores de 65
 * @param {number} años     - Número de años a proyectar
 * @returns {Array<Object>} - Array de objetos {año, poblacion, pct65, edadMedia, crecimiento}
 */
function proyectar(p0, tft, inmiAnual, pct65_0, años = 54) {
    const resultados = [];

    let P       = p0;
    let pct65   = pct65_0;
    let edadMed = JAPAN_GLOBAL.edadMedianiana;

    // Tasas derivadas
    const esperanza   = JAPAN_GLOBAL.esperanzaVida;
    // Proporción de mujeres en edad fértil (aprox 22% del total)
    const propFertil  = 0.22;
    // Hijos por mujer → tasa de natalidad bruta ajustada
    // Nacimientos ≈ P × propFertil × (TFT / 30 años período reproductivo)
    const periodoRep  = 30;

    for (let i = 0; i <= años; i++) {
        const añoActual = JAPAN_GLOBAL.añoInicio + i;

        // Nacimientos: mujeres en edad fértil × hijos/mujer ÷ período reproductivo
        const mujeresFertiles = P * propFertil;
        const nacimientos     = Math.round(mujeresFertiles * (tft / periodoRep));

        // Defunciones: tasa de mortalidad dinámica que aumenta con el envejecimiento
        // tasaMortDinamica = (P65 × 0.04) + ((1 - P65) × 0.005)
        const tasaMortDin = pct65 * 0.042 + (1 - pct65) * 0.005;
        const defunciones = Math.round(P * tasaMortDin);

        // Crecimiento bruto antes de inmigración
        const deltaBruto = nacimientos - defunciones;
        const deltaNeto  = deltaBruto + inmiAnual;

        // Calcular tasa de crecimiento % anual
        const tasaCrec = P > 0 ? (deltaNeto / P) * 100 : 0;

        resultados.push({
            año:        añoActual,
            poblacion:  Math.round(P),
            pct65:      parseFloat(pct65.toFixed(4)),
            edadMedia:  parseFloat(edadMed.toFixed(1)),
            crecimiento: parseFloat(tasaCrec.toFixed(3)),
            nacimientos,
            defunciones,
        });

        // Actualizar para siguiente año
        P = Math.max(0, P + deltaNeto);

        // Evolución del porcentaje de mayores de 65:
        // El ratio sube ~0.3% por año base, moderado por nacimientos e inmigración
        const deltaEnv = 0.003 - (nacimientos / P) * 0.5 - (inmiAnual / P) * 0.3;
        pct65 = Math.min(0.60, Math.max(0.05, pct65 + deltaEnv));

        // Edad mediana evoluciona suavemente
        edadMed = Math.min(72, edadMed + 0.12 - (tft - 1.2) * 0.08);
    }

    return resultados;
}

/**
 * Calcula las proyecciones para todas las regiones.
 * Cada región escala sus datos de la proyección global.
 */
function calcularTodasRegiones() {
    const tft     = parseFloat(document.getElementById('slider-fertility').value);
    const inmOpt  = document.querySelector('input[name="immigration"]:checked').value;
    const inmiAnual = IMMIGRATION_RATES[inmOpt];

    estado.simRegiones = {};

    Object.values(REGIONS).forEach(region => {
        const p0Local   = Math.round(JAPAN_GLOBAL.poblacionInicial * region.proporcion);
        const tftLocal  = region.fertilidadLocal * (tft / JAPAN_GLOBAL.tasaFertilidad);
        const inmiLocal = Math.round(inmiAnual * region.proporcion);

        estado.simRegiones[region.id] = proyectar(
            p0Local,
            tftLocal,
            inmiLocal,
            region.pctMayores65,
        );
    });
}

/* =============================================================
   3. MAPA LEAFLET
============================================================= */

let mapInstance = null;
let regionLayers = {};
let regionLabels = {};

/**
 * Inicializa el mapa Leaflet con tiles CartoDB Dark Matter.
 * Solo se llama una vez en window.onload.
 */
function initMapa() {
    // Crear instancia del mapa centrada en Japón
    mapInstance = L.map('map', {
        center: [37.5, 137.5],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
        minZoom: 4,
        maxZoom: 9,
    });

    // Tiles CartoDB Dark Matter (gratuito, sin API key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://carto.com/">CARTO</a> | © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    }).addTo(mapInstance);

    // Dibujar polígonos de cada región
    Object.values(REGIONS).forEach(region => {
        dibujarRegion(region);
    });
}

/**
 * Convierte el porcentaje de envejecimiento en color del semáforo demográfico.
 *
 * @param {number} pct65  - Porcentaje de mayores de 65 (0–1)
 * @returns {string}      - Color CSS
 */
function colorPorEnvejecimiento(pct65) {
    // 0.20 → verde (estable)
    // 0.35 → ámbar (moderado)
    // 0.50+ → rojo (crisis severa)
    const t = Math.min(1, Math.max(0, (pct65 - 0.20) / 0.30));

    if (t < 0.5) {
        // Verde → Ámbar
        const r = Math.round(48  + (245 - 48)  * (t * 2));
        const g = Math.round(209 + (166 - 209) * (t * 2));
        const b = Math.round(88  + (35  - 88)  * (t * 2));
        return `rgb(${r},${g},${b})`;
    } else {
        // Ámbar → Rojo
        const tt = (t - 0.5) * 2;
        const r = Math.round(245 + (255 - 245) * tt);
        const g = Math.round(166 + (59  - 166) * tt);
        const b = Math.round(35  + (48  - 35)  * tt);
        return `rgb(${r},${g},${b})`;
    }
}

/**
 * Dibuja el polígono de una región en el mapa con estilos coropleta.
 *
 * @param {Object} region - Objeto de región de REGIONS
 */
function dibujarRegion(region) {
    const pct65 = region.pctMayores65;
    const color = colorPorEnvejecimiento(pct65);

    const layer = L.polygon(region.poligono, {
        color:       color,
        weight:      1.5,
        opacity:     0.9,
        fillColor:   color,
        fillOpacity: 0.35,
        className:   `region-${region.id}`,
    }).addTo(mapInstance);

    // Tooltip enriquecido
    layer.bindTooltip(construirTooltip(region, pct65), {
        className: 'region-tooltip',
        sticky:    true,
        direction: 'top',
        offset:    [0, -8],
    });

    // Click → seleccionar región
    layer.on('click', () => seleccionarRegion(region.id));

    // Hover
    layer.on('mouseover', () => {
        if (estado.regionActiva !== region.id) {
            layer.setStyle({ fillOpacity: 0.55, weight: 2 });
        }
    });
    layer.on('mouseout', () => {
        if (estado.regionActiva !== region.id) {
            layer.setStyle({ fillOpacity: 0.35, weight: 1.5 });
        }
    });

    regionLayers[region.id] = layer;
}

/**
 * Construye el HTML del tooltip de una región.
 *
 * @param {Object} region  - Datos de la región
 * @param {number} pct65   - % mayores de 65 en el año actual
 * @returns {string}       - HTML del tooltip
 */
function construirTooltip(region, pct65) {
    const sim     = estado.simRegiones[region.id];
    const idx     = Math.min(estado.año - JAPAN_GLOBAL.añoInicio, (sim?.length ?? 1) - 1);
    const snap    = sim?.[idx];
    const pop     = snap ? (snap.poblacion / 1_000_000).toFixed(2) + ' M' : '—';
    const aging   = snap ? (snap.pct65 * 100).toFixed(1) + ' %' : (pct65 * 100).toFixed(1) + ' %';

    return `
        <div class="tooltip-name">${region.emoji} ${region.nombre}</div>
        <div class="tooltip-row"><span>Población</span><strong>${pop}</strong></div>
        <div class="tooltip-row"><span>+65 años</span><strong>${aging}</strong></div>
        <div class="tooltip-row"><span>Fertilidad local</span><strong>${region.fertilidadLocal.toFixed(2)}</strong></div>
        <div style="margin-top:5px;font-size:0.68rem;color:#6b7a96;line-height:1.4">${region.descripcion}</div>
    `;
}

/**
 * Actualiza los colores coropleta de todos los polígonos
 * según el porcentaje de mayores de 65 en el año seleccionado.
 */
function actualizarCoropleta() {
    const idx = estado.año - JAPAN_GLOBAL.añoInicio;

    Object.values(REGIONS).forEach(region => {
        const sim   = estado.simRegiones[region.id];
        const snap  = sim?.[Math.min(idx, sim.length - 1)];
        const pct65 = snap ? snap.pct65 : region.pctMayores65;
        const color = colorPorEnvejecimiento(pct65);

        const layer = regionLayers[region.id];
        if (!layer) return;

        layer.setStyle({
            color,
            fillColor:   color,
            fillOpacity: estado.regionActiva === region.id ? 0.60 : 0.35,
            weight:      estado.regionActiva === region.id ? 2.5  : 1.5,
        });

        // Actualizar tooltip con datos del año actual
        layer.setTooltipContent(construirTooltip(region, pct65));
    });
}

/**
 * Selecciona una región: la resalta en el mapa y actualiza el panel lateral.
 *
 * @param {string} regionId - ID de la región
 */
function seleccionarRegion(regionId) {
    // Deseleccionar anterior
    if (estado.regionActiva && regionLayers[estado.regionActiva]) {
        const prev = REGIONS[estado.regionActiva];
        const sim  = estado.simRegiones[estado.regionActiva];
        const idx  = Math.min(estado.año - JAPAN_GLOBAL.añoInicio, sim.length - 1);
        const color = colorPorEnvejecimiento(sim[idx].pct65);
        regionLayers[estado.regionActiva].setStyle({
            fillOpacity: 0.35,
            weight:      1.5,
            color,
            fillColor: color,
        });
    }

    estado.regionActiva = regionId;

    const region = REGIONS[regionId];
    const sim    = estado.simRegiones[regionId];
    const idx    = Math.min(estado.año - JAPAN_GLOBAL.añoInicio, sim.length - 1);
    const snap   = sim[idx];
    const color  = colorPorEnvejecimiento(snap.pct65);

    // Resaltar capa
    regionLayers[regionId].setStyle({
        fillOpacity: 0.60,
        weight:      2.5,
    });

    // Actualizar panel región
    const dot  = document.getElementById('region-dot');
    const name = document.getElementById('region-info-name');
    const row  = document.getElementById('region-stats-row');

    if (dot)  dot.style.background  = color;
    if (name) name.textContent = `${region.emoji} ${region.nombre}`;
    if (row)  row.style.display = 'grid';

    document.getElementById('rstat-pop').textContent =
        (snap.poblacion / 1_000_000).toFixed(2) + ' M';
    document.getElementById('rstat-aging').textContent =
        (snap.pct65 * 100).toFixed(1) + ' %';
    document.getElementById('rstat-fert').textContent =
        (region.fertilidadLocal * (estado.fertilidad / JAPAN_GLOBAL.tasaFertilidad)).toFixed(2);
}

/* =============================================================
   4. CONTROLES — Sliders y radio buttons
============================================================= */

/**
 * Callback principal: se llama cuando el usuario mueve
 * cualquier slider o cambia la opción de inmigración.
 * Recalcula simulación y actualiza toda la UI.
 */
function onSliderChange() {
    // Leer valores de controles
    estado.año        = parseInt(document.getElementById('slider-year').value, 10);
    estado.fertilidad = parseFloat(document.getElementById('slider-fertility').value);
    estado.inmigracion = document.querySelector('input[name="immigration"]:checked').value;

    // Sincronizar displays de texto
    document.getElementById('display-year').textContent     = estado.año;
    document.getElementById('nav-year-display').textContent  = estado.año;
    document.getElementById('display-fertility').textContent = estado.fertilidad.toFixed(2);

    // Actualizar fill del slider CSS
    actualizarFillSliders();

    // Sincronizar pills de inmigración
    document.querySelectorAll('.radio-pill').forEach(pill => pill.classList.remove('active'));
    const activePill = document.getElementById(`pill-${estado.inmigracion}`);
    if (activePill) activePill.classList.add('active');

    // Recalcular simulación global
    recalcularSimulacion();
}

/**
 * Actualiza el fill visual (degradado) de los sliders range.
 */
function actualizarFillSliders() {
    const sYear = document.getElementById('slider-year');
    const sFert = document.getElementById('slider-fertility');

    const pctYear = ((estado.año - 2026) / (2080 - 2026)) * 100;
    sYear.style.setProperty('--pct', `${pctYear}%`);

    const pctFert = ((estado.fertilidad - 0.8) / (2.5 - 0.8)) * 100;
    sFert.style.setProperty('--pct', `${pctFert}%`);
}

/**
 * Ejecuta toda la cadena de recálculo:
 * simulación → coropleta → KPIs → gráfico → región activa.
 */
function recalcularSimulacion() {
    // 1. Calcular proyección global
    const inmiAnual = IMMIGRATION_RATES[estado.inmigracion];
    estado.simulacion = proyectar(
        JAPAN_GLOBAL.poblacionInicial,
        estado.fertilidad,
        inmiAnual,
        JAPAN_GLOBAL.porcentajeMayores65,
    );

    // 2. Calcular proyecciones por región
    calcularTodasRegiones();

    // 3. Obtener snapshot del año seleccionado
    const idx  = estado.año - JAPAN_GLOBAL.añoInicio;
    const snap = estado.simulacion[Math.min(idx, estado.simulacion.length - 1)];

    // 4. Actualizar KPIs
    actualizarKPIs(snap);

    // 5. Actualizar coropleta del mapa
    actualizarCoropleta();

    // 6. Si hay región activa, actualizar su panel
    if (estado.regionActiva) {
        seleccionarRegion(estado.regionActiva);
    }

    // 7. Actualizar gráfico
    actualizarGrafico();
}

/* =============================================================
   5. KPIs — Métricas Globales
============================================================= */

/**
 * Actualiza los 4 KPIs del panel lateral con datos del snapshot.
 *
 * @param {Object} snap - Snapshot del año seleccionado
 */
function actualizarKPIs(snap) {
    if (!snap) return;

    // Población total
    const pobM = snap.poblacion / 1_000_000;
    document.getElementById('kpi-population').textContent =
        pobM >= 100 ? pobM.toFixed(1) + ' M' : pobM.toFixed(2) + ' M';

    // Edad mediana
    document.getElementById('kpi-median-age').textContent =
        snap.edadMedia.toFixed(1) + ' años';

    // % Jubilados
    document.getElementById('kpi-elderly').textContent =
        (snap.pct65 * 100).toFixed(1) + ' %';

    // Tasa de crecimiento anual
    const crec = snap.crecimiento;
    const kpiCrEl = document.getElementById('kpi-growth');
    kpiCrEl.textContent = (crec >= 0 ? '+' : '') + crec.toFixed(2) + ' %';
    kpiCrEl.style.color = crec >= 0
        ? 'var(--accent-green)'
        : 'var(--accent-red)';
}

/* =============================================================
   6. GRÁFICO — Chart.js Proyección 2026–2080
============================================================= */

let chartInstance = null;

/**
 * Construye o actualiza el gráfico de líneas con la proyección
 * poblacional global de Japón para 2026–2080.
 * Incluye tres datasets: escenarios Baja/Media/Alta inmigración.
 */
function actualizarGrafico() {
    const ctx = document.getElementById('projectionChart')?.getContext('2d');
    if (!ctx) return;

    // Generar los tres escenarios de proyección
    const escenarios = [
        { label: 'Inmig. Baja',   inmi: 'low',    color: '#ff3b30', colorAlpha: 'rgba(255,59,48,0.12)' },
        { label: 'Inmig. Media',  inmi: 'medium',  color: '#f5a623', colorAlpha: 'rgba(245,166,35,0.12)' },
        { label: 'Inmig. Alta',   inmi: 'high',    color: '#30d158', colorAlpha: 'rgba(48,209,88,0.12)' },
    ];

    const labels = Array.from({ length: 55 }, (_, i) => 2026 + i);

    const datasets = escenarios.map(esc => {
        const sim = proyectar(
            JAPAN_GLOBAL.poblacionInicial,
            estado.fertilidad,
            IMMIGRATION_RATES[esc.inmi],
            JAPAN_GLOBAL.porcentajeMayores65,
        );
        return {
            label:           esc.label,
            data:            sim.map(s => (s.poblacion / 1_000_000).toFixed(2)),
            borderColor:     esc.color,
            backgroundColor: esc.colorAlpha,
            borderWidth:     esc.inmi === estado.inmigracion ? 2.5 : 1.2,
            pointRadius:     0,
            tension:         0.35,
            fill:            esc.inmi === estado.inmigracion,
        };
    });

    // Línea vertical del año seleccionado
    const añoPlugin = {
        id: 'añoLinePlugin',
        afterDraw(chart) {
            const idx = estado.año - 2026;
            const meta = chart.getDatasetMeta(0);
            if (!meta.data[idx]) return;
            const x = meta.data[idx].x;
            const { ctx: c, chartArea: { top, bottom } } = chart;
            c.save();
            c.beginPath();
            c.setLineDash([4, 3]);
            c.strokeStyle = 'rgba(255,255,255,0.25)';
            c.lineWidth = 1.5;
            c.moveTo(x, top);
            c.lineTo(x, bottom);
            c.stroke();
            c.restore();
        }
    };

    if (chartInstance) {
        // Actualizar datos en lugar de re-crear
        chartInstance.data.datasets.forEach((ds, i) => {
            ds.data = datasets[i].data;
            ds.borderWidth = datasets[i].borderWidth;
            ds.fill = datasets[i].fill;
        });
        chartInstance.update('none');
        return;
    }

    // Primera creación
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            interaction: {
                mode:      'index',
                intersect: false,
            },
            scales: {
                x: {
                    ticks: {
                        color:     '#6b7a96',
                        font:      { size: 10 },
                        maxRotation: 0,
                        autoSkip:  true,
                        maxTicksLimit: 10,
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
                y: {
                    ticks: {
                        color: '#6b7a96',
                        font:  { size: 10 },
                        callback: v => v + ' M',
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    title: {
                        display: true,
                        text:    'Millones de hab.',
                        color:   '#4a5568',
                        font:    { size: 10 },
                    },
                },
            },
            plugins: {
                legend: {
                    display: false, // Usamos pills propias
                },
                tooltip: {
                    backgroundColor: 'rgba(13,18,32,0.95)',
                    borderColor:     'rgba(255,255,255,0.08)',
                    borderWidth:     1,
                    titleColor:      '#f0f4ff',
                    bodyColor:       '#8a94a8',
                    padding:         10,
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} M`,
                    },
                },
            },
        },
        plugins: [añoPlugin],
    });

    // Generar pills de leyenda
    const pillsEl = document.getElementById('chart-legend-pills');
    if (pillsEl) {
        pillsEl.innerHTML = escenarios.map((esc, i) => `
            <div class="chart-pill">
                <span class="chart-pill-dot" style="background:${esc.color}"></span>
                ${esc.label}
            </div>
        `).join('');
    }
}

/* =============================================================
   4b. REPRODUCCIÓN AUTOMÁTICA (Play / Pausa)
============================================================= */

let playInterval = null;
let isPlaying    = false;

/**
 * Alterna entre reproducción y pausa.
 * La simulación avanza 1 año cada ~120 ms.
 */
function togglePlay() {
    if (isPlaying) {
        pausar();
    } else {
        reproducir();
    }
}

function reproducir() {
    isPlaying = true;
    const btn   = document.getElementById('btn-play');
    const icon  = document.getElementById('play-icon');
    const label = document.getElementById('play-label');
    if (btn)   btn.classList.add('playing');
    if (icon)  icon.className = 'fa-solid fa-pause';
    if (label) label.textContent = 'Pausar';

    // Si está al final, reiniciar
    if (estado.año >= 2080) {
        document.getElementById('slider-year').value = '2026';
        estado.año = 2026;
    }

    playInterval = setInterval(() => {
        const slider = document.getElementById('slider-year');
        if (!slider) { pausar(); return; }
        let nuevoAño = parseInt(slider.value, 10) + 1;
        if (nuevoAño > 2080) {
            nuevoAño = 2080;
            pausar();
        }
        slider.value = nuevoAño;
        onSliderChange();
    }, 100);
}

function pausar() {
    isPlaying = false;
    clearInterval(playInterval);
    const btn   = document.getElementById('btn-play');
    const icon  = document.getElementById('play-icon');
    const label = document.getElementById('play-label');
    if (btn)   btn.classList.remove('playing');
    if (icon)  icon.className = 'fa-solid fa-play';
    if (label) label.textContent = 'Reproducir';
}

/**
 * Reinicia la simulación al año 2026 con parámetros por defecto.
 */
function resetSimulation() {
    pausar();
    document.getElementById('slider-year').value      = '2026';
    document.getElementById('slider-fertility').value = '1.20';

    // Resetear radio a "Baja"
    document.getElementById('pill-low')
        .querySelector('input').checked = true;
    document.getElementById('pill-low').classList.add('active');
    document.getElementById('pill-med').classList.remove('active');
    document.getElementById('pill-high').classList.remove('active');

    onSliderChange();
}

/* =============================================================
   7. INICIALIZACIÓN
============================================================= */

window.addEventListener('DOMContentLoaded', () => {
    // Inicializar el mapa Leaflet
    initMapa();

    // Calcular primera proyección con valores por defecto
    onSliderChange();

    // Configurar listeners de radio pills (clic en el div padre)
    document.querySelectorAll('.radio-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.radio-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });
});
