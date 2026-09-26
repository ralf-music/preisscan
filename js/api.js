(() => {
  const DATA = window.PREISSCAN_DATA;
  const USER_TOKEN_KEY = "preisscan.userToken.v1";
  const BASE_URL = String(DATA?.app?.apiBase || "").replace(/\/+$/, "");

  function getUserToken(){ return localStorage.getItem(USER_TOKEN_KEY) || ""; }
  function hasUserToken(){ return Boolean(getUserToken()); }
  function setUserToken(value){
    const token = String(value || "").trim();
    if(token) localStorage.setItem(USER_TOKEN_KEY, token);
    else localStorage.removeItem(USER_TOKEN_KEY);
  }

  async function request(path, options={}){
    if(!BASE_URL) throw new Error("API-Adresse fehlt.");
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 12000);
    const headers = {"Accept":"application/json", ...(options.headers || {})};
    if(options.body !== undefined) headers["Content-Type"] = "application/json";

    const token = getUserToken();
    if(token && options.auth !== false) headers["Authorization"] = `Bearer ${token}`;

    try{
      const response = await fetch(`${BASE_URL}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: "no-store"
      });
      let data = null;
      try{ data = await response.json(); }catch{ data = null; }
      if(!response.ok){
        const message = data?.error || `API-Fehler ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.payload = data;
        throw err;
      }
      return data;
    }catch(error){
      if(error?.name === "AbortError") throw new Error("Backend antwortet nicht rechtzeitig.");
      throw error;
    }finally{
      clearTimeout(timeout);
    }
  }

  async function ensureSession(){
    if(hasUserToken()){
      try{
        const session = await request("/api/session");
        return {token:getUserToken(), user:session.user, created:false};
      }catch(error){
        if(error?.status !== 401) throw error;
        localStorage.removeItem(USER_TOKEN_KEY);
      }
    }

    const created = await request("/api/session", {method:"POST", auth:false});
    if(!created?.token) throw new Error("Backend hat keine Nutzerkennung geliefert.");
    setUserToken(created.token);
    return {token:created.token, user:created.user, created:true};
  }

  async function userRequest(path, options={}){
    await ensureSession();
    return request(path, options);
  }

  async function openFoodFactsProduct(gtin){
    const code = String(gtin || "").replace(/\D/g, "");
    if(![8,12,13,14].includes(code.length)) throw new Error("Ungültige EAN/GTIN.");
    const fields = [
      "code","product_name","product_name_de","generic_name_de","brands","quantity",
      "product_quantity","product_quantity_unit","image_front_small_url","image_front_url"
    ].join(",");
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 12000);
    try{
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(fields)}&lc=de`,
        {headers:{"Accept":"application/json"}, signal:controller.signal, cache:"no-store"}
      );
      if(!response.ok) throw new Error(`Produktdatenbank antwortet mit ${response.status}.`);
      const data = await response.json();
      return {found:data?.status === 1 && Boolean(data?.product), code, product:data?.product || null};
    }catch(error){
      if(error?.name === "AbortError") throw new Error("Produktdatenbank antwortet nicht rechtzeitig.");
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
    health: ()=>request("/api/health"),
    meta: ()=>request("/api/meta"),
    retailers: ()=>request("/api/retailers"),
    products: (q="")=>request(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    product: id=>request(`/api/products/${encodeURIComponent(id)}`),
    byGtin: gtin=>request(`/api/products/by-gtin/${encodeURIComponent(gtin)}`),
    openFoodFactsProduct,
    ensureProduct: body=>userRequest("/api/products/ensure",{method:"POST",body}),
    trackProduct: (id,targetPriceCents)=>userRequest(`/api/tracked/${encodeURIComponent(id)}`,{method:"POST",body:{target_price_cents:targetPriceCents}}),
    untrackProduct: id=>userRequest(`/api/tracked/${encodeURIComponent(id)}`,{method:"DELETE"}),
    setTarget: (id,targetPriceCents)=>userRequest(`/api/tracked/${encodeURIComponent(id)}/target`,{method:"PUT",body:{target_price_cents:targetPriceCents}}),
    setGtin: (id,gtin)=>userRequest(`/api/products/${encodeURIComponent(id)}/gtin`,{method:"PUT",body:{gtin}})
  };
})();
