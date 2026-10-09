(() => {
  const DATA = window.PREISSCAN_DATA;
  const USER_TOKEN_KEY = "preisscan.userToken.v1";
  const BASE_URL = String(DATA?.app?.apiBase || "").replace(/\/+$/, "");

  function getUserToken(){
    return localStorage.getItem(USER_TOKEN_KEY) || "";
  }

  function hasUserToken(){
    return Boolean(getUserToken());
  }

  function setUserToken(value){
    const token = String(value || "").trim();
    if(token) localStorage.setItem(USER_TOKEN_KEY, token);
    else localStorage.removeItem(USER_TOKEN_KEY);
  }

  async function request(path, options={}){
    if(!BASE_URL) throw new Error("API-Adresse fehlt.");

    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 12000;
    const timeout = setTimeout(()=>controller.abort(), timeoutMs);

    const headers = {
      "Accept":"application/json",
      ...(options.headers || {})
    };

    if(options.body !== undefined){
      headers["Content-Type"] = "application/json";
    }

    const token = getUserToken();

    if(token && options.auth !== false){
      headers["X-Preisscan-User"] = token;
    }

    try{
      const response = await fetch(`${BASE_URL}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: "no-store"
      });

      let data = null;
      try{
        data = await response.json();
      }catch{
        data = null;
      }

      if(!response.ok){
        const message = data?.error || `API-Fehler ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.payload = data;
        throw err;
      }

      return data;

    }catch(error){
      if(error?.name === "AbortError"){
        throw new Error("Backend antwortet nicht rechtzeitig.");
      }
      throw error;

    }finally{
      clearTimeout(timeout);
    }
  }

  async function ensureSession(){
    if(hasUserToken()){
      try{
        const me = await request("/api/me");
        return {
          token:getUserToken(),
          user:me?.user || null,
          created:false
        };
      }catch(error){
        if(error?.status !== 401) throw error;
        setUserToken("");
      }
    }

    const created = await request("/api/users", {
      method:"POST",
      auth:false
    });

    const token = String(created?.user_token || "").trim();

    if(!token){
      throw new Error("Backend hat keine Nutzerkennung geliefert.");
    }

    setUserToken(token);

    const me = await request("/api/me");

    return {
      token,
      user:me?.user || null,
      created:true
    };
  }

  async function userRequest(path, options={}){
    await ensureSession();
    return request(path, options);
  }

  async function openFoodFactsProduct(gtin){
    const code = String(gtin || "").replace(/\D/g, "");

    if(![8,12,13,14].includes(code.length)){
      throw new Error("Ungültige EAN/GTIN.");
    }

    const fields = [
      "code",
      "product_name",
      "product_name_de",
      "generic_name_de",
      "brands",
      "quantity",
      "product_quantity",
      "product_quantity_unit",
      "image_front_small_url",
      "image_front_url"
    ].join(",");

    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 12000);

    try{
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(fields)}&lc=de`,
        {
          headers:{"Accept":"application/json"},
          signal:controller.signal,
          cache:"no-store"
        }
      );

      if(!response.ok){
        throw new Error(`Produktdatenbank antwortet mit ${response.status}.`);
      }

      const data = await response.json();

      return {
        found:data?.status === 1 && Boolean(data?.product),
        code,
        product:data?.product || null
      };

    }catch(error){
      if(error?.name === "AbortError"){
        throw new Error("Produktdatenbank antwortet nicht rechtzeitig.");
      }
      throw error;

    }finally{
      clearTimeout(timeout);
    }
  }

  window.PREISSCAN_API = {
    baseUrl: BASE_URL,

    getUserToken,
    hasUserToken,
    ensureSession,

    health: ()=>request("/api/health", {auth:false}),
    meta: ()=>request("/api/meta", {auth:false}),
    retailers: ()=>request("/api/retailers", {auth:false}),
    products: (q="")=>request(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`, {auth:false}),
    product: id=>request(`/api/products/${encodeURIComponent(id)}`, {auth:false}),
    byGtin: gtin=>request(`/api/products/by-gtin/${encodeURIComponent(gtin)}`, {auth:false}),

    me: ()=>userRequest("/api/me"),
    tracked: ()=>userRequest("/api/me/tracked"),
    retailerPreferences: ()=>userRequest("/api/me/retailers"),
    setRetailerPreference: (id,enabled)=>userRequest(
      `/api/me/retailers/${encodeURIComponent(id)}`,
      {method:"PUT", body:{enabled:Boolean(enabled)}}
    ),
    setAllRetailers: enabled=>userRequest(
      "/api/me/retailers",
      {method:"PUT", body:{enabled:Boolean(enabled)}}
    ),

    lookupPrices: (gtin,postcode=null,productId=null,extra={})=>userRequest(
      "/api/me/prices/lookup",
      {
        method:"POST",
        body:{gtin,postcode,product_id:productId,...extra},
        timeoutMs:20000
      }
    ),

    scanTrackedPrices: postcode=>userRequest(
      "/api/me/prices/scan",
      {
        method:"POST",
        body:{postcode},
        timeoutMs:30000
      }
    ),

    openFoodFactsProduct,

    ensureProduct: body=>userRequest(
      "/api/me/products/ensure",
      {method:"POST", body}
    ),

    trackProduct: (id,targetPriceCents)=>userRequest(
      `/api/me/tracked/${encodeURIComponent(id)}`,
      {
        method:"POST",
        body:{target_price_cents:targetPriceCents}
      }
    ),

    untrackProduct: id=>userRequest(
      `/api/me/tracked/${encodeURIComponent(id)}`,
      {method:"DELETE"}
    ),

    setTarget: (id,targetPriceCents)=>userRequest(
      `/api/me/tracked/${encodeURIComponent(id)}/target`,
      {
        method:"PUT",
        body:{target_price_cents:targetPriceCents}
      }
    ),

    setGtin: (id,gtin)=>userRequest(
      `/api/me/products/${encodeURIComponent(id)}/gtin`,
      {
        method:"PUT",
        body:{gtin}
      }
    )
  };
})();
