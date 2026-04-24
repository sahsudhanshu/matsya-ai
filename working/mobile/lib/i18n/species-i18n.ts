/**
 * Fish species and disease name translations.
 * Data sourced from FishNameTranslations.csv and DiseaseNameTranslations.csv.
 * For English locale the original label is returned unchanged.
 */
import type { Locale } from "./types";

type LangMap = { hi: string; bn: string; ta: string; te: string; mr: string };

// ── Fish / Species name translations ─────────────────────────────────────────

const FISH_TRANSLATIONS: Record<string, LangMap> = {
  Bangus: {
    hi: "दूधिया मछली (Dudhiya)",
    bn: "মিল্কফিশ / বাটা (Milkfish/Bata)",
    ta: "பால் கெண்டை (Paal Kendai)",
    te: "పాలు చేప (Paalu Chepa)",
    mr: "दुधी मासा (Dudhi Masa)",
  },
  "Big Head Carp": {
    hi: "बिग हेड कार्प (Big Head Carp)",
    bn: "বিগহেড কার্প (Bighead Carp)",
    ta: "பிக் ஹெட் கெண்டை (Big Head Kendai)",
    te: "బిగ్ హెడ్ కార్ప్ (Big Head Carp)",
    mr: "बिग हेड कार्प (Big Head Carp)",
  },
  "Black Spotted Barb": {
    hi: "पुठिया (Puthiya)",
    bn: "তিতপুঁটি (Tit Punti)",
    ta: "கரும்புள்ளி கெண்டை (Karumpulli Kendai)",
    te: "మచ్చల పరిగె (Macchala Parige)",
    mr: "खवली (Khavali)",
  },
  Catfish: {
    hi: "मांगुर (Magur)",
    bn: "মাগুর (Magur) / শিং (Shing)",
    ta: "கெளுத்தி (Keluthi)",
    te: "జెల్ల (Jella) / మార్పు (Marpu)",
    mr: "शिंगटी (Shingati)",
  },
  "Climbing Perch": {
    hi: "कवई (Kawai)",
    bn: "কই (Koi)",
    ta: "பனையேறி கெண்டை (Panayeri Kendai)",
    te: "గిరక చేప (Giraka Chepa)",
    mr: "खजुरा (Khajura) / चडखा",
  },
  "Fourfinger Threadfin": {
    hi: "रावस (Rawas)",
    bn: "গুরজালি (Gurjali)",
    ta: "காலா (Kaala)",
    te: "మగ (Maga)",
    mr: "रावस (Rawas)",
  },
  "Freshwater Eel": {
    hi: "बाम (Baam)",
    bn: "বাইম (Baim)",
    ta: "விலாங்கு மீன் (Vilangu Meen)",
    te: "మలుగు (Malugu) / పాము చేప",
    mr: "वाम (Vam)",
  },
  "Glass Perchlet": {
    hi: "चंदा (Chanda)",
    bn: "চাঁদা (Chanda)",
    ta: "கண்ணாடி மீன் (Kannadi Meen)",
    te: "అద్దపు చేప (Addapu Chepa)",
    mr: "काच मासा (Kaach Masa)",
  },
  Goby: {
    hi: "गोबी (Goby)",
    bn: "বেলে (Bele)",
    ta: "உளுவை (Uluvai)",
    te: "ఇసుక దొందు (Isuka Dondu)",
    mr: "गोबी (Gobi) / खर्वा",
  },
  "Gold Fish": {
    hi: "सुनहरी मछली (Sunahari)",
    bn: "গোল্ডফিশ (Goldfish)",
    ta: "தங்க மீன் (Thanga Meen)",
    te: "గోల్డ్ ఫిష్ (Gold Fish)",
    mr: "गोल्डफिश (Goldfish)",
  },
  Gourami: {
    hi: "गौरामी (Gourami)",
    bn: "খলিসা (Kholisa)",
    ta: "கௌராமி (Gourami)",
    te: "గౌరామి (Gourami)",
    mr: "गौरामी (Gourami)",
  },
  "Grass Carp": {
    hi: "ग्रास कार्प (Grass Carp)",
    bn: "গ্রাস কার্প (Grass Carp)",
    ta: "புல் கெண்டை (Pul Kendai)",
    te: "గడ్డి చేప (Gaddi Chepa)",
    mr: "ग्रास कार्प (Grass Carp)",
  },
  "Green Spotted Puffer": {
    hi: "पफर फिश (Puffer Fish)",
    bn: "টেপা মাছ (Tepa Mach) / পটকা",
    ta: "பேத்தை (Pethai)",
    te: "కప్ప చేప (Kappa Chepa)",
    mr: "फुग्या (Fugya)",
  },
  "Indian Carp": {
    hi: "रोहू / कतला (Rohu / Catla)",
    bn: "রুই / কাতলা (Rui / Katla)",
    ta: "ரோகு / கட்லா (Rohu / Catla)",
    te: "బొచ్చె / రవ్వు (Bocche / Ravvu)",
    mr: "रोहू (Rohu)",
  },
  "Indo-Pacific Tarpon": {
    hi: "टारपॉन (Tarpon)",
    bn: "পান (Paan)",
    ta: "மொரங்கோ (Morangho)",
    te: "వలగ (Valaga)",
    mr: "तारपोन (Tarpon)",
  },
  "Jaguar Guapote": {
    hi: "जगुआर सिच्लिड (Jaguar Cichlid)",
    bn: "জাগুয়ার সিচলিড (Jaguar)",
    ta: "ஜாகுவார் சிச்லிட் (Jaguar)",
    te: "జాగ్వార్ సిచ్లిడ్ (Jaguar)",
    mr: "जगुआर सिच्लिड (Jaguar)",
  },
  "Janitor Fish": {
    hi: "सकर फिश (Sucker Fish)",
    bn: "সাকার মাছ (Sucker Mach)",
    ta: "சக்கர் மீன் (Sucker Meen)",
    te: "క్లీనర్ చేప (Cleaner Chepa)",
    mr: "सकर मासा (Sucker Masa)",
  },
  Knifefish: {
    hi: "चीतल (Chital) / मोय (Moy)",
    bn: "চিতল (Chital) / ফলি (Foli)",
    ta: "அம்புட்டன் கத்தி (Ambuttan Kathi)",
    te: "నైఫ్ ఫిష్ (Knife Fish)",
    mr: "चालत (Chalat)",
  },
  "Long-Snouted Pipefish": {
    hi: "पाइपफिश (Pipefish)",
    bn: "পাইপফিশ (Pipefish)",
    ta: "குழல் மீன் (Kuzhal Meen)",
    te: "పైప్ ఫిష్ (Pipe Fish)",
    mr: "पाईपफिश (Pipefish)",
  },
  "Mosquito Fish": {
    hi: "मच्छर मछली (Macchar Machli)",
    bn: "মশা মাছ (Mosha Mach)",
    ta: "கொசு மீன் (Kosu Meen)",
    te: "దోమ చేప (Doma Chepa)",
    mr: "डास मासा (Daas Masa)",
  },
  Mudfish: {
    hi: "शोल (Shol) / मरल (Murrel)",
    bn: "শোল (Shol)",
    ta: "விரால் (Viraal)",
    te: "కొర్రమీను (Korramenu)",
    mr: "मरळ (Maral)",
  },
  Mullet: {
    hi: "बोई (Boi)",
    bn: "পারশে (Parshe)",
    ta: "மடவை (Madavai)",
    te: "కతవల (Kathavala)",
    mr: "बोई (Boi)",
  },
  Pangasius: {
    hi: "बासा (Basa) / पंगास",
    bn: "পাঙ্গাস (Pangas) / বাসা (Basa)",
    ta: "பாசா (Basa)",
    te: "బాసా (Basa)",
    mr: "पांगशियस (Pangasius) / बासा",
  },
  Perch: {
    hi: "पर्च (Perch) / भेतकी",
    bn: "ভেটকি (Bhetki)",
    ta: "கொடுவா (Koduva)",
    te: "పండుగప్ప (Pandugappa)",
    mr: "पर्च (Perch) / जिती (Jiti)",
  },
  "Scat Fish": {
    hi: "स्कैट (Scat)",
    bn: "চিত্রা (Chitra)",
    ta: "இலத்தி (Ilathi)",
    te: "స్కాట్ (Scat)",
    mr: "खवली (Khavali) / स्कॅट",
  },
  "Silver Barb": {
    hi: "सिल्वर बार्ब (Silver Barb)",
    bn: "সরপুঁটি (Shorpunti)",
    ta: "வெள்ளி கெண்டை (Velli Kendai)",
    te: "వెండి పరిగె (Vendi Parige)",
    mr: "चंदेरी खवली (Chanderi Khavali)",
  },
  "Silver Carp": {
    hi: "सिल्वर कार्प (Silver Carp)",
    bn: "সিলভার কার্প (Silver Carp)",
    ta: "சில்வர் கெண்டை (Silver Kendai)",
    te: "సిల్వర్ కార్ప్ (Silver Carp)",
    mr: "सिल्वर कार्प (Silver Carp)",
  },
  "Silver Perch": {
    hi: "सिल्वर पर्च (Silver Perch)",
    bn: "রূপালী ভেটকি (Rupali Bhetki)",
    ta: "சில்வர் பெர்ச் (Silver Perch)",
    te: "వెండి పండుగప్ప (Vendi Pandugappa)",
    mr: "सिल्वर पर्च (Silver Perch)",
  },
  Snakehead: {
    hi: "मरल (Murrel)",
    bn: "টাকি (Taki) / গজার (Gojar)",
    ta: "விரால் (Viraal)",
    te: "కొర్రమీను (Korramenu)",
    mr: "मरळ (Maral)",
  },
  Tenpounder: {
    hi: "लेडीफिश (Ladyfish)",
    bn: "বাইলে (Baile)",
    ta: "கிழங்கான் (Kizhangan)",
    te: "కిళ్ళంగి (Killangi)",
    mr: "लेडीफिश (Ladyfish)",
  },
  Tilapia: {
    hi: "तिलापिया (Tilapia)",
    bn: "তেলাপিয়া (Telapia)",
    ta: "ஜிலேபி கெண்டை (Jilebi Kendai)",
    te: "జిలేబి చేప (Jilebi Chepa)",
    mr: "चिलापी (Chilapi)",
  },
};

// ── Disease name translations ─────────────────────────────────────────────────

const DISEASE_TRANSLATIONS: Record<string, LangMap> = {
  "Bacterial Red disease": {
    hi: "बैक्टीरियल रेड रोग (Bacterial Red Rog)",
    bn: "ব্যাকটেরিয়াল লাল রোগ (Bacterial Lal Rog)",
    ta: "பாக்டீரியல் சிவப்பு நோய் (Bacterial Sivappu Noi)",
    te: "బాక్టీరియల్ ఎరుపు వ్యాధి (Bacterial Erupu Vyadhi)",
    mr: "जिवाणूजन्य लाल रोग (Jivanujanya Lal Rog)",
  },
  Aeromoniasis: {
    hi: "एरोमोनियासिस (Aeromoniasis)",
    bn: "অ্যারোমোনিয়াসিস (Aeromoniasis)",
    ta: "ஏரோமோனியாசிஸ் (Aeromoniasis)",
    te: "ఏరోమోనియాసిస్ (Aeromoniasis)",
    mr: "एरोमोनियासिस (Aeromoniasis)",
  },
  "Bacterial Gill Disease": {
    hi: "बैक्टीरियल गिल रोग (Bacterial Gill Rog)",
    bn: "ব্যাকটেরিয়াল ফুলকা রোগ (Bacterial Phulka Rog)",
    ta: "பாக்டீரியல் செவுள் நோய் (Bacterial Sevul Noi)",
    te: "బాక్టీరియల్ మొప్పల వ్యాధి (Bacterial Moppala Vyadhi)",
    mr: "जिवाणूजन्य कल्ले रोग (Jivanujanya Kalle Rog)",
  },
  Saprolegniasis: {
    hi: "सैप्रोलेग्नियासिस (Saprolegniasis)",
    bn: "স্যাপ্রোলেগনিয়াসিস (Saprolegniasis)",
    ta: "சப்ரோலெக்னியாசிஸ் (Saprolegniasis)",
    te: "సాప్రోలెగ్నియాసిస్ (Saprolegniasis)",
    mr: "सॅप्रोलिग्नियासिस (Saprolegniasis)",
  },
  "Healthy Fish": {
    hi: "स्वस्थ मछली (Swasth Machli)",
    bn: "সুস্থ মাছ (Sustho Mach)",
    ta: "ஆரோக்கியமான மீன் (Arokkiyamaana Meen)",
    te: "ఆరోగ్యకరమైన చేప (Arogyakaramaina Chepa)",
    mr: "निरोगी मासा (Nirogi Masa)",
  },
  "Parasitic Disease": {
    hi: "परजीवी रोग (Parajeevi Rog)",
    bn: "পরজীবী রোগ (Porojibi Rog)",
    ta: "ஒட்டுண்ணி நோய் (Ottunni Noi)",
    te: "పరాన్నజీవి వ్యాధి (Parannajeevi Vyadhi)",
    mr: "परजीवी रोग (Parajivi Rog)",
  },
  "White Tail Disease": {
    hi: "सफेद पूंछ रोग (Safed Poonch Rog)",
    bn: "সাদা লেজ রোগ (Sada Lej Rog)",
    ta: "வெள்ளை வால் நோய் (Vellai Vaal Noi)",
    te: "తెలుపు తోక వ్యాధి (Telupu Toka Vyadhi)",
    mr: "पांढरी शेपूट रोग (Pandhari Sheput Rog)",
  },
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Case-insensitive lookup in a translation map.
 * Returns the translation map entry for the given English name, or null.
 */
function findEntry(map: Record<string, LangMap>, name: string): LangMap | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const key of Object.keys(map)) {
    if (key.toLowerCase() === lower) return map[key];
  }
  return null;
}

/**
 * Returns the localised fish / species name.
 * Falls back to the original English label for unknown names or English locale.
 */
export function translateFishName(name: string, locale: Locale): string {
  if (!name || locale === "en") return name;
  const entry = findEntry(FISH_TRANSLATIONS, name);
  return entry?.[locale as keyof LangMap] ?? name;
}

/**
 * Returns the localised disease name.
 * Falls back to the original English label for unknown diseases or English locale.
 */
export function translateDiseaseName(name: string, locale: Locale): string {
  if (!name || locale === "en") return name;
  const entry = findEntry(DISEASE_TRANSLATIONS, name);
  return entry?.[locale as keyof LangMap] ?? name;
}
