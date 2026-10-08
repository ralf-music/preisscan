window.PREISSCAN_DATA = {
  app: {
    name: "Einkaufshilfe",
    technicalName: "preisscan",
    version: "0.10.0",
    apiBase: "https://preisscan-api.ralf-music.workers.dev"
  },

  markets: [
    { id:"lidl", name:"Lidl", area:"Mannheim / Umgebung", brand:"lidl" },
    { id:"aldi", name:"ALDI Süd", area:"Mannheim / Umgebung", brand:"aldi" },
    { id:"penny", name:"PENNY", area:"Mannheim / Umgebung", brand:"penny" },
    { id:"netto", name:"Netto", area:"Mannheim / Umgebung", brand:"netto" },
    { id:"rewe", name:"REWE", area:"Mannheim / Umgebung", brand:"rewe" },
    { id:"norma", name:"NORMA", branch:"Mannheim 68307", area:"68307 Mannheim", brand:"norma" },
    { id:"edeka", name:"EDEKA", area:"Mannheim / Umgebung", brand:"edeka" },
    { id:"globus", name:"GLOBUS", area:"Region Mannheim", brand:"globus" },
    { id:"marktkauf", name:"Marktkauf", area:"Region Mannheim", brand:"marktkauf" },
    { id:"kaufland", name:"Kaufland", area:"Mannheim / Umgebung", brand:"kaufland" },
    { id:"scheck-bruehl", name:"Scheck-in Center", branch:"Brühl", area:"68782 Brühl", brand:"scheckin" },
    { id:"mk-wohl", name:"Marktkauf", branch:"Scheck-in Mannheim-Wohlgelegen", area:"Mannheim-Wohlgelegen", brand:"marktkauf" },
    { id:"mk-neck", name:"Marktkauf", branch:"Scheck-in Mannheim-Neckarau", area:"Mannheim-Neckarau", brand:"marktkauf" }
  ],

  products: [
    {
      id:"coke125",
      family:"coca-cola-zero",
      promotionFamily:"coca-cola-cola",
      name:"Coca-Cola Zero Sugar",
      size:"1,25 l",
      packageType:"PET-Einwegflasche",
      unitType:"volume",
      amount:1.25,
      unit:"l",
      ean:null,
      image:"https://www.dropwinkel.eu/media/cache/gallery_zoom/product/3130/coca-cola-zero-pet-12-x-125-liter.jpg",
      imageLabel:"Coca-Cola Zero 1,25 l",
      defaultAlarm:1.00,
      marketStates:{}
    },
    {
      id:"coke150",
      family:"coca-cola-zero",
      promotionFamily:"coca-cola-cola",
      name:"Coca-Cola Zero Sugar",
      size:"1,5 l",
      packageType:"PET-Flasche",
      unitType:"volume",
      amount:1.5,
      unit:"l",
      ean:null,
      image:"https://d17zv3ray5yxvp.cloudfront.net/variants/PUA9MBF1UekggKmvFrnXFChQ/51b8aa181ad15015651703a4356668224748770ff8b1ba318f5b3051f549af07",
      imageLabel:"Coca-Cola Zero 1,5 l",
      defaultAlarm:null,
      marketStates:{}
    },
    {
      id:"monster-rossi",
      family:"monster-rossi",
      name:"Monster Energy VR46 Rossi Edition",
      size:"0,5 l Dose",
      packageType:"Dose",
      unitType:"volume",
      amount:0.5,
      unit:"l",
      ean:null,
      image:"https://idrinks.cdn.shoprenter.hu/custom/idrinks/image/data/product/idrinks-monster-the-doctor-05.webp?lastmod=1727158360.1767191236",
      imageLabel:"Monster Energy Rossi Edition 0,5 l",
      defaultAlarm:null,
      marketStates:{}
    }
  ],

  catalog: [
    {id:"coke033-can", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"0,33 l", packageType:"Dose", unitType:"volume", amount:0.33, unit:"l", ean:null, image:"https://www.coca-cola.com/content/dam/onexp/de/de/home-images/coca-cola-zero-sugar/5000112552195.png"},
    {id:"coke050", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"0,5 l", packageType:"Flasche", unitType:"volume", amount:0.5, unit:"l", ean:null, image:"https://www.coca-cola.com/content/dam/onexp/de/de/home-images/coca-cola-zero-sugar/5000112552195.png"},
    {id:"coke085", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"0,85 l", packageType:"PET-Einwegflasche", unitType:"volume", amount:0.85, unit:"l", ean:null, image:"https://www.coca-cola.com/content/dam/onexp/de/de/home-images/coca-cola-zero-sugar/5000112552195.png"},
    {id:"coke100", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"1,0 l", packageType:"Mehrwegflasche", unitType:"volume", amount:1, unit:"l", ean:null, image:"https://www.coca-cola.com/content/dam/onexp/de/de/home-images/coca-cola-zero-sugar/5000112552195.png"},
    {id:"coke125", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"1,25 l", packageType:"PET-Einwegflasche", unitType:"volume", amount:1.25, unit:"l", ean:null, image:"https://www.dropwinkel.eu/media/cache/gallery_zoom/product/3130/coca-cola-zero-pet-12-x-125-liter.jpg"},
    {id:"coke150", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"1,5 l", packageType:"PET-Flasche", unitType:"volume", amount:1.5, unit:"l", ean:null, image:"https://d17zv3ray5yxvp.cloudfront.net/variants/PUA9MBF1UekggKmvFrnXFChQ/51b8aa181ad15015651703a4356668224748770ff8b1ba318f5b3051f549af07"},
    {id:"coke200", family:"coca-cola-zero", promotionFamily:"coca-cola-cola", searchTerms:["coca cola zero","coca-cola zero","coke zero"], name:"Coca-Cola Zero Sugar", size:"2,0 l", packageType:"PET-Einwegflasche", unitType:"volume", amount:2, unit:"l", ean:null, image:"https://www.coca-cola.com/content/dam/onexp/de/de/home-images/coca-cola-zero-sugar/5000112552195.png"},
    {id:"monster-rossi", family:"monster-rossi", searchTerms:["monster rossi","monster energy rossi","vr46"], name:"Monster Energy VR46 Rossi Edition", size:"0,5 l", packageType:"Dose", unitType:"volume", amount:0.5, unit:"l", ean:null, image:"https://idrinks.cdn.shoprenter.hu/custom/idrinks/image/data/product/idrinks-monster-the-doctor-05.webp?lastmod=1727158360.1767191236"},

    {id:"hack-mix-250", family:"hackfleisch-gemischt", searchTerms:["gemischtes hackfleisch","hackfleisch gemischt","hack gemischt"], name:"Gemischtes Hackfleisch", size:"250 g", packageType:"Packung", unitType:"weight", amount:250, unit:"g", ean:null},
    {id:"hack-mix-400", family:"hackfleisch-gemischt", searchTerms:["gemischtes hackfleisch","hackfleisch gemischt","hack gemischt"], name:"Gemischtes Hackfleisch", size:"400 g", packageType:"Packung", unitType:"weight", amount:400, unit:"g", ean:null},
    {id:"hack-mix-500", family:"hackfleisch-gemischt", searchTerms:["gemischtes hackfleisch","hackfleisch gemischt","hack gemischt"], name:"Gemischtes Hackfleisch", size:"500 g", packageType:"Packung", unitType:"weight", amount:500, unit:"g", ean:null},
    {id:"hack-mix-600", family:"hackfleisch-gemischt", searchTerms:["gemischtes hackfleisch","hackfleisch gemischt","hack gemischt"], name:"Gemischtes Hackfleisch", size:"600 g", packageType:"Packung", unitType:"weight", amount:600, unit:"g", ean:null},
    {id:"hack-mix-800", family:"hackfleisch-gemischt", searchTerms:["gemischtes hackfleisch","hackfleisch gemischt","hack gemischt"], name:"Gemischtes Hackfleisch", size:"800 g", packageType:"Packung", unitType:"weight", amount:800, unit:"g", ean:null},
    {id:"hack-mix-1000", family:"hackfleisch-gemischt", searchTerms:["gemischtes hackfleisch","hackfleisch gemischt","hack gemischt"], name:"Gemischtes Hackfleisch", size:"1000 g", packageType:"Packung", unitType:"weight", amount:1000, unit:"g", ean:null}
  ],

  offerMatchingRules: [
    {
      family:"coca-cola-cola",
      description:"Coca-Cola Classic und Zero derselben Größe werden bei gemeinsamen Händlerangeboten standardmäßig gleich bepreist. Abweichungen können später gezielt überschrieben werden."
    }
  ],

  futureOffers: []
};
