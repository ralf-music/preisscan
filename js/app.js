(() => {
  const DATA = window.PREISSCAN_DATA;
  const SETTINGS_KEY = "preisscan.settings.v3";
  const TRACKED_KEY = "preisscan.trackedIds.v3";
  const LOCATION_KEY = "preisscan.location.v1";
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
    currentView: "overview",
    familyQuery: "",
    backend: {
      connected:false,
      syncing:false,
      health:null,
      meta:null,
      retailers:[],
      products:[],
      details:new Map(),
      productIdByLocal:new Map(),
      localIdByBackend:new Map(),
      marketStatesByLocal:new Map(),
      futureOffers:[]
    }
  };
  saveJSON(TRACKED_KEY, state.trackedIds);

  const els = {
    overview: document.getElementById("overviewView"),
    comparison: document.getElementById("comparisonView"),
    searchView: document.getElementById("searchView"),
    alerts: document.getElementById("alertsView"),
    search: document.getElementById("searchInput"),
    filter: document.getElementById("productFilter"),
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
      image:null,
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
    if(els.backendBadge){
      els.backendBadge.className = `backend-badge ${connected ? "online" : state.backend.syncing ? "pending" : "offline"}`;
      els.backendBadge.textContent = connected ? "Backend online" : state.backend.syncing ? "Backend wird geprüft" : "Backend offline";
    }
    if(els.backendFooter){
      els.backendFooter.textContent = connected
        ? `Backend verbunden · API ${state.backend.health?.api_version || ""}`.trim()
        : "Backend nicht erreichbar · lokale Daten aktiv";
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
          validFrom:`ab ${new Intl.DateTimeFormat("de-DE").format(from)}`,
          validUntil:row.valid_to || "",
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
      const [health,meta,productsResult,retailerResult] = await Promise.all([
        API.health(), API.meta(), API.products(), API.retailers()
      ]);
      state.backend.health = health;
      state.backend.meta = meta;
      state.backend.retailers = retailerResult.retailers || [];
      state.backend.products = productsResult.products || [];
      state.backend.details = new Map();
      state.backend.productIdByLocal = new Map();
      state.backend.localIdByBackend = new Map();
      state.backend.marketStatesByLocal = new Map();
      state.backend.futureOffers = [];

      for(const item of state.backend.products){
        const localId = localIdForBackendProduct(item);
        state.backend.productIdByLocal.set(localId,item.id);
        state.backend.localIdByBackend.set(item.id,localId);
        if(item.tracked === 1 && !state.trackedIds.includes(localId)) state.trackedIds.push(localId);
        if((item.tracked === 0 || item.tracked == null) && state.trackedIds.includes(localId) && !String(localId).startsWith("backend-")){
          // Bekannte Backend-Produkte folgen dem zentralen Trackingstatus.
          state.trackedIds = state.trackedIds.filter(x=>x!==localId);
        }
      }
      saveTracked();

      const trackedBackend = state.backend.products.filter(x=>x.tracked === 1);
      const details = await Promise.all(trackedBackend.map(x=>API.product(x.id).catch(()=>null)));
      details.filter(Boolean).forEach(detail=>{
        const localId = state.backend.localIdByBackend.get(detail.product.id);
        if(!localId) return;
        state.backend.details.set(detail.product.id,detail);
        const product = productById(localId);
        if(product) mergeBackendPrices(product,detail.prices || []);
      });

      state.backend.connected = health?.ok === true && health?.database === "connected";
      if(showMessage) showToast(`Backend verbunden · ${health.products ?? 0} Produkte in D1.`);
    }catch(error){
      state.backend.connected = false;
      if(showMessage) showToast(`Backend nicht erreichbar: ${error.message}`);
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
      if(!API.hasToken()){
        showToast("WRITE_TOKEN fehlt. Unter Einstellungen einmal lokal speichern.");
        return;
      }
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
      if(!API.hasToken()){
        showToast("WRITE_TOKEN fehlt. Unter Einstellungen einmal lokal speichern.");
        return;
      }
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
    return DATA.markets.flatMap(market=>{
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
    return DATA.markets.filter(m=>priceOptions(statusFor(product,m.id)).length>0);
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

  function futureOffers(product){ return [...DATA.futureOffers, ...state.backend.futureOffers].filter(x=>x.productId===product.id); }

  function filteredProducts(){
    const q = normalize(els.search.value);
    const f = els.filter.value;
    return trackedProducts().filter(p=>{
      if(f !== "all" && p.id !== f) return false;
      if(!q) return true;
      const marketText = DATA.markets.flatMap(m=>[m.name,m.branch,m.area]).filter(Boolean).join(" ");
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
    const rows = DATA.markets.map(m=>statusFor(product,m.id));
    return {
      price: rows.filter(e=>priceOptions(e).length>0).length,
      na: rows.filter(e=>e.status==="na").length,
      unknown: rows.filter(e=>e.status==="unknown").length,
      unchecked: rows.filter(e=>e.status==="unchecked").length
    };
  }

  function latestCheck(product){
    const checks = DATA.markets
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
                <div class="metric"><b>Märkte mit Preis</b><strong>${counts.price} / ${DATA.markets.length}</strong></div>
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
            <tbody>${DATA.markets.map(market=>{
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

  function renderAlerts(){
    const products = filteredProducts();
    els.alerts.innerHTML = products.length ? `<div class="alert-list">${products.map(product=>{
      const alarm=getAlarm(product), status=alarmState(product), best=bestPrice(product);
      return `<article class="alert-card"><div class="alert-ident">${productImage(product,"product-photo tiny")}<div><h3>${escapeHtml(product.name)} ${escapeHtml(product.size)}</h3><p>${alarm == null || alarm === "" ? "Kein Preiswecker gesetzt." : `Benachrichtigung bei ${eur(alarm)} oder darunter.`}${best?.option?.requirement ? ` Günstigster Treffer benötigt aktuell ${escapeHtml(best.option.requirement)}.` : ""}</p></div></div><div><span class="state-pill ${status.type === "hit" ? "hit" : status.type === "future" ? "future" : ""}">${status.text}</span></div></article>`;
    }).join("")}</div>` : emptyState("Keine Preiswecker-Produkte gefunden.");
  }

  function renderSettings(){
    if(!els.settingsView) return;
    const health = state.backend.health;
    const meta = state.backend.meta;
    els.settingsView.innerHTML = `
      <section class="settings-card">
        <span class="section-kicker">Cloudflare Backend</span>
        <h3>Preisscan API</h3>
        <div class="settings-grid">
          <div class="setting-row"><span>Status</span><strong class="${state.backend.connected ? "setting-ok" : "setting-bad"}">${state.backend.connected ? "Verbunden" : "Nicht erreichbar"}</strong></div>
          <div class="setting-row"><span>API</span><strong>${escapeHtml(API?.baseUrl || "—")}</strong></div>
          <div class="setting-row"><span>API-Version</span><strong>${escapeHtml(health?.api_version || "—")}</strong></div>
          <div class="setting-row"><span>D1-Schema</span><strong>${escapeHtml(health?.schema_version || "—")}</strong></div>
          <div class="setting-row"><span>D1-Produkte</span><strong>${meta?.counts?.products ?? health?.products ?? "—"}</strong></div>
          <div class="setting-row"><span>Preisbeobachtungen</span><strong>${meta?.counts?.price_observations ?? "—"}</strong></div>
        </div>
        <button id="checkBackendBtn" class="ghost-btn">Backend neu prüfen</button>
      </section>

      <section class="settings-card">
        <span class="section-kicker">Schreibzugriff</span>
        <h3>WRITE_TOKEN lokal speichern</h3>
        <p class="settings-note">Das Secret wird nur im Browser dieses Geräts gespeichert und ausschließlich bei geschützten Schreibaktionen als Header an deinen Worker gesendet. Es steht nicht im Netlify-/GitHub-Code.</p>
        <div class="token-row">
          <input id="writeTokenInput" type="password" autocomplete="off" placeholder="WRITE_TOKEN einfügen" value="">
          <button id="saveTokenBtn" class="primary-btn">Token speichern</button>
          <button id="clearTokenBtn" class="ghost-btn">Token löschen</button>
        </div>
        <div class="token-state ${API?.hasToken() ? "ready" : "missing"}">${API?.hasToken() ? "WRITE_TOKEN ist auf diesem Gerät gespeichert." : "Noch kein WRITE_TOKEN auf diesem Gerät gespeichert."}</div>
      </section>

      <section class="settings-card">
        <span class="section-kicker">Datenmodus v0.4.0</span>
        <h3>Backend + lokaler Preis-Fallback</h3>
        <p class="settings-note">Produkte und Beobachtungsstatus kommen bereits aus D1. Solange D1 noch keine automatischen Händlerpreise enthält, bleiben die verifizierten Preisstände aus v0.3.1 sichtbar. Sobald D1 Preisbeobachtungen liefert, werden diese für den jeweiligen Händler übernommen.</p>
      </section>`;

    document.getElementById("checkBackendBtn")?.addEventListener("click",()=>syncBackend(true));
    document.getElementById("saveTokenBtn")?.addEventListener("click",()=>{
      const value = document.getElementById("writeTokenInput")?.value || "";
      if(!value.trim()){ showToast("WRITE_TOKEN fehlt."); return; }
      API.setToken(value);
      renderSettings();
      showToast("WRITE_TOKEN nur auf diesem Gerät gespeichert.");
    });
    document.getElementById("clearTokenBtn")?.addEventListener("click",()=>{
      API.clearToken();
      renderSettings();
      showToast("Lokaler WRITE_TOKEN gelöscht.");
    });
  }

  function bindAlarmInputs(){
    document.querySelectorAll("[data-alarm]").forEach(input=>input.addEventListener("change",async()=>{
      const raw=input.value.trim();
      const value = raw === "" ? null : Number(raw);
      const id = input.dataset.alarm;
      setAlarm(id,value);
      const backendId = backendIdForLocal(id);
      if(state.backend.connected && backendId){
        if(!API.hasToken()){
          renderAll();
          showToast("Preiswecker lokal gespeichert. Für D1-Sync WRITE_TOKEN unter Einstellungen speichern.");
          return;
        }
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
    document.getElementById("marketCount").textContent=DATA.markets.length;
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

  document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    tab.classList.add("active");
    state.currentView=tab.dataset.view;
    const viewMap={overview:els.overview,comparison:els.comparison,search:els.searchView,alerts:els.alerts,settings:els.settingsView};
    viewMap[state.currentView].classList.add("active");
  }));

  els.search.addEventListener("input",renderAll);
  els.filter.addEventListener("change",renderAll);
  els.refresh.addEventListener("click",async()=>{
    await syncBackend(true);
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

  rebuildFilter();
  renderAll();
  syncBackend(false);

  if("serviceWorker" in navigator){ navigator.serviceWorker.register("service-worker.js").catch(()=>{}); }
})();
