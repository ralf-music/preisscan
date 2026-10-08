window.PREISSCAN_DATA = {
  app: {
    name: "Einkaufshilfe",
    technicalName: "preisscan",
    version: "0.8.3",
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
      marketStates:{
        lidl:{
          status:"price",
          checked:"2026-09-24T11:06:00+02:00",
          source:"Vor-Ort-Preisschild",
          prices:[
            {type:"regular", value:1.19, label:"Regulär"},
            {type:"app", value:0.99, label:"Lidl Plus", requirement:"Lidl Plus App"}
          ]
        },
        norma:{
          status:"price",
          checked:"2026-09-25T22:19:00+02:00",
          source:"NORMA Wochenangebot",
          validFrom:"2026-09-21",
          validUntil:"2026-09-27",
          prices:[
            {type:"offer", value:0.99, label:"Angebot"}
          ],
          note:"Angebot wird gemäß Projektregel auch für Coca-Cola Zero derselben Größe übernommen."
        },
        edeka:{
          status:"price",
          checked:"2026-09-25T22:35:00+02:00",
          source:"kaufDA Mannheim · EDEKA-Angebot",
          prices:[{type:"offer", value:1.11, label:"Angebot"}],
          note:"1,25-l-Angebot aus dem regionalen Mannheimer Angebotsvergleich; Filialabweichungen möglich."
        },
        netto:{
          status:"price",
          checked:"2026-09-25T22:35:00+02:00",
          source:"kaufDA Mannheim · Netto Marken-Discount",
          prices:[{type:"offer", value:1.59, label:"Angebot ab"}],
          note:"1,25-l-Zuordnung über den ausgewiesenen Grundpreis 1,27 €/l; regionale Abweichungen möglich."
        }
      }
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
      marketStates:{
        penny:{
          status:"price",
          checked:"2026-09-25T22:35:00+02:00",
          source:"kaufDA Mannheim · PENNY-Angebot",
          prices:[{type:"offer", value:1.29, label:"Angebot"}],
          note:"1,5-l-Zuordnung über den ausgewiesenen Grundpreis 0,86 €/l; regionale Abweichungen möglich."
        }
      }
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
      marketStates:{
        lidl:{status:"na", checked:null},
        aldi:{status:"na", checked:null}
      }
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

  futureOffers: [
    {
      productId:"coke125",
      marketId:"netto",
      price:5.99 / 6,
      validFrom:"2026-10-05",
      validUntil:"2026-10-10",
      type:"offer",
      matchType:"family",
      requirement:"Nur beim Kauf eines 6er-Packs",
      source:"Netto Wochenangebot 05.10.–10.10.2026",
      note:"Coca-Cola 6 × 1,25 l für 5,99 €. Umgerechnet ca. 1,00 € je Flasche. Gemäß Projektregel wird ein gemeinsames Coca-Cola-Sortenangebot für Zero derselben Größe übernommen, sofern keine Ausnahme ausgewiesen ist."
    },
    {
      productId:"monster-rossi",
      marketId:"norma",
      price:0.88,
      validFrom:"2026-09-28",
      validUntil:"2026-10-03",
      type:"offer",
      matchType:"family",
      source:"NORMA Wochenangebot ab 28.09.",
      note:"Monster Energy 0,5 l, verschiedene Sorten. Für VR46/The Doctor gilt der Preis nur, wenn die Sorte in der Filiale Teil des Angebots bzw. geführt ist."
    }
  ]
};
