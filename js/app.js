(() => {
  const DATA = window.PREISSCAN_DATA;
  const SETTINGS_KEY = "preisscan.settings.v3";
  const TRACKED_KEY = "preisscan.trackedIds.v3";
  const LOCATION_KEY = "preisscan.location.v1";
  const RETAILER_PREFS_KEY = "preisscan.retailerPrefs.v1";
  const LEGACY_EXTRA_KEY = "preisscan.trackedExtra.v1";
  const API = window.PREISSCAN_API;

  function loadJSON(key, fallback){
    try{
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    }catch{
      return fallback;
    }
  }

  function saveJSON(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function initialTrackedIds(){
    const saved = loadJSON(TRACKED_KEY, null);
    if(Array.isArray(saved)) return saved;
    const legacyExtra = loadJSON(LEGACY_EXTRA_KEY, []);
    return [...new Set([...DATA.products.map(p=>p.id), ...legacyExtra])];
  }

  const state = {
    settings: loadJSON(SETTINGS_KEY, {}),
    trackedIds: initialTrackedIds(),
    location: localStorage.getItem(LOCATION_KEY) || "",
    locationEditing: !(localStorage.getItem(LOCATION_KEY) || ""),
    retailerPrefs: loadJSON(RETAILER_PREFS_KEY, {}),
    currentView: "overview",
    familyQuery: "",
    backend: {
      connected:false,
      syncing:false,
      health:null,
      meta:null,
      retailers:[],
      retailerPreferences:[],
      products:[],
      details:new Map(),
      productIdByLocal:new Map(),
      localIdByBackend:new Map(),
      marketStatesByLocal:new Map(),
      futureOffers:[],
      user:null
    },
    scanner:{
      running:false,
      mode:null,
      stream:null,
      detector:null,
      timer:null,
      html5:null,
      busy:false,
      status:"Bereit zum Scannen.",
      candidate:null,
      lastCode:null,
      prices:null,
      priceLoading:false,
      priceError:null
    }
  };
  saveJSON(TRACKED_KEY, state.trackedIds);

  const els = {
    overview: document.getElementById("overviewView"),
    comparison: document.getElementById("comparisonView"),
    scanner: document.getElementById("scannerView"),
    searchView: document.getElementById("searchView"),
    alerts: document.getElementById("alertsView"),
    search: document.getElementById("searchInput"),
    filter: document.getElementById("productFilter"),
    scan: document.getElementById("scanBtn"),
    refresh: document.getElementById("refreshBtn"),
    install: document.getElementById("installBtn"),
    toast: document.getElementById("toast"),
    locationBar: document.getElementById("locationBar"),
    locationSummary: document.getElementById("locationSummary"),
    settingsView: document.getElementById("settingsView"),
    backendBadge: document.getElementById("backendBadge"),
    backendFooter: document.getElementById("backendFooter")
  };

  const IMAGE_KEY_TO_LOCAL = {
    "coca-cola-zero-125":"coke125",
    "coca-cola-zero-150":"coke150",
    "monster-rossi-500":"monster-rossi"
  };

  function familyNameFor(product){
    if(product.family === "hackfleisch-gemischt") return "Gemischtes Hackfleisch";
    if(product.family === "coca-cola-zero") return "Coca-Cola Zero";
    if(product.family === "monster-rossi") return "Monster Energy Rossi Edition";
    return product.name;
  }

  function comparisonModeFor(product){
    if(product.family === "hackfleisch-gemischt") return "family";
    if(product.family === "monster-rossi") return "exact";
    return "exact_or_family";
  }

  function localIdForBackendProduct(item){
    if(item.image_key && IMAGE_KEY_TO_LOCAL[item.image_key]) return IMAGE_KEY_TO_LOCAL[item.image_key];
    const amount = Number(item.amount_value);
    const byCatalog = [...DATA.products, ...DATA.catalog].find(p =>
      normalize(p.name) === normalize(item.name) &&
      Number(p.amount) === amount &&
      normalize(p.unit) === normalize(item.amount_unit)
    );
    return byCatalog?.id || `backend-${item.id}`;
  }

  function backendProductToLocal(item){
    const localId = localIdForBackendProduct(item);
    const existing = DATA.products.find(p=>p.id===localId) || DATA.catalog.find(p=>p.id===localId);
    if(existing){
      return {
        ...existing,
        backendId:item.id,
        ean:item.gtin || existing.ean || null,
        defaultAlarm:item.target_price_cents == null ? existing.defaultAlarm ?? null : item.target_price_cents / 100
      };
    }
    const amount = Number(item.amount_value || 0);
    const unit = item.amount_unit || "";
    const size = item.variant || (amount ? `${String(amount).replace(".",",")} ${unit}` : "");
    return {
      id:localId,
      backendId:item.id,
      family:item.family_slug || `backend-family-${item.family_id || "x"}`,
      name:item.name,
      size,
      packageType:item.package_type || "",
      unitType:unit === "g" || unit === "kg" ? "weight" : "volume",
      amount,
      unit,
      ean:item.gtin || null,
      image:item.image_key && /^https?:\/\//i.test(item.image_key) ? item.image_key : null,
      imageLabel:`${item.name} ${size}`,
      defaultAlarm:item.target_price_cents == null ? null : item.target_price_cents / 100,
      marketStates:{}
    };
  }

  function backendIdForLocal(localId){
    return state.backend.productIdByLocal.get(localId) || null;
  }

  function updateBackendStatus(){
    const connected = state.backend.connected;
    const pending = state.backend.syncing;
    if(els.backendBadge){
      els.backendBadge.className = `backend-badge ${connected ? "online" : pending ? "pending" : "offline"}`;
      els.backendBadge.textContent = connected ? "Server verfügbar" : pending ? "Server wird geprüft" : "Server offline";
    }
    if(els.backendFooter){
      els.backendFooter.textContent = connected ? "Serververbindung verfügbar" : pending ? "Serververbindung wird geprüft …" : "Serververbindung gestört";
    }
  }

  function retailerSlugToMarketId(slug, row={}){
    if(slug === "aldi-sued") return "aldi";
    if(slug === "scheck-in") return "scheck-bruehl";
    if(slug === "marktkauf"){
      const text = normalize(`${row.store_name || ""} ${row.city || ""}`);
      if(text.includes("wohlgelegen")) return "mk-wohl";
      if(text.includes("neckarau")) return "mk-neck";
      return "marktkauf";
    }
    return DATA.markets.some(m=>m.id===slug) ? slug : null;
  }

  function marketRetailerSlug(market){
    if(!market) return null;
    if(market.id === "aldi") return "aldi-sued";
    if(market.id === "scheck-bruehl") return "scheck-in";
    if(["marktkauf","mk-wohl","mk-neck"].includes(market.id)) return "marktkauf";
    return market.id;
  }

  function retailerEnabledBySlug(slug){
    if(!slug) return true;
    const pref = state.retailerPrefs?.[slug];
    return pref?.enabled !== false;
  }

  function isMarketEnabled(market){
    return retailerEnabledBySlug(marketRetailerSlug(market));
  }

  function enabledMarkets(){
    return DATA.markets.filter(isMarketEnabled);
  }

  function saveRetailerPrefs(){
    saveJSON(RETAILER_PREFS_KEY, state.retailerPrefs);
  }

  function applyRetailerPreferenceRows(rows){
    if(!Array.isArray(rows)) return;
    const next = {...state.retailerPrefs};
    for(const row of rows){
      next[row.slug] = {
        id:Number(row.id),
        name:row.name,
        enabled:Number(row.enabled) !== 0
      };
    }
    state.retailerPrefs = next;
    state.backend.retailerPreferences = rows;
    saveRetailerPrefs();
  }

  function formatBackendDate(value){
    if(!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if(Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("de-DE").format(date);
  }

  function mergeBackendPrices(localProduct, rows){
    if(!Array.isArray(rows) || !rows.length) return;
    const byMarket = new Map();
    const future = [];
    const today = new Date(); today.setHours(0,0,0,0);
    rows.forEach(row=>{
      const marketId = retailerSlugToMarketId(row.retailer_slug,row);
      if(!marketId || row.price_eur == null) return;
      const from = row.valid_from ? new Date(`${row.valid_from}T00:00:00`) : null;
      const isFuture = from && from.getTime() > today.getTime();
      if(isFuture){
        future.push({
          productId:localProduct.id,
          marketId,
          price:Number(row.price_eur),
          validFrom:`ab ${formatBackendDate(row.valid_from)}`,
          validUntil:formatBackendDate(row.valid_to),
          type:row.price_type || "offer",
          source:row.source_name || "Preisscan Backend",
          note:row.condition_label || ""
        });
        return;
      }
      if(!byMarket.has(marketId)) byMarket.set(marketId,[]);
      byMarket.get(marketId).push(row);
    });
    for(const [marketId,items] of byMarket){
      const localId = localProduct.id;
      const currentStates = state.backend.marketStatesByLocal.get(localId) || {};
      currentStates[marketId] = {
        status:"price",
        checked:items.map(x=>x.observed_at).filter(Boolean).sort().at(-1) || null,
        source:items.find(x=>x.source_name)?.source_name || "Preisscan Backend",
        validFrom:items.find(x=>x.valid_from)?.valid_from || null,
        validUntil:items.find(x=>x.valid_to)?.valid_to || null,
        prices:items.map(x=>({
          type:x.price_type || "regular",
          value:Number(x.price_eur),
          label:x.price_type === "app" ? "App-Preis" : x.price_type === "coupon" ? "Coupon" : x.price_type === "offer" ? "Angebot" : "Regulär",
          requirement:x.condition_label || null
        }))
      };
      state.backend.marketStatesByLocal.set(localId,currentStates);
    }
    state.backend.futureOffers.push(...future);
  }

  async function syncBackend(showMessage=false){
    if(!API) return;

    state.backend.syncing = true;
    updateBackendStatus();

    try{
      const sessionInfo = await API.ensureSession();
      state.backend.user = sessionInfo?.user || null;

      const [
        health,
        meta,
        productsResult,
        retailerResult,
        trackedResult,
        retailerPreferenceResult
      ] = await Promise.all([
        API.health(),
        API.meta(),
        API.products(),
        API.retailers(),
        API.tracked(),
        API.retailerPreferences()
      ]);

      state.backend.health = health;
      state.backend.meta = meta;
      state.backend.retailers = retailerResult.retailers || [];
      applyRetailerPreferenceRows(retailerPreferenceResult.retailers || []);

      const trackedRows = trackedResult.products || [];
      const trackedById = new Map(
        trackedRows.map(item=>[
          Number(item.id),
          item
        ])
      );

      state.backend.products = (productsResult.products || []).map(item=>{
        const tracked = trackedById.get(Number(item.id));
        return {
          ...item,
          tracked: tracked ? 1 : 0,
          target_price_cents: tracked?.target_price_cents ?? null
        };
      });

      state.backend.details = new Map();
      state.backend.productIdByLocal = new Map();
      state.backend.localIdByBackend = new Map();
      state.backend.marketStatesByLocal = new Map();
      state.backend.futureOffers = [];

      for(const item of state.backend.products){
        const localId = localIdForBackendProduct(item);
        state.backend.productIdByLocal.set(localId,item.id);
        state.backend.localIdByBackend.set(item.id,localId);
      }

      const trackedLocalIds = trackedRows.map(item=>{
        const merged = {
          ...item,
          tracked:1
        };
        return localIdForBackendProduct(merged);
      });

      const backendKnownLocalIds = new Set(
        state.backend.products.map(item=>localIdForBackendProduct(item))
      );

      const localOnlyTracked = state.trackedIds.filter(
        id=>!backendKnownLocalIds.has(id)
      );

      state.trackedIds = [
        ...new Set([
          ...trackedLocalIds,
          ...localOnlyTracked
        ])
      ];

      saveTracked();

      const trackedBackendProducts = trackedRows
        .map(row=>state.backend.products.find(item=>Number(item.id)===Number(row.id)))
        .filter(Boolean);

      const details = await Promise.all(
        trackedBackendProducts.map(
          item=>API.product(item.id).catch(()=>null)
        )
      );

      details.filter(Boolean).forEach(detail=>{
        const localId =
          state.backend.localIdByBackend.get(detail.product.id);

        if(!localId) return;

        state.backend.details.set(
          detail.product.id,
          detail
        );

        const product =
          productById(localId);

        if(product){
          mergeBackendPrices(
            product,
            detail.prices || []
          );
        }
      });

      state.backend.connected =
        health?.ok === true &&
        health?.database === "connected";

      if(showMessage){
        showToast(
          `Backend verbunden · ${trackedRows.length} beobachtete Produkte.`
        );
      }

    }catch(error){
      state.backend.connected = false;

      if(showMessage){
        showToast(
          `Backend nicht erreichbar: ${error.message}`
        );
      }

    }finally{
      state.backend.syncing = false;
      updateBackendStatus();
      rebuildFilter();
      renderAll();
    }
  }

  function ensurePayload(product, track=true){
    const alarm = getAlarm(product);
    return {
      gtin:product.ean || null,
      family_slug:product.family || null,
      family_name:familyNameFor(product),
      comparison_mode:comparisonModeFor(product),
      brand:product.name.includes("Coca-Cola") ? "Coca-Cola" : product.name.includes("Monster") ? "Monster Energy" : null,
      name:product.name,
      variant:product.size,
      amount_value:product.amount ?? null,
      amount_unit:product.unit || null,
      package_type:product.packageType || null,
      image_key:product.id === "coke125" ? "coca-cola-zero-125" : product.id === "coke150" ? "coca-cola-zero-150" : product.id === "monster-rossi" ? "monster-rossi-500" : product.id,
      track,
      target_price_cents:alarm == null || alarm === "" ? null : Math.round(Number(alarm)*100)
    };
  }

  function saveSettings(){ saveJSON(SETTINGS_KEY, state.settings); }
  function saveTracked(){ saveJSON(TRACKED_KEY, state.trackedIds); }

  function normalize(value){
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-–—_/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function catalogToProduct(item){
    return {
      ...item,
      defaultAlarm:null,
      marketStates:{},
      imageLabel:`${item.name} ${item.size}`
    };
  }

  function productById(id){
    const base = DATA.products.find(p=>p.id===id) || (()=>{
      const item = DATA.catalog.find(x=>x.id===id);
      return item ? catalogToProduct(item) : null;
    })();
    const backendItem = state.backend.products.find(x=>localIdForBackendProduct(x)===id);
    const backendStates = state.backend.marketStatesByLocal.get(id) || {};
    if(base && backendItem) return {...base, ...backendProductToLocal(backendItem), marketStates:{...(base.marketStates || {}), ...backendStates}};
    if(base) return {...base, marketStates:{...(base.marketStates || {}), ...backendStates}};
    if(backendItem) return {...backendProductToLocal(backendItem), marketStates:backendStates};
    return null;
  }

  function trackedProducts(){
    return state.trackedIds.map(productById).filter(Boolean);
  }

  function isTracked(id){ return state.trackedIds.includes(id); }

  async function addTracked(id){
    if(isTracked(id)) return;
    const product = productById(id);
    if(!product) return;
    if(state.backend.connected){
      try{
        let backendId = backendIdForLocal(id);
        if(backendId){
          const alarm = getAlarm(product);
          await API.trackProduct(backendId, alarm == null || alarm === "" ? null : Math.round(Number(alarm)*100));
        }else{
          const result = await API.ensureProduct(ensurePayload(product,true));
          backendId = result.product?.id;
          if(backendId){
            state.backend.productIdByLocal.set(id,backendId);
            state.backend.localIdByBackend.set(backendId,id);
          }
        }
      }catch(error){
        showToast(`Produkt konnte nicht gespeichert werden: ${error.message}`);
        return;
      }
    }
    state.trackedIds.push(id);
    saveTracked();
    await syncBackend(false);
    rebuildFilter();
    renderAll();
    showToast("Produkt wird jetzt beobachtet.");
  }

  async function removeTracked(id){
    if(!isTracked(id)) return;
    if(state.backend.connected){
      const backendId = backendIdForLocal(id);
      if(backendId){
        try{ await API.untrackProduct(backendId); }
        catch(error){ showToast(`Produkt konnte nicht entfernt werden: ${error.message}`); return; }
      }
    }
    state.trackedIds = state.trackedIds.filter(x=>x!==id);
    saveTracked();
    await syncBackend(false);
    rebuildFilter();
    renderAll();
    showToast("Produkt aus der Beobachtung entfernt.");
  }

  function getAlarm(product){
    if(Object.prototype.hasOwnProperty.call(state.settings, product.id)) return state.settings[product.id];
    return product.defaultAlarm;
  }

  function setAlarm(productId, value){
    state.settings[productId] = value;
    saveSettings();
  }

  function marketById(id){ return DATA.markets.find(m=>m.id===id); }

  function statusFor(product, marketId){
    return product.marketStates?.[marketId] || {status:"unchecked", checked:null};
  }

  function priceOptions(entry){
    if(!entry || entry.status !== "price") return [];
    if(Array.isArray(entry.prices)) return entry.prices.filter(p=>typeof p.value === "number");
    if(typeof entry.value === "number") return [{type:"regular",value:entry.value,label:"Preis"}];
    return [];
  }

  function allReportedPrices(product){
    return enabledMarkets().flatMap(market=>{
      const entry = statusFor(product, market.id);
      return priceOptions(entry).map(option=>({market,entry,option}));
    });
  }

  function optionRequirementRank(option){
    return option.requirement || option.type === "app" || option.type === "coupon" ? 1 : 0;
  }

  function bestPrice(product){
    return [...allReportedPrices(product)].sort((a,b)=>
      a.option.value - b.option.value || optionRequirementRank(a.option) - optionRequirementRank(b.option)
    )[0] || null;
  }

  function worstPrice(product){
    return [...allReportedPrices(product)].sort((a,b)=>b.option.value-a.option.value)[0] || null;
  }

  function priceStores(product){
    return enabledMarkets().filter(m=>priceOptions(statusFor(product,m.id)).length>0);
  }

  function eur(value){
    return Number(value).toLocaleString("de-DE", {style:"currency",currency:"EUR"});
  }

  function unitPrice(product, price){
    if(!product.amount || typeof price !== "number") return null;
    if(product.unitType === "weight") return price / (product.amount / 1000);
    return price / product.amount;
  }

  function unitPriceLabel(product){ return product.unitType === "weight" ? "€/kg" : "€/l"; }

  function productImage(product, className="product-photo"){
    const alt = escapeHtml(product.imageLabel || `${product.name} ${product.size}`);
    const fallback = escapeHtml((product.name || "Produkt").split(" ").slice(0,2).join(" "));
    if(!product.image){
      return `<div class="${className} image-fallback"><span>${fallback}</span><small>${escapeHtml(product.size)}</small></div>`;
    }
    return `<div class="${className}">
      <img src="${escapeAttr(product.image)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
      <div class="image-fallback" hidden><span>${fallback}</span><small>${escapeHtml(product.size)}</small></div>
    </div>`;
  }

  function marketLogo(market){
    const brand = escapeAttr(market.brand || "generic");
    const text = market.brand === "scheckin" ? "Scheck-in" : market.name;
    return `<div class="market-logo brand-${brand}" aria-label="${escapeAttr(market.name)} Logo"><span>${escapeHtml(text)}</span></div>`;
  }

  function futureOffers(product){ return [...DATA.futureOffers, ...state.backend.futureOffers].filter(x=>x.productId===product.id && isMarketEnabled(marketById(x.marketId))); }

  function filteredProducts(){
    const q = normalize(els.search.value);
    const f = els.filter.value;
    return trackedProducts().filter(p=>{
      if(f !== "all" && p.id !== f) return false;
      if(!q) return true;
      const marketText = enabledMarkets().flatMap(m=>[m.name,m.branch,m.area]).filter(Boolean).join(" ");
      return normalize(`${p.name} ${p.size} ${p.packageType || ""} ${marketText}`).includes(q);
    });
  }

  function alarmState(product){
    const alarm = getAlarm(product);
    if(alarm == null || alarm === "") return {type:"off", text:"Preiswecker aus"};
    const best = bestPrice(product);
    if(best && best.option.value <= Number(alarm)){
      const extra = best.option.requirement ? ` · ${best.option.label || "App-Preis"}` : "";
      return {type:"hit", text:`Zielpreis aktuell erreicht${extra}`};
    }
    const upcoming = futureOffers(product).filter(x=>x.price <= Number(alarm)).sort((a,b)=>a.price-b.price)[0];
    if(upcoming) return {type:"future", text:"Zielpreis demnächst erreicht"};
    return {type:"wait", text:"Zielpreis noch nicht erreicht"};
  }

  function stateCounts(product){
    const rows = enabledMarkets().map(m=>statusFor(product,m.id));
    return {
      price: rows.filter(e=>priceOptions(e).length>0).length,
      na: rows.filter(e=>e.status==="na").length,
      unknown: rows.filter(e=>e.status==="unknown").length,
      unchecked: rows.filter(e=>e.status==="unchecked").length
    };
  }

  function latestCheck(product){
    const checks = enabledMarkets()
      .map(m=>statusFor(product,m.id).checked)
      .filter(Boolean)
      .map(v=>new Date(v))
      .filter(d=>!Number.isNaN(d.getTime()));
    if(!checks.length) return null;
    return new Date(Math.max(...checks.map(d=>d.getTime())));
  }

  function formatCheck(value){
    if(!value) return "Noch nicht geprüft";
    const d = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(d.getTime())) return "Noch nicht geprüft";
    return new Intl.DateTimeFormat("de-DE", {dateStyle:"short",timeStyle:"short"}).format(d);
  }

  function formatValidity(entry){
    if(!entry.validFrom && !entry.validUntil) return "";
    const from = entry.validFrom ? new Date(`${entry.validFrom}T12:00:00`) : null;
    const until = entry.validUntil ? new Date(`${entry.validUntil}T12:00:00`) : null;
    const fmt = d => new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
    if(from && until) return `${fmt(from)}–${fmt(until)}`;
    return from ? `ab ${fmt(from)}` : `bis ${fmt(until)}`;
  }

  function priceTypeText(option){
    if(option.label) return option.label;
    if(option.type === "app") return "App-Preis";
    if(option.type === "coupon") return "Coupon";
    if(option.type === "offer") return "Angebot";
    return "Regulär";
  }

  function priceTypeClass(option){
    if(option.type === "app" || option.type === "coupon") return "app-price";
    if(option.type === "offer") return "offer-price";
    return "regular-price";
  }

  function renderPriceStack(product, entry, bestValue, worstValue){
    const options = priceOptions(entry);
    if(!options.length) return `<span class="price">—</span>`;
    return `<div class="price-stack">${options
      .slice()
      .sort((a,b)=>a.value-b.value)
      .map(option=>{
        let valueClass = "price";
        if(option.value === bestValue) valueClass += " best";
        if(option.value === worstValue) valueClass += " worst";
        return `<div class="price-option">
          <span class="${valueClass}">${eur(option.value)}</span>
          <span class="price-type ${priceTypeClass(option)}">${escapeHtml(priceTypeText(option))}</span>
          ${option.requirement ? `<small>${escapeHtml(option.requirement)} erforderlich</small>` : ``}
        </div>`;
      }).join("")}</div>`;
  }

  function renderUnitStack(product, entry){
    const options = priceOptions(entry);
    if(!options.length) return "—";
    return `<div class="unit-stack">${options.slice().sort((a,b)=>a.value-b.value).map(option=>`<div>${eur(unitPrice(product,option.value))}<small>${escapeHtml(priceTypeText(option))}</small></div>`).join("")}</div>`;
  }

  function renderLocation(){
    const hasLocation = Boolean(state.location);
    if(els.locationSummary){
      els.locationSummary.textContent = hasLocation ? `Standort: ${state.location}` : "Standort noch nicht festgelegt";
    }
    if(!els.locationBar) return;

    if(state.locationEditing){
      els.locationBar.innerHTML = `
        <section class="location-card editing">
          <div class="location-copy">
            <span class="section-kicker">Referenzstandort</span>
            <strong>${hasLocation ? "Standort ändern" : "Standort festlegen"}</strong>
            <p>Der Standort wird nur lokal in dieser PWA gespeichert. Günstigere Märkte außerhalb der unmittelbaren Nähe bleiben trotzdem im Preisvergleich sichtbar.</p>
          </div>
          <div class="location-form">
            <input id="locationInput" type="text" value="${escapeAttr(state.location)}" placeholder="PLZ oder Ort, z. B. 68219 Mannheim">
            <button id="saveLocationBtn" class="primary-btn">Speichern</button>
            ${hasLocation ? `<button id="cancelLocationBtn" class="ghost-btn">Abbrechen</button>` : ``}
          </div>
        </section>`;
      document.getElementById("saveLocationBtn")?.addEventListener("click",saveLocationFromInput);
      document.getElementById("locationInput")?.addEventListener("keydown",e=>{ if(e.key === "Enter") saveLocationFromInput(); });
      document.getElementById("cancelLocationBtn")?.addEventListener("click",()=>{ state.locationEditing=false; renderLocation(); });
    }else{
      els.locationBar.innerHTML = `
        <section class="location-card saved">
          <div class="location-copy">
            <span class="section-kicker">Referenzstandort</span>
            <strong>${escapeHtml(state.location)}</strong>
            <p>Nur Referenz für regionale Preisquellen. Weiter entfernte Märkte werden nicht automatisch ausgeblendet.</p>
          </div>
          <button id="changeLocationBtn" class="ghost-btn">Standort ändern</button>
        </section>`;
      document.getElementById("changeLocationBtn")?.addEventListener("click",()=>{ state.locationEditing=true; renderLocation(); });
    }
  }

  function saveLocationFromInput(){
    const input = document.getElementById("locationInput");
    const value = (input?.value || "").trim();
    if(!value){ showToast("Bitte PLZ oder Ort eingeben."); return; }
    state.location = value;
    state.locationEditing = false;
    localStorage.setItem(LOCATION_KEY,value);
    renderLocation();
    showToast("Standort lokal gespeichert.");
  }

  function renderOverview(){
    const products = filteredProducts();
    els.overview.innerHTML = products.length ? `
      <div class="product-grid">
        ${products.map(product=>{
          const best = bestPrice(product);
          const worst = worstPrice(product);
          const counts = stateCounts(product);
          const alarm = alarmState(product);
          const latest = latestCheck(product);
          const upcoming = futureOffers(product);
          const bestReq = best?.option?.requirement;
          return `<article class="product-card">
            <div class="product-head">
              ${productImage(product)}
              <div class="product-copy">
                <h3 class="product-title">${escapeHtml(product.name)}</h3>
                <div class="product-sub">${escapeHtml(product.size)} · ${escapeHtml(product.packageType || "")}</div>
                <button class="text-action danger" data-untrack="${escapeAttr(product.id)}">Produkt löschen</button>
              </div>
              <div class="best-block">
                <span>günstigster Preis</span>
                <strong>${best ? eur(best.option.value) : "—"}</strong>
                <span>${best ? `${escapeHtml(best.market.name)}${bestReq ? ` · ${escapeHtml(priceTypeText(best.option))}` : ""}` : "noch keine Preisquelle"}</span>
                ${best ? `<small>${escapeHtml(best.market.branch || best.market.area || "")}</small>` : ``}
              </div>
            </div>
            <div class="card-body">
              <div class="metric-grid">
                <div class="metric"><b>Märkte mit Preis</b><strong>${counts.price} / ${enabledMarkets().length}</strong></div>
                <div class="metric"><b>Nicht im Sortiment</b><strong>${counts.na}</strong></div>
                <div class="metric"><b>Letzte Prüfung</b><strong>${latest ? formatCheck(latest) : "Noch nicht geprüft"}</strong></div>
              </div>
              <div class="alarm-line">
                <div class="alarm-controls"><strong>Preiswecker</strong><span>≤</span><input class="price-input" data-alarm="${escapeAttr(product.id)}" type="number" min="0" step="0.01" value="${getAlarm(product) ?? ""}" placeholder="z. B. 1,00"><span>€</span></div>
                <span class="state-pill ${alarm.type === "hit" ? "hit" : alarm.type === "future" ? "future" : ""}">${alarm.text}</span>
              </div>
              <div class="metric-grid spaced">
                <div class="metric"><b>Höchster gemeldeter Preis</b><strong>${worst ? eur(worst.option.value) : "—"}</strong><small>${worst ? `${escapeHtml(worst.market.name)} · ${escapeHtml(priceTypeText(worst.option))}` : "keine Daten"}</small></div>
                <div class="metric"><b>Unklar</b><strong>${counts.unknown}</strong><small>Preis nicht ermittelbar</small></div>
                <div class="metric"><b>Noch offen</b><strong>${counts.unchecked}</strong><small>noch nicht geprüft</small></div>
              </div>
              <div class="future-box">
                <h4>Kommende Angebote</h4>
                ${upcoming.length ? upcoming.map(x=>`<div class="future-offer-row"><div><strong>${escapeHtml(marketById(x.marketId)?.name || x.marketId)}</strong><small>${escapeHtml(x.validFrom)}${x.validUntil ? ` – ${escapeHtml(x.validUntil)}` : ""}${x.matchType === "family" ? " · Sortenangebot" : ""}</small>${x.note ? `<small>${escapeHtml(x.note)}</small>` : ""}</div><strong>${eur(x.price)}</strong></div>`).join("") : `<div class="future-empty">Aktuell kein verifiziertes Zukunftsangebot für diese konkrete Variante.</div>`}
              </div>
            </div>
          </article>`;
        }).join("")}
      </div>` : emptyState("Keine beobachteten Produkte passen zur Suche. Über die Produktsuche können Produkte wieder hinzugefügt werden.");

    bindAlarmInputs();
    bindUntrackButtons();
  }

  function renderComparison(){
    const products = filteredProducts();
    els.comparison.innerHTML = products.length ? products.map(product=>{
      const all = allReportedPrices(product);
      const best = bestPrice(product);
      const worst = worstPrice(product);
      const bestValue = best?.option?.value;
      const worstValue = worst?.option?.value;
      return `<section class="compare-card">
        <div class="compare-head compare-product-head">
          <div class="compare-product-ident">${productImage(product,"product-photo compact")}<div><strong>${escapeHtml(product.name)} ${escapeHtml(product.size)}</strong><small>${escapeHtml(product.packageType || "")} · alle getrackten Märkte</small></div></div>
          <div><small>Günstigster aktuell</small><br><strong class="best-text">${best ? eur(bestValue) : "—"}</strong>${best?.option?.requirement ? `<br><small>${escapeHtml(priceTypeText(best.option))}</small>` : ``}</div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Händler / Filiale</th><th>Preise</th><th>Status</th><th>${unitPriceLabel(product)}</th><th>Geprüft / Quelle</th><th>Gültigkeit</th><th>Kommend</th></tr></thead>
            <tbody>${enabledMarkets().map(market=>{
              const entry = statusFor(product,market.id);
              let statusLabel="Noch nicht geprüft", statusClass="unchecked";
              if(priceOptions(entry).length){ statusLabel = priceOptions(entry).length > 1 ? `${priceOptions(entry).length} Preisarten` : "Preis vorhanden"; statusClass="price"; }
              else if(entry.status === "na"){ statusLabel="Nicht im Sortiment"; statusClass="na"; }
              else if(entry.status === "unknown"){ statusLabel="Preis nicht ermittelbar"; statusClass="unknown"; }
              return `<tr>
                <td><div class="market-cell">${marketLogo(market)}<div class="market-copy"><strong>${escapeHtml(market.name)}</strong>${market.branch ? `<small>${escapeHtml(market.branch)}</small>` : `<small>${escapeHtml(market.area)}</small>`}</div></div></td>
                <td>${renderPriceStack(product,entry,bestValue,worstValue)}</td>
                <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
                <td>${renderUnitStack(product,entry)}</td>
                <td>${formatCheck(entry.checked)}${entry.source ? `<small class="source-note">${escapeHtml(entry.source)}</small>` : ``}</td>
                <td>${formatValidity(entry) || "—"}${entry.note ? `<small class="source-note">${escapeHtml(entry.note)}</small>` : ``}</td>
                <td>${(()=>{ const f=futureOffers(product).find(x=>x.marketId===market.id); return f ? `<strong class="future-price">${eur(f.price)}</strong><small class="source-note">${escapeHtml(f.validFrom)}${f.matchType === "family" ? " · Sortenangebot" : ""}</small>` : "—"; })()}</td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>
      </section>`;
    }).join("") : emptyState("Keine Produkte für den Preisvergleich gefunden.");
  }

  function catalogMatches(query){
    const q = normalize(query);
    if(!q) return [];
    const tokens = q.split(" ").filter(Boolean);
    return DATA.catalog.filter(item=>{
      const haystack = normalize([item.name,item.size,item.packageType,...(item.searchTerms || [])].join(" "));
      return tokens.every(token=>haystack.includes(token));
    }).sort((a,b)=>{
      if(a.family !== b.family) return a.family.localeCompare(b.family,"de");
      return Number(a.amount || 0) - Number(b.amount || 0);
    });
  }

  function renderSearch(){
    const matches = catalogMatches(state.familyQuery);
    const examples = `<button class="example-chip" data-example="Coca-Cola Zero">Coca-Cola Zero</button><button class="example-chip" data-example="gemischtes Hackfleisch">gemischtes Hackfleisch</button><button class="example-chip" data-example="Monster Rossi">Monster Rossi</button>`;
    els.searchView.innerHTML = `<section class="search-panel">
      <div class="search-panel-copy"><span class="section-kicker">Freie Produktsuche</span><h3>Produktfamilie statt exakter Artikelbezeichnung</h3><p>Ähnliche Varianten werden nach Größe und Verpackungsart getrennt. Bei unterschiedlichen Mengen wird der Grundpreis später automatisch vergleichbar gemacht.</p></div>
      <div class="family-search-row"><input id="familySearchInput" type="search" value="${escapeAttr(state.familyQuery)}" placeholder="z. B. Coca-Cola Zero oder gemischtes Hackfleisch"><button id="familySearchBtn" class="primary-btn">Suchen</button></div>
      <div class="example-row"><span>Beispiele:</span>${examples}</div>
    </section>
    <div id="familyResults">${state.familyQuery ? (matches.length ? renderCatalogResults(matches) : emptyState("Keine passende Produktfamilie im lokalen Katalog gefunden.")) : `<div class="search-hint">Suchbegriff eingeben. Größen werden als einzelne trackbare Varianten angezeigt.</div>`}</div>`;

    const input = document.getElementById("familySearchInput");
    const trigger = ()=>{ state.familyQuery = input.value.trim(); renderSearch(); };
    document.getElementById("familySearchBtn")?.addEventListener("click",trigger);
    input?.addEventListener("keydown",e=>{ if(e.key === "Enter") trigger(); });
    document.querySelectorAll("[data-example]").forEach(btn=>btn.addEventListener("click",()=>{ state.familyQuery=btn.dataset.example; renderSearch(); }));
    document.querySelectorAll("[data-track]").forEach(btn=>btn.addEventListener("click",()=>addTracked(btn.dataset.track)));
    document.querySelectorAll("[data-search-untrack]").forEach(btn=>btn.addEventListener("click",()=>removeTracked(btn.dataset.searchUntrack)));
  }

  function renderCatalogResults(items){
    const groups = new Map();
    items.forEach(item=>{ if(!groups.has(item.family)) groups.set(item.family,[]); groups.get(item.family).push(item); });
    return [...groups.values()].map(group=>`<section class="catalog-group">
      <div class="catalog-group-head"><div><span class="section-kicker">${escapeHtml(group[0].name)}</span><h3>${group.length} Varianten gefunden</h3></div><div class="catalog-note">Grundpreis: ${group[0].unitType === "weight" ? "€/kg" : "€/l"}</div></div>
      <div class="variant-grid">${group.map(item=>{
        const tracked=isTracked(item.id);
        return `<article class="variant-card ${tracked ? "tracked" : ""}">${productImage(item,"variant-image")}<div class="variant-copy"><h4>${escapeHtml(item.size)}</h4><p>${escapeHtml(item.packageType || "Packung")}</p><span class="variant-unit">Vergleich: ${item.unitType === "weight" ? "€/kg" : "€/l"}</span></div>${tracked ? `<button class="variant-btn tracked-btn" data-search-untrack="${escapeAttr(item.id)}">Beobachtung entfernen</button>` : `<button class="variant-btn" data-track="${escapeAttr(item.id)}">Produkt beobachten</button>`}</article>`;
      }).join("")}</div>
    </section>`).join("");
  }

  function normalizeScannedCode(value){
    const code = String(value || "").replace(/\D/g, "");
    return [8,12,13,14].includes(code.length) ? code : null;
  }

  function quantityFromOpenFoodFacts(product){
    const rawAmount = Number(product?.product_quantity);
    const rawUnit = String(product?.product_quantity_unit || "").toLowerCase();
    if(Number.isFinite(rawAmount) && rawAmount > 0){
      if(rawUnit === "ml") return {amount:rawAmount / 1000, unit:"l"};
      if(rawUnit === "cl") return {amount:rawAmount / 100, unit:"l"};
      if(rawUnit === "l") return {amount:rawAmount, unit:"l"};
      if(rawUnit === "kg") return {amount:rawAmount * 1000, unit:"g"};
      if(rawUnit === "g") return {amount:rawAmount, unit:"g"};
    }
    return {amount:null,unit:null};
  }

  function formatScannedAmount(amount,unit,fallback=""){
    if(amount == null || !unit) return fallback || "Menge nicht erkannt";
    const value = Number(amount).toLocaleString("de-DE",{maximumFractionDigits:3});
    return `${value} ${unit}`;
  }

  function postcodeForLookup(){
    const match = String(state.location || "").match(/\b\d{5}\b/);
    return match ? match[0] : null;
  }

  function freshnessText(hit){
    if(hit?.freshness === "fresh") return "frisch gemeldet";
    if(hit?.freshness === "recent") return "aktueller Preisstand";
    if(hit?.freshness === "future") return "kommendes Angebot";
    if(hit?.freshness === "historical") return "älterer Preisstand";
    return "Preisstand";
  }

  function lookupHitMarketName(hit){
    const market = DATA.markets.find(m=>marketRetailerSlug(m)===hit?.retailer_slug);
    return market?.name || hit?.retailer_name || hit?.retailer_slug || "Händler";
  }

  async function lookupScannedPrices(code, productId=null){
    if(!API || !state.backend.connected) return;
    state.scanner.priceLoading = true;
    state.scanner.priceError = null;
    state.scanner.prices = null;
    renderScanner();
    try{
      state.scanner.prices = await API.lookupPrices(code, postcodeForLookup(), productId);
      if(productId) await syncBackend(false);
    }catch(error){
      state.scanner.priceError = error.message || "Preisabfrage fehlgeschlagen.";
    }finally{
      state.scanner.priceLoading = false;
      renderScanner();
    }
  }

  function scannerCandidateFromOff(code, product){
    const qty = quantityFromOpenFoodFacts(product);
    const name = String(product?.product_name_de || product?.product_name || product?.generic_name_de || "").trim();
    const brand = String(product?.brands || "").split(",")[0].trim();
    const quantity = String(product?.quantity || "").trim();
    return {
      source:"Open Food Facts",
      gtin:code,
      name:name || (brand ? `${brand} Produkt` : "Unbekanntes Produkt"),
      brand:brand || null,
      amount:qty.amount,
      unit:qty.unit,
      size:quantity || formatScannedAmount(qty.amount,qty.unit),
      packageType:"",
      image:product?.image_front_small_url || product?.image_front_url || null,
      foundExternally:Boolean(name || brand)
    };
  }

  function findPotentialBackendMatch(candidate){
    if(candidate.amount == null || !candidate.unit) return null;
    const wantedWords = new Set(normalize(`${candidate.brand || ""} ${candidate.name || ""}`).split(/\s+/).filter(word=>word.length >= 3));
    let best = null;
    let bestScore = 0;
    for(const item of state.backend.products){
      if(item.gtin) continue;
      const amount = Number(item.amount_value);
      if(!Number.isFinite(amount) || Math.abs(amount - Number(candidate.amount)) > 0.001) continue;
      if(normalize(item.amount_unit || "") !== normalize(candidate.unit)) continue;
      const itemWords = new Set(normalize(`${item.brand || ""} ${item.name || ""}`).split(/\s+/).filter(word=>word.length >= 3));
      let overlap = 0;
      wantedWords.forEach(word=>{ if(itemWords.has(word)) overlap += 1; });
      if(overlap > bestScore){ bestScore = overlap; best = item; }
    }
    return bestScore >= 2 ? best : null;
  }

  function scannerPayload(candidate, manualName=null){
    const name = String(manualName || candidate?.name || "").trim();
    return {
      gtin:candidate.gtin,
      brand:candidate.brand || null,
      name,
      variant:candidate.size && candidate.size !== "Menge nicht erkannt" ? candidate.size : null,
      amount_value:candidate.amount,
      amount_unit:candidate.unit,
      package_type:candidate.packageType || null,
      image_key:candidate.image || null,
      track:true,
      target_price_cents:null
    };
  }

  function scannerStatus(text){
    state.scanner.status = text;
    const el = document.getElementById("scannerStatus");
    if(el) el.textContent = text;
  }

  async function stopBarcodeScanner(){
    state.scanner.running = false;
    if(state.scanner.timer){
      clearTimeout(state.scanner.timer);
      state.scanner.timer = null;
    }
    if(state.scanner.stream){
      state.scanner.stream.getTracks().forEach(track=>track.stop());
      state.scanner.stream = null;
    }
    if(state.scanner.html5){
      const scanner = state.scanner.html5;
      state.scanner.html5 = null;
      try{ await scanner.stop(); }catch{}
      try{ scanner.clear(); }catch{}
    }
    state.scanner.detector = null;
    state.scanner.mode = null;
  }

  async function nativeScanLoop(video){
    if(!state.scanner.running || state.scanner.mode !== "native" || !state.scanner.detector) return;
    try{
      if(video.readyState >= 2){
        const results = await state.scanner.detector.detect(video);
        if(results?.length){
          const hit = results.find(item=>normalizeScannedCode(item.rawValue));
          if(hit){ await handleScannedCode(hit.rawValue); return; }
        }
      }
    }catch{}
    if(state.scanner.running && state.scanner.mode === "native"){
      state.scanner.timer = setTimeout(()=>nativeScanLoop(video),160);
    }
  }

  async function startNativeScanner(){
    if(!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) return false;
    let formats = [];
    try{ formats = await BarcodeDetector.getSupportedFormats(); }catch{return false;}
    const wanted = ["ean_13","ean_8","upc_a","upc_e"].filter(format=>formats.includes(format));
    if(!wanted.length) return false;

    const reader = document.getElementById("barcodeReader");
    if(!reader) return false;
    reader.innerHTML = `<div class="native-camera"><video id="barcodeVideo" playsinline muted></video><div class="scan-frame"><span></span></div></div>`;
    const video = document.getElementById("barcodeVideo");
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}
      });
      state.scanner.stream = stream;
      state.scanner.detector = new BarcodeDetector({formats:wanted});
      state.scanner.mode = "native";
      state.scanner.running = true;
      video.srcObject = stream;
      await video.play();
      scannerStatus("Kamera aktiv · Barcode quer in den Rahmen halten.");
      nativeScanLoop(video);
      return true;
    }catch(error){
      if(state.scanner.stream){ state.scanner.stream.getTracks().forEach(track=>track.stop()); state.scanner.stream=null; }
      reader.innerHTML = "";
      if(error?.name === "NotAllowedError") throw new Error("Kamerazugriff wurde verweigert. Kamera-Berechtigung für Preisscan erlauben.");
      return false;
    }
  }

  async function loadScannerFallback(){
    if(typeof window.Html5Qrcode === "function" && window.Html5QrcodeSupportedFormats) return true;
    const existing = document.querySelector('script[data-preisscan-scanner-fallback]');
    if(existing){
      return await new Promise(resolve=>{
        if(typeof window.Html5Qrcode === "function") return resolve(true);
        existing.addEventListener("load",()=>resolve(typeof window.Html5Qrcode === "function"),{once:true});
        existing.addEventListener("error",()=>resolve(false),{once:true});
      });
    }
    return await new Promise(resolve=>{
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.integrity = "sha512-r6rDA7W6ZeQhvl8S7yRVQUKVHdexq+GAlNkNNqVC7YyIV+NwqCTJe2hDWCiffTyRNOeGEzRRJ9ifvRm/HCzGYg==";
      script.crossOrigin = "anonymous";
      script.dataset.preisscanScannerFallback = "1";
      script.onload = ()=>resolve(typeof window.Html5Qrcode === "function");
      script.onerror = ()=>resolve(false);
      document.head.appendChild(script);
    });
  }

  async function startFallbackScanner(){
    scannerStatus("Nativer Scanner nicht verfügbar · Fallback wird geladen …");
    if(!(await loadScannerFallback())) return false;
    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E
    ];
    try{
      const scanner = new Html5Qrcode("barcodeReader",{formatsToSupport:formats,useBarCodeDetectorIfSupported:false},false);
      state.scanner.html5 = scanner;
      state.scanner.mode = "fallback";
      state.scanner.running = true;
      await scanner.start(
        {facingMode:"environment"},
        {fps:12,qrbox:{width:250,height:110},aspectRatio:4/3},
        decodedText=>handleScannedCode(decodedText),
        ()=>{}
      );
      scannerStatus("Kamera aktiv · Fallback-Scanner läuft.");
      return true;
    }catch(error){
      state.scanner.running = false;
      state.scanner.mode = null;
      state.scanner.html5 = null;
      if(String(error).toLowerCase().includes("permission")) throw new Error("Kamerazugriff wurde verweigert. Kamera-Berechtigung für Preisscan erlauben.");
      return false;
    }
  }

  async function startBarcodeScanner(){
    if(state.scanner.running || state.scanner.busy) return;
    state.scanner.candidate = null;
    state.scanner.prices = null;
    state.scanner.priceError = null;
    state.scanner.priceLoading = false;
    renderScanner();
    scannerStatus("Kamera wird gestartet …");
    try{
      if(await startNativeScanner()) return;
      if(await startFallbackScanner()) return;
      scannerStatus("Kamera-Scanner auf diesem Gerät nicht verfügbar. EAN unten manuell eingeben.");
    }catch(error){
      scannerStatus(error.message || "Kamera konnte nicht gestartet werden.");
    }
  }

  async function handleScannedCode(rawCode){
    if(state.scanner.busy) return;
    const code = normalizeScannedCode(rawCode);
    if(!code){ scannerStatus("Kein gültiger EAN-/UPC-Code erkannt."); return; }
    state.scanner.busy = true;
    state.scanner.lastCode = code;
    await stopBarcodeScanner();
    scannerStatus(`EAN ${code} erkannt · Produkt wird gesucht …`);

    try{
      if(state.backend.connected){
        try{
          const existing = await API.byGtin(code);
          if(existing?.product){
            const item = existing.product;
            const localId = localIdForBackendProduct(item);
            const pos = state.backend.products.findIndex(x=>x.id===item.id);
            if(pos >= 0) state.backend.products[pos] = item; else state.backend.products.push(item);
            state.backend.productIdByLocal.set(localId,item.id);
            state.backend.localIdByBackend.set(item.id,localId);
            state.scanner.candidate = {type:"backend",gtin:code,localId,product:item};
            scannerStatus("Produkt erkannt · Preise werden verglichen …");
            renderScanner();
            await lookupScannedPrices(code,item.id);
            scannerStatus("Produkt erkannt · Preisvergleich abgeschlossen.");
            renderScanner();
            requestAnimationFrame(()=>{
              document.querySelector(".scanner-result-wrap")?.scrollIntoView({
                behavior:"smooth",
                block:"start"
              });
            });
            return;
          }
        }catch(error){
          if(error?.status !== 404) throw error;
        }
      }

      scannerStatus(`EAN ${code} ist noch nicht in Preisscan · externe Produktdaten werden gesucht …`);
      try{
        const off = await API.openFoodFactsProduct(code);
        if(off?.found){
          const resolved = scannerCandidateFromOff(code,off.product);
          const match = findPotentialBackendMatch(resolved);
          if(match){
            state.scanner.candidate = {type:"match",gtin:code,product:match,resolved};
            scannerStatus("Passendes vorhandenes Preisscan-Produkt gefunden. EAN kann zugeordnet werden.");
          }else{
            state.scanner.candidate = {type:"external",...resolved};
            scannerStatus("Produktdaten gefunden. Noch nicht in deiner D1-Datenbank gespeichert.");
          }
        }else{
          state.scanner.candidate = {type:"manual",gtin:code,name:"",brand:null,amount:null,unit:null,size:"",image:null};
          scannerStatus("Barcode erkannt, aber keine Produktdaten gefunden. Produktname kann manuell ergänzt werden.");
        }
      }catch(error){
        state.scanner.candidate = {type:"manual",gtin:code,name:"",brand:null,amount:null,unit:null,size:"",image:null};
        scannerStatus(`Barcode erkannt. Externe Produktdaten derzeit nicht erreichbar: ${error.message}`);
      }
      renderScanner();
      scannerStatus(`EAN ${code} erkannt · Preise werden verglichen …`);
      await lookupScannedPrices(code,null);
      scannerStatus("Produkt erkannt · Preisvergleich abgeschlossen.");
      renderScanner();
      requestAnimationFrame(()=>{
        document.querySelector(".scanner-result-wrap")?.scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
      });
    }catch(error){
      state.scanner.candidate = {type:"error",gtin:code,message:error.message};
      scannerStatus(`Produktsuche fehlgeschlagen: ${error.message}`);
      renderScanner();
    }finally{
      state.scanner.busy = false;
    }
  }

  async function linkScannedMatch(){
    const candidate = state.scanner.candidate;
    if(!candidate || candidate.type !== "match") return;
    if(!state.backend.connected){ showToast("Backend ist nicht verbunden."); return; }
    try{
      scannerStatus("EAN wird dem vorhandenen Produkt zugeordnet …");
      await API.setGtin(candidate.product.id,candidate.gtin);
      await API.trackProduct(candidate.product.id,candidate.product.target_price_cents ?? null);
      await syncBackend(false);
      const updated = state.backend.products.find(item=>item.id===candidate.product.id) || {...candidate.product,gtin:candidate.gtin,tracked:1};
      const localId = localIdForBackendProduct(updated);
      if(!state.trackedIds.includes(localId)) state.trackedIds.push(localId);
      saveTracked();
      state.scanner.candidate = {type:"backend",gtin:candidate.gtin,localId,product:updated};
      await lookupScannedPrices(candidate.gtin,candidate.product.id);
      await syncBackend(false);
      rebuildFilter();
      renderAll();
      scannerStatus("EAN zugeordnet. Produkt wird beobachtet.");
      renderScanner();
      showToast("EAN zugeordnet und Produkt wird beobachtet.");
    }catch(error){
      scannerStatus(`Zuordnung fehlgeschlagen: ${error.message}`);
      showToast(`EAN konnte nicht zugeordnet werden: ${error.message}`);
    }
  }

  async function saveScannedCandidate(){
    const candidate = state.scanner.candidate;
    if(!candidate || !["external","manual"].includes(candidate.type)) return;
    if(!state.backend.connected){ showToast("Backend ist nicht verbunden. Produkt kann noch nicht gespeichert werden."); return; }
    const manualName = candidate.type === "manual" ? (document.getElementById("manualScanName")?.value || "").trim() : null;
    if(candidate.type === "manual" && !manualName){ showToast("Bitte einen Produktnamen eingeben."); return; }
    try{
      scannerStatus("Produkt wird in D1 angelegt und beobachtet …");
      const result = await API.ensureProduct(scannerPayload(candidate,manualName));
      await syncBackend(false);
      if(result?.product){
        const localId = localIdForBackendProduct(result.product);
        if(!state.trackedIds.includes(localId)) state.trackedIds.push(localId);
        saveTracked();
        state.scanner.candidate = {type:"backend",gtin:candidate.gtin,localId,product:result.product};
        await lookupScannedPrices(candidate.gtin,result.product.id);
        await syncBackend(false);
      }
      rebuildFilter();
      renderAll();
      scannerStatus("Produkt gespeichert und zur Beobachtung hinzugefügt.");
      renderScanner();
      showToast("Produkt gespeichert und wird jetzt beobachtet.");
    }catch(error){
      scannerStatus(`Speichern fehlgeschlagen: ${error.message}`);
      showToast(`Produkt konnte nicht gespeichert werden: ${error.message}`);
    }
  }

  function scannerPriceResultHtml(){
    if(state.scanner.priceLoading){
      return `<section class="scan-price-panel loading"><div class="scan-price-spinner"></div><div><strong>Preise werden verglichen …</strong><span>Aktivierte Händler und Preisquellen werden geprüft.</span></div></section>`;
    }
    if(state.scanner.priceError){
      return `<section class="scan-price-panel error"><strong>Preisvergleich derzeit gestört</strong><span>${escapeHtml(state.scanner.priceError)}</span></section>`;
    }
    const result = state.scanner.prices;
    if(!result) return ``;

    const current = Array.isArray(result.current) ? result.current : [];
    const future = Array.isArray(result.future) ? result.future : [];
    const historical = Array.isArray(result.historical) ? result.historical : [];
    const best = result.cheapest_current;
    const latestKnown = historical.length
      ? [...historical].sort((a,b)=>String(b.observed_date || "").localeCompare(String(a.observed_date || "")))[0]
      : null;

    return `<section class="scan-price-panel" id="directPriceResult">
      <div class="scan-price-head">
        <div>
          <span class="section-kicker">Direkter Preisvergleich</span>
          <h3>${best
            ? `Günstigster aktueller Treffer: ${eur(best.price_cents/100)}`
            : latestKnown
              ? `Letzter bekannter Preis: ${eur(latestKnown.price_cents/100)}`
              : "Kein Preis gefunden"
          }</h3>
          ${!best && latestKnown
            ? `<small class="scan-last-known">${escapeHtml(lookupHitMarketName(latestKnown))} · Stand ${escapeHtml(latestKnown.observed_date || "Datum unbekannt")} · nicht als heutiger Preis gewertet</small>`
            : ``}
        </div>
        ${best
          ? `<span class="scan-best-retailer">${escapeHtml(lookupHitMarketName(best))}</span>`
          : latestKnown
            ? `<span class="scan-best-retailer historical-badge">${escapeHtml(lookupHitMarketName(latestKnown))}</span>`
            : ``
        }
      </div>

      ${current.length
        ? `<div class="scan-price-list">${current.map(hit=>`<div class="scan-price-row bestable"><div><strong>${escapeHtml(lookupHitMarketName(hit))}</strong><small>${escapeHtml(hit.location_label || freshnessText(hit))}</small><small>${escapeHtml(hit.source_name || "Preisquelle")} · ${escapeHtml(hit.observed_date || "Datum unbekannt")}</small>${hit.note ? `<small>${escapeHtml(hit.note)}</small>` : ``}</div><div><strong>${eur(hit.price_cents/100)}</strong><span class="state-pill ${hit.price_type === "offer" ? "future" : "hit"}">${hit.price_type === "offer" ? "Angebot" : "Preis"}</span></div></div>`).join("")}</div>`
        : latestKnown
          ? `<div class="scan-no-current"><strong>Kein ausreichend frischer heutiger Preis.</strong><span>Der letzte bekannte Preis wird unten trotzdem direkt angezeigt.</span></div>`
          : `<div class="scan-no-current">Von den momentan angebundenen Quellen wurde für diesen Barcode kein Preis gefunden.</div>`
      }

      ${future.length ? `<div class="scan-subsection"><strong>Kommende Angebote</strong>${future.map(hit=>`<div class="scan-price-row"><div><strong>${escapeHtml(lookupHitMarketName(hit))}</strong><small>ab ${escapeHtml(hit.valid_from || hit.observed_date || "")}</small></div><strong>${eur(hit.price_cents/100)}</strong></div>`).join("")}</div>` : ``}

      ${historical.length ? `<details class="scan-history" open><summary>Bekannte ältere Preisstände (${historical.length})</summary>${historical.slice(0,8).map(hit=>`<div class="scan-price-row historical"><div><strong>${escapeHtml(lookupHitMarketName(hit))}</strong><small>${escapeHtml(hit.observed_date ? `Stand ${hit.observed_date}` : freshnessText(hit))}</small><small>${escapeHtml(hit.source_name || "Preisquelle")}</small>${hit.note ? `<small>${escapeHtml(hit.note)}</small>` : ``}</div><strong>${eur(hit.price_cents/100)}</strong></div>`).join("")}</details>` : ``}

      <div class="scan-source-note">PLZ: ${escapeHtml(result.postcode || postcodeForLookup() || "nicht gesetzt")} · Fehlende Händler bedeuten „keine Daten“, nicht „Produkt dort nicht erhältlich“.</div>
    </section>`;
  }

  function scannerResultHtml(){
    const candidate = state.scanner.candidate;
    if(!candidate) return `<div class="scanner-empty">Noch kein Barcode erkannt.</div>`;
    if(candidate.type === "backend"){
      const item = candidate.product;
      const local = productById(candidate.localId) || backendProductToLocal(item);
      const tracked = isTracked(candidate.localId) || item.tracked === 1;
      return `<article class="scan-result-card success">
        ${productImage(local,"scan-product-image")}
        <div class="scan-result-copy">
          <span class="section-kicker">In Preisscan gefunden</span>
          <h3>${escapeHtml(local.name)} ${escapeHtml(local.size || "")}</h3>
          <p>EAN/GTIN: <strong>${escapeHtml(candidate.gtin)}</strong></p>
          <span class="state-pill hit">${tracked ? "Wird bereits beobachtet" : "Noch nicht beobachtet"}</span>
          ${tracked ? `` : `<button class="primary-btn scan-result-action" data-scan-track="${escapeAttr(candidate.localId)}">Produkt beobachten</button>`}
        </div>
      </article>`;
    }
    if(candidate.type === "match"){
      const item = candidate.product;
      const local = backendProductToLocal(item);
      return `<article class="scan-result-card match">
        ${productImage(local,"scan-product-image")}
        <div class="scan-result-copy">
          <span class="section-kicker">Passendes Produkt vorhanden</span>
          <h3>${escapeHtml(local.name)} ${escapeHtml(local.size || "")}</h3>
          <p>Der Barcode <strong>${escapeHtml(candidate.gtin)}</strong> passt sehr wahrscheinlich zu diesem bereits angelegten Produkt.</p>
          <small>Die Zuordnung wird erst mit deinem Klick in D1 gespeichert.</small>
          <button class="primary-btn scan-result-action" id="linkScannedProductBtn">EAN zuordnen & beobachten</button>
        </div>
      </article>`;
    }
    if(candidate.type === "external"){
      const pic = candidate.image
        ? `<div class="scan-product-image"><img src="${escapeAttr(candidate.image)}" alt="Produktbild" referrerpolicy="no-referrer"></div>`
        : `<div class="scan-product-image image-fallback"><span>Produkt</span><small>${escapeHtml(candidate.size || "")}</small></div>`;
      return `<article class="scan-result-card">
        ${pic}
        <div class="scan-result-copy">
          <span class="section-kicker">Produktdaten gefunden</span>
          <h3>${escapeHtml(candidate.name)}</h3>
          <p>${candidate.brand ? `${escapeHtml(candidate.brand)} · ` : ""}${escapeHtml(candidate.size || "Menge nicht erkannt")}</p>
          <p>EAN/GTIN: <strong>${escapeHtml(candidate.gtin)}</strong></p>
          <small>Quelle: ${escapeHtml(candidate.source)}</small>
          <button class="primary-btn scan-result-action" id="saveScannedProductBtn">Produkt beobachten</button>
        </div>
      </article>`;
    }
    if(candidate.type === "manual"){
      return `<article class="scan-result-card manual">
        <div class="scan-result-copy wide">
          <span class="section-kicker">Barcode erkannt</span>
          <h3>Produkt noch unbekannt</h3>
          <p>EAN/GTIN: <strong>${escapeHtml(candidate.gtin)}</strong></p>
          <label class="scan-manual-label" for="manualScanName">Produktname</label>
          <input id="manualScanName" class="scan-manual-input" type="text" placeholder="z. B. Coca-Cola Zero 0,5 l">
          <button class="primary-btn scan-result-action" id="saveScannedProductBtn">Produkt anlegen & beobachten</button>
        </div>
      </article>`;
    }
    return `<div class="scanner-error">${escapeHtml(candidate.message || "Scan konnte nicht verarbeitet werden.")}</div>`;
  }

  function bindScannerControls(){
    document.getElementById("startScannerBtn")?.addEventListener("click",startBarcodeScanner);
    document.getElementById("stopScannerBtn")?.addEventListener("click",async()=>{ await stopBarcodeScanner(); scannerStatus("Scanner gestoppt."); renderScanner(); });
    const manual = document.getElementById("manualBarcodeInput");
    const submit = ()=>handleScannedCode(manual?.value || "");
    document.getElementById("manualBarcodeBtn")?.addEventListener("click",submit);
    manual?.addEventListener("keydown",e=>{ if(e.key === "Enter") submit(); });
    document.getElementById("saveScannedProductBtn")?.addEventListener("click",saveScannedCandidate);
    document.getElementById("linkScannedProductBtn")?.addEventListener("click",linkScannedMatch);
    document.querySelectorAll("[data-scan-track]").forEach(btn=>btn.addEventListener("click",async()=>{
      await addTracked(btn.dataset.scanTrack);
      const candidate = state.scanner.candidate;
      if(candidate?.type === "backend") candidate.product.tracked = 1;
      renderScanner();
    }));
  }

  function renderScanner(){
    if(!els.scanner) return;
    const running = state.scanner.running;
    els.scanner.innerHTML = `<section class="scanner-card">
      <div class="scanner-head">
        <div>
          <span class="section-kicker">Kamera-Scanner</span>
          <h2>Barcode scannen</h2>
          <p>EAN-8, EAN-13 und UPC direkt mit der Kamera lesen. Bekannte Produkte werden sofort in Preisscan gesucht.</p>
        </div>
        <div class="scanner-actions">
          <button id="startScannerBtn" class="scan-main-btn" ${running ? "disabled" : ""}>Kamera starten</button>
          <button id="stopScannerBtn" class="ghost-btn" ${running ? "" : "disabled"}>Stoppen</button>
        </div>
      </div>
      <div id="barcodeReader" class="barcode-reader ${running ? "active" : ""}">${running ? "" : `<div class="scanner-placeholder"><div class="barcode-art" aria-hidden="true"></div><strong>Kamera ist aus</strong><span>Zum Starten auf „Kamera starten“ tippen.</span></div>`}</div>
      <div id="scannerStatus" class="scanner-status">${escapeHtml(state.scanner.status)}</div>
      <div class="manual-barcode-row">
        <input id="manualBarcodeInput" inputmode="numeric" autocomplete="off" placeholder="EAN/GTIN alternativ eingeben" value="${escapeAttr(state.scanner.lastCode || "")}">
        <button id="manualBarcodeBtn" class="ghost-btn">EAN prüfen</button>
      </div>
    </section>
    <section class="scanner-result-wrap">
      <span class="section-kicker">Scan-Ergebnis</span>
      ${scannerResultHtml()}
      ${scannerPriceResultHtml()}
    </section>`;
    bindScannerControls();
  }

  function renderAlerts(){
    const products = filteredProducts();
    els.alerts.innerHTML = products.length ? `<div class="alert-list">${products.map(product=>{
      const alarm=getAlarm(product), status=alarmState(product), best=bestPrice(product);
      return `<article class="alert-card"><div class="alert-ident">${productImage(product,"product-photo tiny")}<div><h3>${escapeHtml(product.name)} ${escapeHtml(product.size)}</h3><p>${alarm == null || alarm === "" ? "Kein Preiswecker gesetzt." : `Benachrichtigung bei ${eur(alarm)} oder darunter.`}${best?.option?.requirement ? ` Günstigster Treffer benötigt aktuell ${escapeHtml(best.option.requirement)}.` : ""}</p></div></div><div><span class="state-pill ${status.type === "hit" ? "hit" : status.type === "future" ? "future" : ""}">${status.text}</span></div></article>`;
    }).join("")}</div>` : emptyState("Keine Preiswecker-Produkte gefunden.");
  }

  function renderSettings(){
    if(!els.settingsView) return;
    const userCreated = state.backend.user?.created_at || "—";
    const serverLabel = state.backend.connected ? "Verfügbar" : state.backend.syncing ? "Wird geprüft" : "Gestört / offline";
    const serverClass = state.backend.connected ? "setting-ok" : "setting-bad";
    els.settingsView.innerHTML = `
      <section class="settings-card">
        <span class="section-kicker">Serververbindung</span>
        <h3>Preisscan-Dienst</h3>
        <div class="settings-grid">
          <div class="setting-row"><span>Status</span><strong class="${serverClass}">${serverLabel}</strong></div>
        </div>
        <button id="checkBackendBtn" class="ghost-btn">Verbindung prüfen</button>
        <p class="settings-note">Technische Server- und Datenbankdetails werden normalen Nutzern nicht angezeigt. Bei einer Störung bleibt hier nur sichtbar, dass die Verbindung nicht verfügbar ist.</p>
      </section>

      <section class="settings-card">
        <span class="section-kicker">Persönliche Liste</span>
        <h3>Dein Preisscan-Profil</h3>
        <p class="settings-note">Beobachtete Produkte, Preiswecker und Händlerauswahl bleiben von anderen Nutzern getrennt. Kein Login und kein Passwort nötig.</p>
        <div class="settings-grid">
          <div class="setting-row"><span>Profil</span><strong class="${API?.hasUserToken() ? "setting-ok" : "setting-bad"}">${API?.hasUserToken() ? "Aktiv" : "Nicht verbunden"}</strong></div>
          <div class="setting-row"><span>Profil angelegt</span><strong>${escapeHtml(userCreated)}</strong></div>
          <div class="setting-row"><span>Beobachtete Produkte</span><strong>${state.trackedIds.length}</strong></div>
        </div>
      </section>

      <section class="settings-card">
        <span class="section-kicker">Persönliche Händlerauswahl</span>
        <h3>Welche Händler sollen berücksichtigt werden?</h3>
        <p class="settings-note">Ausgeschaltete Händler werden beim Scan, Preisvergleich, Preiswecker und bei kommenden Angeboten nicht berücksichtigt.</p>
        <div class="retailer-pref-actions">
          <button id="enableAllRetailersBtn" class="ghost-btn">Alle aktivieren</button>
          <button id="disableAllRetailersBtn" class="ghost-btn">Alle deaktivieren</button>
        </div>
        <div class="retailer-pref-list">
          ${(state.backend.retailers || []).map(retailer=>{
            const pref = state.retailerPrefs?.[retailer.slug];
            const enabled = pref?.enabled !== false;
            return `<label class="retailer-pref-row">
              <div class="retailer-pref-copy">
                <strong>${escapeHtml(retailer.name)}</strong>
                <small>${enabled ? "Wird beim Preisvergleich berücksichtigt" : "Für dich ausgeblendet"}</small>
              </div>
              <input type="checkbox" data-retailer-pref="${retailer.id}" data-retailer-slug="${escapeAttr(retailer.slug)}" ${enabled ? "checked" : ""}>
              <span class="retailer-switch" aria-hidden="true"></span>
            </label>`;
          }).join("") || `<div class="empty-state compact"><strong>Händlerdaten noch nicht geladen</strong><span>Serververbindung prüfen.</span></div>`}
        </div>
      </section>`;

    document.getElementById("checkBackendBtn")?.addEventListener("click",()=>syncBackend(true));

    document.querySelectorAll("[data-retailer-pref]").forEach(input=>{
      input.addEventListener("change", async ()=>{
        const retailerId = Number(input.dataset.retailerPref);
        const slug = input.dataset.retailerSlug;
        const enabled = input.checked;
        state.retailerPrefs[slug] = {...(state.retailerPrefs[slug] || {}),id:retailerId,enabled};
        saveRetailerPrefs();
        renderAll();
        try{
          await API.setRetailerPreference(retailerId, enabled);
          showToast(`${enabled ? "Händler aktiviert" : "Händler ausgeblendet"}.`);
        }catch(error){
          showToast(`Händlerauswahl nur lokal gespeichert: ${error.message}`);
        }
      });
    });

    document.getElementById("enableAllRetailersBtn")?.addEventListener("click",()=>setAllRetailerPreferences(true));
    document.getElementById("disableAllRetailersBtn")?.addEventListener("click",()=>setAllRetailerPreferences(false));
  }

  async function setAllRetailerPreferences(enabled){
    for(const retailer of state.backend.retailers || []){
      state.retailerPrefs[retailer.slug] = {
        ...(state.retailerPrefs[retailer.slug] || {}),
        id:Number(retailer.id),
        name:retailer.name,
        enabled:Boolean(enabled)
      };
    }
    saveRetailerPrefs();
    renderAll();

    try{
      const result = await API.setAllRetailers(Boolean(enabled));
      applyRetailerPreferenceRows(result.retailers || []);
      renderAll();
      showToast(enabled ? "Alle Händler aktiviert." : "Alle Händler ausgeblendet.");
    }catch(error){
      showToast(`Händlerauswahl nur lokal gespeichert: ${error.message}`);
    }
  }

  function bindAlarmInputs(){
    document.querySelectorAll("[data-alarm]").forEach(input=>input.addEventListener("change",async()=>{
      const raw=input.value.trim();
      const value = raw === "" ? null : Number(raw);
      const id = input.dataset.alarm;
      setAlarm(id,value);
      const backendId = backendIdForLocal(id);
      if(state.backend.connected && backendId){
        try{ await API.setTarget(backendId, value == null ? null : Math.round(value*100)); }
        catch(error){ showToast(`Preiswecker nur lokal gespeichert: ${error.message}`); renderAll(); return; }
      }
      renderAll();
      showToast(state.backend.connected ? "Preiswecker gespeichert und mit D1 synchronisiert." : "Preiswecker lokal gespeichert.");
    }));
  }

  function bindUntrackButtons(){
    document.querySelectorAll("[data-untrack]").forEach(btn=>btn.addEventListener("click",()=>removeTracked(btn.dataset.untrack)));
  }

  function renderStats(){
    const products=trackedProducts();
    document.getElementById("productCount").textContent=products.length;
    document.getElementById("marketCount").textContent=enabledMarkets().length;
    document.getElementById("knownPriceCount").textContent=products.reduce((sum,p)=>sum+allReportedPrices(p).length,0);
  }

  function rebuildFilter(){
    const current=els.filter.value || "all";
    els.filter.innerHTML=`<option value="all">Alle beobachteten Produkte</option>`;
    trackedProducts().forEach(p=>{
      const option=document.createElement("option");
      option.value=p.id;
      option.textContent=`${p.name} ${p.size}`;
      els.filter.appendChild(option);
    });
    els.filter.value=[...els.filter.options].some(o=>o.value===current) ? current : "all";
  }

  function renderAll(){
    renderOverview();
    renderComparison();
    if(!state.scanner.running) renderScanner();
    renderSearch();
    renderAlerts();
    renderStats();
    renderLocation();
    renderSettings();
    updateBackendStatus();
  }

  function emptyState(text){ return `<div class="empty-state"><strong>Nichts anzuzeigen</strong><span>${escapeHtml(text)}</span></div>`; }

  function showToast(message){
    els.toast.textContent=message;
    els.toast.classList.add("show");
    clearTimeout(window.__preisscanToast);
    window.__preisscanToast=setTimeout(()=>els.toast.classList.remove("show"),3500);
  }

  function escapeHtml(value){ return String(value ?? "").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch])); }
  function escapeAttr(value){ return escapeHtml(value); }

  async function activateView(name){
    if(name !== "scanner" && state.scanner.running) await stopBarcodeScanner();
    document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===name));
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    state.currentView=name;
    const viewMap={overview:els.overview,comparison:els.comparison,scanner:els.scanner,search:els.searchView,alerts:els.alerts,settings:els.settingsView};
    viewMap[name]?.classList.add("active");
    if(name === "scanner") renderScanner();
  }

  document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>activateView(tab.dataset.view)));

  els.search.addEventListener("input",renderAll);
  els.filter.addEventListener("change",renderAll);
  async function openScannerAndStart(){
    await activateView("scanner");

    await new Promise(resolve=>{
      requestAnimationFrame(()=>{
        els.scanner?.scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
        setTimeout(resolve,220);
      });
    });

    await startBarcodeScanner();
  }

  els.scan?.addEventListener("click",openScannerAndStart);
  document.getElementById("heroScanBtn")?.addEventListener("click",openScannerAndStart);
  els.refresh.addEventListener("click",async()=>{
    if(!state.backend.connected){ await syncBackend(true); return; }
    els.refresh.disabled = true;
    const original = els.refresh.textContent;
    els.refresh.textContent = "Preise werden geprüft …";
    try{
      const result = await API.scanTrackedPrices(postcodeForLookup());
      await syncBackend(false);
      showToast(`${result.scanned_products || 0} Produkte geprüft.`);
    }catch(error){
      showToast(`Preisprüfung fehlgeschlagen: ${error.message}`);
    }finally{
      els.refresh.disabled = false;
      els.refresh.textContent = original;
    }
  });

  let deferredPrompt=null;
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPrompt=event;
    els.install.hidden=false;
  });
  els.install.addEventListener("click",async()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt=null;
    els.install.hidden=true;
  });

  window.addEventListener("pagehide",()=>{ stopBarcodeScanner(); });

  rebuildFilter();
  renderAll();
  syncBackend(false);

  if("serviceWorker" in navigator){
    navigator.serviceWorker
      .register("service-worker.js")
      .then(registration=>registration.update().catch(()=>{}))
      .catch(()=>{});
  }
})();
