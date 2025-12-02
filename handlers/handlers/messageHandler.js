import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { forwardOrderToAll } from '../utils/orderForwarding.js';
import CONFIG from '../config.js';
import fs from 'fs';import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { forwardOrderToAll } from '../utils/orderForwarding.js';
import CONFIG from '../config.js';
import fs from 'fs';

// ========================= STATE MANAGEMENT =========================
const userStates = new Map();
const orderCounters = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();
const userLanguagePreference = new Map();
const sessionOrderStats = new Map();

// ========================= INDIAN LANGUAGES SUPPORT =========================
const SUPPORTED_LANGUAGES = {
  'hi': { name: 'हिंदी', nativeName: 'हिंदी', flag: '🇮🇳' },
  'en': { name: 'English', nativeName: 'English', flag: '🇬🇧' },
  'pa': { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  'bn': { name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  'te': { name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  'mr': { name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  'ta': { name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  'gu': { name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  'kn': { name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  'ml': { name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  'or': { name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  'as': { name: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳' },
  'ur': { name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  'sa': { name: 'Sanskrit', nativeName: 'संस्कृत', flag: '🇮🇳' },
  'ne': { name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' }
};

// ========================= MULTILINGUAL TEMPLATES =========================
const MESSAGES = {
  welcome: {
    hi: "🙏 *नमस्ते!*\n\n📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा\n\nहम आपको पूर्णतः निःशुल्क पुस्तक भेजना चाहते हैं। डिलीवरी भी फ्री है।\n\n📖 *पुस्तक में:* आध्यात्मिक ज्ञान जो जीवन की सभी समस्याओं का समाधान देता है।",
    en: "🙏 *Namaste!*\n\n📚 *Sant Rampal Ji Maharaj's* Free Book Service\n\nWe want to send you a completely free book. Delivery is also free.\n\n📖 *In the book:* Spiritual knowledge that solves all life problems.",
    pa: "🙏 *ਸਤ ਸ੍ਰੀ ਅਕਾਲ!*\n\n📚 *ਸੰਤ ਰਾਮਪਾਲ ਜੀ ਮਹਾਰਾਜ* ਦੀ ਮੁਫ਼ਤ ਕਿਤਾਬ ਸੇਵਾ\n\nਅਸੀਂ ਤੁਹਾਨੂੰ ਪੂਰੀ ਤਰ੍ਹਾਂ ਮੁਫ਼ਤ ਕਿਤਾਬ ਭੇਜਣਾ ਚਾਹੁੰਦੇ ਹਾਂ।\n\n📖 *ਕਿਤਾਬ ਵਿੱਚ:* ਅਧਿਆਤਮਿਕ ਗਿਆਨ ਜੋ ਜੀਵਨ ਦੀਆਂ ਸਾਰੀਆਂ ਸਮੱਸਿਆਵਾਂ ਦਾ ਹੱਲ ਦਿੰਦਾ ਹੈ।",
    bn: "🙏 *নমস্কার!*\n\n📚 *সন্ত রামপাল জি মহারাজের* বিনামূল্যে বই সেবা\n\nআমরা আপনাকে সম্পূর্ণ বিনামূল্যে বই পাঠাতে চাই।\n\n📖 *বইতে:* আধ্যাত্মিক জ্ঞান যা জীবনের সমস্ত সমস্যার সমাধান দেয়।",
    te: "🙏 *నమస్తే!*\n\n📚 *సంత్ రామ్‌పాల్ జీ మహారాజ్* ఉచిత పుస్తక సేవ\n\nమేము మీకు పూర్తిగా ఉచితంగా పుస్తకం పంపాలనుకుంటున్నాము.\n\n📖 *పుస్తకంలో:* జీవిత సమస్యలన్నింటికీ పరిష్కారం ఇచ్చే ఆధ్యాత్మిక జ్ఞానం.",
    mr: "🙏 *नमस्कार!*\n\n📚 *संत रामपाल जी महाराज* यांची विनामूल्य पुस्तक सेवा\n\nआम्ही तुम्हाला पूर्णपणे विनामूल्य पुस्तक पाठवू इच्छितो.\n\n📖 *पुस्तकात:* आध्यात्मिक ज्ञान जे जीवनातील सर्व समस्यांचे निराकरण करते.",
    ta: "🙏 *வணக்கம்!*\n\n📚 *சாந்த் ராம்பால் ஜி மகாராஜின்* இலவச புத்தக சேவை\n\nநாங்கள் உங்களுக்கு முற்றிலும் இலவசமாக புத்தகம் அனுப்ப விரும்புகிறோம்.\n\n📖 *புத்தகத்தில்:* வாழ்க்கை பிரச்சனைகள் அனைத்தையும் தீர்க்கும் ஆன்மீக அறிவு.",
    gu: "🙏 *નમસ્તે!*\n\n📚 *સંત રામપાલ જી મહારાજ*ની મફત પુસ્તક સેવા\n\nઅમે તમને સંપૂર્ણ મફત પુસ્તક મોકલવા માંગીએ છીએ.\n\n📖 *પુસ્તકમાં:* આધ્યાત્મિક જ્ઞાન જે જીવનની તમામ સમસ્યાઓનો ઉકેલ આપે છે.",
    kn: "🙏 *ನಮಸ್ತೆ!*\n\n📚 *ಸಂತ್ ರಾಮ್‌ಪಾಲ್ ಜೀ ಮಹಾರಾಜ್* ಉಚಿತ ಪುಸ್ತಕ ಸೇವೆ\n\nನಾವು ನಿಮಗೆ ಸಂಪೂರ್ಣವಾಗಿ ಉಚಿತ ಪುಸ್ತಕವನ್ನು ಕಳುಹಿಸಲು ಬಯಸುತ್ತೇವೆ.\n\n📖 *ಪುಸ್ತಕದಲ್ಲಿ:* ಜೀವನದ ಎಲ್ಲಾ ಸಮಸ್ಯೆಗಳನ್ನು ಪರಿಹರಿಸುವ ಆಧ್ಯಾತ್ಮಿಕ ಜ್ಞಾನ.",
    ml: "🙏 *നമസ്തേ!*\n\n📚 *സന്ത് റാംപാൽ ജി മഹാരാജിന്റെ* സൗജന്യ പുസ്തക സേവനം\n\nഞങ്ങൾ നിങ്ങൾക്ക് പൂർണ്ണമായും സൗജന്യമായി പുസ്തകം അയയ്ക്കാൻ ആഗ്രഹിക്കുന്നു.\n\n📖 *പുസ്തകത്തിൽ:* ജീവിത പ്രശ്നങ്ങളെല്ലാം പരിഹരിക്കുന്ന ആത്മീയ അറിവ്.",
    or: "🙏 *ନମସ୍କାର!*\n\n📚 *ସନ୍ତ ରାମପାଲ ଜୀ ମହାରାଜଙ୍କ* ମାଗଣା ପୁସ୍ତକ ସେବା\n\nଆମେ ଆପଣଙ୍କୁ ସମ୍ପୂର୍ଣ୍ଣ ମାଗଣାରେ ପୁସ୍ତକ ପଠାଇବାକୁ ଚାହୁଁଛୁ.\n\n📖 *ପୁସ୍ତକରେ:* ଆଧ୍ୟାତ୍ମିକ ଜ୍ଞାନ ଯାହା ଜୀବନର ସମସ୍ତ ସମସ୍ୟାର ସମାଧାନ ଦିଏ.",
    as: "🙏 *নমস্কাৰ!*\n\n📚 *সন্ত ৰামপাল জী মহাৰাজৰ* বিনামূলীয়া কিতাপ সেৱা\n\nআমি আপোনাক সম্পূৰ্ণ বিনামূলীয়াকৈ কিতাপ পঠাব বিচাৰো.\n\n📖 *কিতাপত:* আধ্যাত্মিক জ্ঞান যিয়ে জীৱনৰ সকলো সমস্যাৰ সমাধান দিয়ে.",
    ur: "🙏 *السلام علیکم!*\n\n📚 *سنت رام پال جی مہاراج* کی مفت کتاب سروس\n\nہم آپ کو مکمل طور پر مفت کتاب بھیجنا چاہتے ہیں۔\n\n📖 *کتاب میں:* روحانی علم جو زندگی کے تمام مسائل حل کرتا ہے۔"
  },
  
  bookSelection: {
    hi: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*कौनसी पुस्तक चाहिए?*\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n2️⃣ जीने की राह (Way of Living)\n3️⃣ पहले PDF देखना चाहते हैं?\n\n*1, 2 या 3 भेजें*",
    en: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*Which book would you like?*\n\n1️⃣ Gyan Ganga (Knowledge River)\n2️⃣ Way of Living\n3️⃣ Want to see PDF first?\n\n*Send 1, 2 or 3*",
    pa: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*ਕਿਹੜੀ ਕਿਤਾਬ ਚਾਹੀਦੀ ਹੈ?*\n\n1️⃣ ਗਿਆਨ ਗੰਗਾ\n2️⃣ ਜੀਣ ਦਾ ਰਾਹ\n3️⃣ ਪਹਿਲਾਂ PDF ਦੇਖਣਾ ਚਾਹੁੰਦੇ ਹੋ?\n\n*1, 2 ਜਾਂ 3 ਭੇਜੋ*",
    bn: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*কোন বই চান?*\n\n1️⃣ জ্ঞান গঙ্গা\n2️⃣ জীবনের পথ\n3️⃣ প্রথমে PDF দেখতে চান?\n\n*1, 2 বা 3 পাঠান*",
    te: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*ఏ పుస్తకం కావాలి?*\n\n1️⃣ జ్ఞాన గంగా\n2️⃣ జీవించే మార్గం\n3️⃣ మొదట PDF చూడాలనుకుంటున్నారా?\n\n*1, 2 లేదా 3 పంపండి*",
    mr: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*कोणते पुस्तक हवे?*\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीवन जगण्याचा मार्ग\n3️⃣ प्रथम PDF पहायचे?\n\n*1, 2 किंवा 3 पाठवा*",
    ta: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*எந்த புத்தகம் வேண்டும்?*\n\n1️⃣ ஞான கங்கா\n2️⃣ வாழும் வழி\n3️⃣ முதலில் PDF பார்க்க விரும்புகிறீர்களா?\n\n*1, 2 அல்லது 3 அனுப்பவும்*",
    gu: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*કયું પુસ્તક જોઈએ છે?*\n\n1️⃣ જ્ઞાન ગંગા\n2️⃣ જીવવાનો માર્ગ\n3️⃣ પહેલાં PDF જોવું છે?\n\n*1, 2 અથવા 3 મોકલો*",
    kn: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*ಯಾವ ಪುಸ್ತಕ ಬೇಕು?*\n\n1️⃣ ಜ್ಞಾನ ಗಂಗಾ\n2️⃣ ಬದುಕುವ ದಾರಿ\n3️⃣ ಮೊದಲು PDF ನೋಡಲು ಬಯಸುತ್ತೀರಾ?\n\n*1, 2 ಅಥವಾ 3 ಕಳುಹಿಸಿ*",
    ml: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*ഏത് പുസ്തകം വേണം?*\n\n1️⃣ ജ്ഞാന ഗംഗാ\n2️⃣ ജീവിക്കാനുള്ള വഴി\n3️⃣ ആദ്യം PDF കാണണോ?\n\n*1, 2 അല്ലെങ്കിൽ 3 അയയ്ക്കുക*",
    or: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*କେଉଁ ପୁସ୍ତକ ଚାହୁଁଛନ୍ତି?*\n\n1️⃣ ଜ୍ଞାନ ଗଙ୍ଗା\n2️⃣ ଜୀବନର ପଥ\n3️⃣ ପ୍ରଥମେ PDF ଦେଖିବାକୁ ଚାହୁଁଛନ୍ତି କି?\n\n*1, 2 କିମ୍ବା 3 ପଠାନ୍ତୁ*",
    as: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*কোনখন কিতাপ লাগে?*\n\n1️⃣ জ্ঞান গংগা\n2️⃣ জীয়াৰ বাট\n3️⃣ প্ৰথমে PDF চাব বিচাৰে নেকি?\n\n*1, 2 বা 3 পঠিয়াওক*",
    ur: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*کون سی کتاب چاہیے؟*\n\n1️⃣ گیان گنگا\n2️⃣ جینے کا راستہ\n3️⃣ پہلے PDF دیکھنا چاہتے ہیں؟\n\n*1، 2 یا 3 بھیجیں*"
  },
  
  languageChoice: {
    hi: "🌐 *भाषा चुनें / Choose Language:*\n\n1️⃣ हिंदी (Hindi)\n2️⃣ English\n3️⃣ ਪੰਜਾਬੀ (Punjabi)\n4️⃣ বাংলা (Bengali)\n5️⃣ తెలుగు (Telugu)\n6️⃣ मराठी (Marathi)\n7️⃣ தமிழ் (Tamil)\n8️⃣ ગુજરાતી (Gujarati)\n9️⃣ ಕನ್ನಡ (Kannada)\n🔟 മലയാളം (Malayalam)\n1️⃣1️⃣ ଓଡ଼ିଆ (Odia)\n1️⃣2️⃣ অসমীয়া (Assamese)\n1️⃣3️⃣ اردو (Urdu)\n\n*भाषा का नंबर भेजें*\n_Send language number_",
    en: "🌐 *Choose Language:*\n\n1️⃣ हिंदी (Hindi)\n2️⃣ English\n3️⃣ ਪੰਜਾਬੀ (Punjabi)\n4️⃣ বাংলা (Bengali)\n5️⃣ తెలుగు (Telugu)\n6️⃣ मराठी (Marathi)\n7️⃣ தமிழ் (Tamil)\n8️⃣ ગુજરાતી (Gujarati)\n9️⃣ ಕನ್ನಡ (Kannada)\n🔟 മലയാളം (Malayalam)\n1️⃣1️⃣ ଓଡ଼ିଆ (Odia)\n1️⃣2️⃣ অসমীয়া (Assamese)\n1️⃣3️⃣ اردو (Urdu)\n\n*Send language number*"
  },
  
  orderConfirmed: {
    hi: "🎉 *ऑर्डर सफलतापूर्वक दर्ज!*\n\n📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)\n✅ आपकी पुस्तक जल्द भेजी जाएगी\n\n🙏 *धन्यवाद!*",
    en: "🎉 *Order Successfully Placed!*\n\n📦 *Delivery:* 7-21 days (Free)\n✅ Your book will be sent soon\n\n🙏 *Thank you!*",
    pa: "🎉 *ਆਰਡਰ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ!*\n\n📦 *ਡਿਲੀਵਰੀ:* 7-21 ਦਿਨ (ਮੁਫ਼ਤ)\n✅ ਤੁਹਾਡੀ ਕਿਤਾਬ ਜਲਦੀ ਭੇਜੀ ਜਾਵੇਗੀ\n\n🙏 *ਧੰਨਵਾਦ!*",
    bn: "🎉 *অর্ডার সফলভাবে নেওয়া হয়েছে!*\n\n📦 *ডেলিভারি:* 7-21 দিন (বিনামূল্যে)\n✅ আপনার বই শীঘ্রই পাঠানো হবে\n\n🙏 *ধন্যবাদ!*",
    te: "🎉 *ఆర్డర్ విజయవంతంగా నమోదైంది!*\n\n📦 *డెలివరీ:* 7-21 రోజులు (ఉచితం)\n✅ మీ పుస్తకం త్వరలో పంపబడుతుంది\n\n🙏 *ధన్యవాదాలు!*",
    mr: "🎉 *ऑर्डर यशस्वीरित्या नोंदवला!*\n\n📦 *डिलिव्हरी:* 7-21 दिवस (विनामूल्य)\n✅ तुमचे पुस्तक लवकरच पाठवले जाईल\n\n🙏 *धन्यवाद!*",
    ta: "🎉 *ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது!*\n\n📦 *டெலிவரி:* 7-21 நாட்கள் (இலவசம்)\n✅ உங்கள் புத்தகம் விரைவில் அனுப்பப்படும்\n\n🙏 *நன்றி!*",
    gu: "🎉 *ઓર્ડર સફળતાપૂર્વક નોંધાયો!*\n\n📦 *ડિલિવરી:* 7-21 દિવસ (મફત)\n✅ તમારું પુસ્તક ટૂંક સમયમાં મોકલાશે\n\n🙏 *આભાર!*",
    kn: "🎉 *ಆರ್ಡರ್ ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ!*\n\n📦 *ಡೆಲಿವರಿ:* 7-21 ದಿನಗಳು (ಉಚಿತ)\n✅ ನಿಮ್ಮ ಪುಸ್ತಕ ಶೀಘ್ರದಲ್ಲೇ ಕಳುಹಿಸಲಾಗುವುದು\n\n🙏 *ಧನ್ಯವಾದಗಳು!*",
    ml: "🎉 *ഓർഡർ വിജയകരമായി രജിസ്റ്റർ ചെയ്തു!*\n\n📦 *ഡെലിവറി:* 7-21 ദിവസം (സൗജന്യം)\n✅ നിങ്ങളുടെ പുസ്തകം ഉടൻ അയയ്ക്കും\n\n🙏 *നന്ദി!*",
    or: "🎉 *ଅର୍ଡର ସଫଳତାର ସହିତ ନିବନ୍ଧିତ!*\n\n📦 *ଡେଲିଭରି:* 7-21 ଦିନ (ମାଗଣା)\n✅ ଆପଣଙ୍କ ପୁସ୍ତକ ଶୀଘ୍ର ପଠାଯିବ\n\n🙏 *ଧନ୍ୟବାଦ!*",
    as: "🎉 *অৰ্ডাৰ সফলতাৰে পঞ্জীয়ন কৰা হ'ল!*\n\n📦 *ডেলিভাৰী:* 7-21 দিন (বিনামূলীয়া)\n✅ আপোনাৰ কিতাপ সোনকালে পঠোৱা হ'ব\n\n🙏 *ধন্যবাদ!*",
    ur: "🎉 *آرڈر کامیابی سے درج ہو گیا!*\n\n📦 *ڈیلیوری:* 7-21 دن (مفت)\n✅ آپ کی کتاب جلد بھیجی جائے گی\n\n🙏 *شکریہ!*"
  }
};

// ========================= LANGUAGE DETECTION HELPER =========================
async function detectLanguage(text) {
  // Simple language detection based on script
  const hindiRegex = /[\u0900-\u097F]/;
  const punjabiRegex = /[\u0A00-\u0A7F]/;
  const bengaliRegex = /[\u0980-\u09FF]/;
  const teluguRegex = /[\u0C00-\u0C7F]/;
  const marathiRegex = /[\u0900-\u097F]/;
  const tamilRegex = /[\u0B80-\u0BFF]/;
  const gujaratiRegex = /[\u0A80-\u0AFF]/;
  const kannadaRegex = /[\u0C80-\u0CFF]/;
  const malayalamRegex = /[\u0D00-\u0D7F]/;
  const odiaRegex = /[\u0B00-\u0B7F]/;
  const assameseRegex = /[\u0980-\u09FF]/;
  const urduRegex = /[\u0600-\u06FF]/;
  
  if (hindiRegex.test(text)) return 'hi';
  if (punjabiRegex.test(text)) return 'pa';
  if (bengaliRegex.test(text)) return 'bn';
  if (teluguRegex.test(text)) return 'te';
  if (tamilRegex.test(text)) return 'ta';
  if (gujaratiRegex.test(text)) return 'gu';
  if (kannadaRegex.test(text)) return 'kn';
  if (malayalamRegex.test(text)) return 'ml';
  if (odiaRegex.test(text)) return 'or';
  if (urduRegex.test(text)) return 'ur';
  
  // Default to Hindi for Devanagari or English
  return 'hi';
}
const LANGUAGE_CODE_MAP = {
  '1': 'hi', '2': 'en', '3': 'pa', '4': 'bn', '5': 'te',
  '6': 'mr', '7': 'ta', '8': 'gu', '9': 'kn', '10': 'ml',
  '11': 'or', '12': 'as', '13': 'ur'
};

// ========================= HELPER FUNCTIONS =========================
function getRandomDescription() {
  const descriptions = [
    "इस पुस्तक में सच्चे आध्यात्मिक ज्ञान का खजाना है।",
    "यह पुस्तक आपको बताती है कि परमात्मा को कैसे पाएं।",
    "जीवन की सभी परेशानियों से मुक्ति का सही तरीका।",
    "यह पुस्तक हजारों लोगों की ज़िंदगी बदल चुकी है!",
    "परमात्मा कबीर साहेब का सच्चा परिचय।"
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हाँ','done','order','yes.','ok.','haan.','haa','y','Y','ha.','ہاں','ji','जी','han','theek','ਹਾਂ','হ্যাঁ','అవును','हो','ஆம்','હા','ಹೌದು','അതെ','ହଁ','হয়','جی'];
  return yes.includes(txt.trim().toLowerCase());
}

function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','no.','nahi.','nope','नहि','n','N','nhi','cancel','نہیں','galat','ਨਹੀਂ','না','కాదు','नाही','இல்லை','ના','ಇಲ್ಲ','ഇല്ല','ନା','নহয়','نہیں'];
  return no.includes(txt.trim().toLowerCase());
}

function isBack(txt) {
  const back = ['back','वापस','peeche','0','⬅️','पीछे','vapas','ਪਿੱਛੇ','পিছনে','వెనుకకు','मागे','பின்','પાછળ','ಹಿಂದೆ','പിന്നോട്ട്','ପଛକୁ','পিছলৈ','واپس'];
  return back.includes(txt.trim().toLowerCase());
}

function autoBook(text) {
  const low = text.trim().toLowerCase();
  if (low.includes('ganga') || low.includes('ज्ञान') || low.includes('gyan') || low.includes('ganga')) return 'ज्ञान गंगा';
  if (low.includes('jeene') || low.includes('जीने') || low.includes('living') || low.includes('राह') || low.includes('way')) return 'जीने की राह';
  return null;
}

function updateOrderCount(sessionName) {
  if (!orderCounters.has(sessionName)) orderCounters.set(sessionName, 1);
  else orderCounters.set(sessionName, orderCounters.get(sessionName) + 1);
  return orderCounters.get(sessionName);
}

function getRotatedImage(userJid) {
  try {
    const base = '/sdcard/DCIM/gyan ganga seva/';
    if (!fs.existsSync(base)) return null;
    const files = fs.readdirSync(base).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    if (!files.length) return null;
    const idx = Math.abs((userJid || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % files.length;
    return base + files[idx];
  } catch {
    return null;
  }
}

// ========================= SESSION STATISTICS =========================
function updateSessionStats(sessionName, action = 'order') {
  if (!sessionOrderStats.has(sessionName)) {
    sessionOrderStats.set(sessionName, {
      total: 0,
      today: 0,
      last24Hours: 0,
      lastReset: Date.now(),
      orders: []
    });
  }
  
  const stats = sessionOrderStats.get(sessionName);
  const now = Date.now();
  
  if (action === 'order') {
    stats.total++;
    stats.today++;
    stats.last24Hours++;
    stats.orders.push({ timestamp: now, action: 'order' });
  }
  
  // Reset daily counter at midnight
  const lastResetDate = new Date(stats.lastReset).getDate();
  const currentDate = new Date().getDate();
  if (lastResetDate !== currentDate) {
    stats.today = 0;
    stats.lastReset = now;
  }
  
  // Clean up orders older than 24 hours
  stats.orders = stats.orders.filter(o => (now - o.timestamp) < 86400000);
  stats.last24Hours = stats.orders.length;
  
  sessionOrderStats.set(sessionName, stats);
  return stats;
}

function getSessionStats(sessionName) {
  return sessionOrderStats.get(sessionName) || {
    total: 0,
    today: 0,
    last24Hours: 0,
    orders: []
  };
}

// ========================= SCHEDULED REPORTING (6:30 PM) =========================
function scheduleReporting(sock) {
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Send report at 6:30 PM IST
    if (hours === 18 && minutes === 30) {
      sendDailyReports(sock);
    }
  }, 60000); // Check every minute
}

async function sendDailyReports(sock) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SENDING DAILY REPORTS AT 6:30 PM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const dateStr = new Date().toLocaleDateString('hi-IN', { 
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  // 1. Send to Main Admin
  try {
    if (CONFIG.ADMIN?.JID) {
      let mainReport = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *दैनिक रिपोर्ट* | *Daily Report*
📅 *Date:* ${dateStr}
⏰ *Time:* 6:30 PM IST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔷 *सभी सत्रों की रिपोर्ट* | *All Sessions Report*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let grandTotal = 0;
      let grandToday = 0;
      let grandLast24 = 0;
      
      for (const [session, stats] of sessionOrderStats.entries()) {
        grandTotal += stats.total;
        grandToday += stats.today;
        grandLast24 += stats.last24Hours;
        
        mainReport += `📱 *${session}*\n`;
        mainReport += `   └─ कुल ऑर्डर (Total): ${stats.total}\n`;
        mainReport += `   └─ आज (Today): ${stats.today}\n`;
        mainReport += `   └─ Last 24h: ${stats.last24Hours}\n\n`;
      }
      
      mainReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *GRAND TOTAL*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 कुल ऑर्डर (Total Orders): ${grandTotal}
🔹 आज के ऑर्डर (Today): ${grandToday}
🔹 पिछले 24 घंटे (Last 24h): ${grandLast24}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(CONFIG.ADMIN.JID, { text: mainReport });
      console.log(`✅ Main Admin Report Sent: ${CONFIG.ADMIN.PHONE}`);
    }
  } catch (error) {
    console.error(`❌ Main Admin Report Failed: ${error.message}`);
  }
  
  // 2. Send to Order Group
  try {
    const groups = await sock.groupFetchAllParticipating();
    const groupName = CONFIG.ORDER_GROUP_NAME || 'Order_received_on_WhatsApp';
    
    let groupJID = null;
    for (const [jid, group] of Object.entries(groups)) {
      if (group.subject && group.subject.toLowerCase().includes(groupName.toLowerCase())) {
        groupJID = jid;
        break;
      }
    }
    
    if (groupJID) {
      let groupReport = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *दैनिक ऑर्डर रिपोर्ट*
📅 ${dateStr} | ⏰ 6:30 PM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      let totalOrders = 0;
      for (const [session, stats] of sessionOrderStats.entries()) {
        totalOrders += stats.last24Hours;
        groupReport += `📱 *${session}*: ${stats.last24Hours} orders (24h)\n`;
      }
      
      groupReport += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      groupReport += `📦 *कुल ऑर्डर (Total):* ${totalOrders}\n`;
      groupReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(groupJID, { text: groupReport });
      console.log(`✅ Group Report Sent: ${groupName}`);
    }
  } catch (error) {
    console.error(`❌ Group Report Failed: ${error.message}`);
  }
  
  // 3. Send to Each Session Admin
  for (const [session, stats] of sessionOrderStats.entries()) {
    try {
      const { getSessionAdmin } = await import('./sessionAdminManager.js');
      const sessionAdminJID = await getSessionAdmin(session);
      
      if (sessionAdminJID && sessionAdminJID !== CONFIG.ADMIN?.JID) {
        let sessionReport = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *${session} - रिपोर्ट*
📅 ${dateStr} | ⏰ 6:30 PM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 *आपके सत्र के आंकड़े:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 कुल ऑर्डर (Total): ${stats.total}
📦 आज के ऑर्डर (Today): ${stats.today}
📦 पिछले 24 घंटे (Last 24h): ${stats.last24Hours}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ बहुत बढ़िया काम! | Great Work!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        await sock.sendMessage(sessionAdminJID, { text: sessionReport });
        console.log(`✅ Session Report Sent: ${session}`);
      }
    } catch (error) {
      console.error(`❌ Session Report Failed (${session}): ${error.message}`);
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALL DAILY REPORTS SENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ========================= REMINDER SYSTEM =========================
function scheduleReminder(sock, from, state, sessionName, isAdmin) {
  if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
  const reminderTime = 6 * 60 * 60 * 1000; // 6 hours
  
  reminderTimeouts.set(from, setTimeout(async () => {
    if (userStates.has(from)) {
      const imgPath = getRotatedImage(from);
      const userLang = userLanguagePreference.get(from) || 'hi';
      
      let remTxt = isAdmin
        ? `🛠️ *[Admin Test Mode Reminder]*\nआप अभी भी Test-Mode में हैं।\n(You are still in Test Mode!)\n(Reply 'exit' या 0 छोड़ने के लिए)`
        : MESSAGES.welcome[userLang] + '\n\n⏰ *आपका ऑर्डर अधूरा है!*\n_Your order is pending!_';
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: remTxt });
      } else {
        await sock.sendMessage(from, { text: remTxt });
      }
    }
  }, reminderTime));
}

// ========================= ADMIN TEST MODE =========================
async function handleAdminTestMode(sock, from, text, state, sessionName) {
  let imgPath = getRotatedImage(from);
  
  if (!state.testMode) {
    if (text.toLowerCase() === "test" || text === "1") {
      state.testMode = true;
      userStates.set(from, state);
      const msg = `🛠️ *Admin Test Mode Activated!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ हर message पर image
✅ Full system testing
✅ Order simulation enabled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Test Commands:*
- 'exit' or '0' = Exit Test Mode
- 'stats' = View session statistics
- 'report' = Generate instant report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Reply to start testing...`;
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: msg });
      } else {
        await sock.sendMessage(from, { text: msg });
      }
      scheduleReminder(sock, from, state, sessionName, true);
      return true;
    }
    
    const msg = `🔐 *Admin Verified!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Mode शुरू करने के लिए:
_To start Test Mode:_

*'test'* या *'1'* भेजें

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    if (imgPath && fs.existsSync(imgPath)) {
      await sock.sendMessage(from, { image: { url: imgPath }, caption: msg });
    } else {
      await sock.sendMessage(from, { text: msg });
    }
    return true;
  }
  
  // Handle test mode commands
  if (text.toLowerCase() === "exit" || text === "0") {
    userStates.delete(from);
    if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
    await sock.sendMessage(from, { text: "🚫 *Test Mode समाप्त!*\n_Test Mode Exited!_" });
    return true;
  }
  
  if (text.toLowerCase() === "stats") {
    const stats = getSessionStats(sessionName);
    const statsMsg = `📊 *${sessionName} Statistics*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 कुल ऑर्डर: ${stats.total}
📦 आज: ${stats.today}
📦 Last 24h: ${stats.last24Hours}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    await sock.sendMessage(from, { text: statsMsg });
    return true;
  }
  
  if (text.toLowerCase() === "report") {
    await sendDailyReports(sock);
    await sock.sendMessage(from, { text: "✅ *Instant Report Generated & Sent!*" });
    return true;
  }
  
  // Echo test message
  const echoMsg = `🔁 *[Test Mode Echo]*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Your message: "${text}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Commands: 'exit', 'stats', 'report'`;
  
  if (imgPath && fs.existsSync(imgPath)) {
    await sock.sendMessage(from, { image: { url: imgPath }, caption: echoMsg });
  } else {
    await sock.sendMessage(from, { text: echoMsg });
  }
  
  scheduleReminder(sock, from, state, sessionName, true);
  return true;
}

// ========================= MAIN MESSAGE HANDLER =========================
export async function handleMessage(sock, msg, sessionName = 'WhatsApp') {
  try {
    const from = msg.key?.remoteJid ?? msg.key?.participant ?? '';
    if (!from) return;
    
    // Ignore group messages
    if (from.endsWith('@g.us')) {
      console.log('Ignoring group message from:', from);
      return;
    }
    
    const textRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const text = textRaw.trim();
    if (!text) return;
    
    const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
    let state = userStates.get(from) || {};
    
    // Get or detect user language preference
    if (!userLanguagePreference.has(from)) {
      const detected = await detectLanguage(text);
      userLanguagePreference.set(from, detected || 'hi');
    }
    const userLang = userLanguagePreference.get(from);
    
    // ==================== ADMIN TEST MODE ====================
    if (isAdmin) {
      const handled = await handleAdminTestMode(sock, from, text, state, sessionName);
      if (handled) return;
    }
    
    // ==================== CHECK RECENT ORDERS ====================
    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const remindText = MESSAGES.welcome[userLang] + `\n\n🙏 *आपका ऑर्डर पहले ही दर्ज है!*\n_Your order is already placed!_\n\nनया ऑर्डर ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} घंटे बाद।`;
        
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: remindText });
        } else {
          await sock.sendMessage(from, { text: remindText });
        }
        return;
      } else {
        userOrderCompleted.delete(from);
      }
    }
    
    // ==================== NEW CONVERSATION START ====================
    if (!userStates.has(from)) {
      // Check if user wants language selection first
      if (text.toLowerCase().includes('language') || text.toLowerCase().includes('भाषा') || text === 'lang') {
        state.step = 'selecting_chat_language';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: MESSAGES.languageChoice[userLang] });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      }
      
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      
      let welcome = MESSAGES.welcome[userLang] + '\n\n' + MESSAGES.bookSelection[userLang];
      
      // Handle PDF request
      if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: welcome });
        } else {
          await sock.sendMessage(from, { text: welcome });
        }
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (auto) {
        state.bookName = auto;
        state.step = 'awaiting_language';
        userStates.set(from, state);
      } else {
        state.step = 'awaiting_book';
        userStates.set(from, state);
      }
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: welcome });
      } else {
        await sock.sendMessage(from, { text: welcome });
      }
      
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== CONTINUE EXISTING CONVERSATION ====================
    state = userStates.get(from);
    state.lastActive = Date.now();
    userStates.set(from, state);
    
    // Handle language selection for chat
    if (state.step === 'selecting_chat_language') {
      const langCode = LANGUAGE_CODE_MAP[text];
      if (langCode && SUPPORTED_LANGUAGES[langCode]) {
        userLanguagePreference.set(from, langCode);
        const newLang = langCode;
        state.step = 'awaiting_book';
        userStates.set(from, state);
        
        const welcome = MESSAGES.welcome[newLang] + '\n\n' + MESSAGES.bookSelection[newLang];
        await sock.sendMessage(from, { text: welcome });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else {
        await sock.sendMessage(from, { text: MESSAGES.languageChoice[userLang] + '\n\n❌ सही नंबर भेजें | Send correct number' });
        return;
      }
    }
    
    // Handle back navigation
    if (isBack(text)) {
      const prev = {
        awaiting_language: 'awaiting_book',
        awaiting_name: 'awaiting_language',
        confirm_name: 'awaiting_name',
        awaiting_father: 'confirm_name',
        confirm_father: 'awaiting_father',
        awaiting_mobile: 'confirm_father',
        confirm_mobile: 'awaiting_mobile',
        awaiting_pincode: 'confirm_mobile',
        awaiting_location_choice: 'awaiting_pincode',
        awaiting_full_address: 'awaiting_location_choice',
        awaiting_confirmation: 'awaiting_full_address',
        awaiting_pdf_language: 'awaiting_pdf_book',
        pdf_shown: 'awaiting_book'
      };
      
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `⬅️ पिछला स्टेप | Previous step\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
        await resendMenu(sock, from, state, userLang);
      }
      return;
    }
    
    // ==================== BOOK SELECTION ====================
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: MESSAGES.bookSelection[userLang] });
        return;
      }
      else book = autoBook(text);
      
      if (!book) {
        await sock.sendMessage(from, { text: MESSAGES.bookSelection[userLang] + '\n\n❌ 1, 2 या 3 भेजें | Send 1, 2 or 3' });
        return;
      }
      
      state.bookName = book;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = `✅ *${book}*\n✍️ लेखक: संत रामपाल जी महाराज\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nकिस भाषा में? | Which language?\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें | Send number`;
      
      await sock.sendMessage(from, { text: langMenu });
      state.availableLangs = langs;
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== BOOK LANGUAGE SELECTION ====================
    if (state.step === 'awaiting_language') {
      const langIdx = parseInt(text) - 1;
      let langSelected;
      const langs = state.availableLangs || ['हिंदी', 'English'];
      
      if (!isNaN(langIdx) && langIdx >= 0 && langIdx < langs.length) {
        langSelected = langs[langIdx];
      } else {
        langSelected = langs.find(l => l && l.toLowerCase() === text.toLowerCase());
      }
      
      if (!langSelected) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें | Send correct number\n\n⬅️ पीछे: *0*` });
        return;
      }
      
      state.language = langSelected;
      state.step = 'awaiting_name';
      userStates.set(from, state);
      
      const nameMsg = `✅ भाषा: *${langSelected}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा नाम* भेजें:\n_Your Full Name:_\n\nउदाहरण: राज कुमार शर्मा\n_Example: Raj Kumar Sharma_`;
      
      await sock.sendMessage(from, { text: nameMsg });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== NAME INPUT ====================
    if (state.step === 'awaiting_name') {
      if (text.length < 3) {
        await sock.sendMessage(from, { text: '❌ कम से कम 3 अक्षर का नाम | Minimum 3 characters\n\nअपना पूरा नाम भेजें:' });
        return;
      }
      
      state.name = text;
      state.step = 'confirm_name';
      userStates.set(from, state);
      
      const confirmMsg = `नाम | Name: *${text}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है: *1* / "हाँ" / "Yes"\n❌ बदलना है: *2* / "नहीं" / "No"`;
      
      await sock.sendMessage(from, { text: confirmMsg });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== NAME CONFIRMATION ====================
    if (state.step === 'confirm_name') {
      if (isYes(text)) {
        state.step = 'awaiting_father';
        userStates.set(from, state);
        
        const fatherMsg = `अब अपने *पिता का नाम* लिखें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Father's Name:_\n\nउदाहरण: संतोष कुमार शर्मा\n_Example: Santosh Kumar Sharma_`;
        
        await sock.sendMessage(from, { text: fatherMsg });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        state.step = 'awaiting_name';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: '✏️ अपना नाम फिर से लिखें:\n_Write your name again:_' });
        return;
      }
    }
    
    // ==================== FATHER NAME INPUT ====================
    if (state.step === 'awaiting_father') {
      if (text.length < 3) {
        await sock.sendMessage(from, { text: '❌ कम से कम 3 अक्षर | Minimum 3 characters\n\nपिता का नाम भेजें:' });
        return;
      }
      
      state.father = text;
      state.step = 'confirm_father';
      userStates.set(from, state);
      
      const confirmMsg = `पिता का नाम | Father: *${text}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है: *1* / "हाँ" / "Yes"\n❌ बदलना है: *2* / "नहीं" / "No"`;
      
      await sock.sendMessage(from, { text: confirmMsg });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== FATHER NAME CONFIRMATION ====================
    if (state.step === 'confirm_father') {
      if (isYes(text)) {
        state.step = 'awaiting_mobile';
        userStates.set(from, state);
        
        const mobileMsg = `अब *मोबाइल नंबर* (10-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Mobile Number:_\n\nउदाहरण: 9876543210\n_Example: 9876543210_`;
        
        await sock.sendMessage(from, { text: mobileMsg });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        state.step = 'awaiting_father';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: '✏️ पिता का नाम फिर से लिखें:\n_Write father name again:_' });
        return;
      }
    }
    
    // ==================== MOBILE INPUT ====================
    if (state.step === 'awaiting_mobile') {
      const cleaned = text.replace(/[^0-9]/g, '');
      if (cleaned.length !== 10) {
        await sock.sendMessage(from, { text: '❌ 10 अंक का मोबाइल नंबर चाहिए\n_Need 10-digit mobile number_\n\nउदाहरण: 9876543210' });
        return;
      }
      
      state.mobile = cleaned;
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      
      const confirmMsg = `मोबाइल | Mobile: *${cleaned}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है: *1* / "हाँ" / "Yes"\n❌ बदलना है: *2* / "नहीं" / "No"`;
      
      await sock.sendMessage(from, { text: confirmMsg });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== MOBILE CONFIRMATION ====================
    if (state.step === 'confirm_mobile') {
      if (isYes(text)) {
        state.step = 'awaiting_pincode';
        userStates.set(from, state);
        
        const pincodeMsg = `अब *पिनकोड* (6-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Pincode:_\n\nउदाहरण: 110001\n_Example: 110001_`;
        
        await sock.sendMessage(from, { text: pincodeMsg });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        state.step = 'awaiting_mobile';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: '✏️ मोबाइल नंबर फिर से भेजें:\n_Send mobile number again:_' });
        return;
      }
    }
    
    // ==================== PINCODE INPUT ====================
    if (state.step === 'awaiting_pincode') {
      const cleaned = text.replace(/[^0-9]/g, '');
      if (cleaned.length !== 6) {
        await sock.sendMessage(from, { text: '❌ 6 अंक का पिनकोड चाहिए\n_Need 6-digit pincode_\n\nउदाहरण: 110001' });
        return;
      }
      
      await sock.sendMessage(from, { text: '🔍 पिनकोड verify हो रहा है...\n_Verifying pincode..._' });
      
      const pinDetails = await fetchPinDetails(cleaned);
      
      if (!pinDetails || !pinDetails.district) {
        await sock.sendMessage(from, { text: '❌ Invalid pincode! कृपया सही पिनकोड भेजें:\n_Please send correct pincode:_' });
        return;
      }
      
      state.pincode = cleaned;
      state.district = pinDetails.district;
      state.stateName = pinDetails.state;
      state.postOffices = pinDetails.postOffices || [];
      
      if (state.postOffices.length > 0) {
        state.step = 'awaiting_location_choice';
        userStates.set(from, state);
        
        let menu = `✅ पिनकोड: *${cleaned}*\n📍 जिला: *${pinDetails.district}*\n📍 राज्य: *${pinDetails.state}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📍 *अपना क्षेत्र चुनें | Select Area:*\n\n`;
        
        state.postOffices.forEach((po, i) => {
          menu += `${i + 1}. ${po.name} (${po.branchType})\n`;
        });
        
        menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📮 नंबर भेजें | Send number`;
        
        await sock.sendMessage(from, { text: menu });
        scheduleReminder(sock, from, state, sessionName, false);
      } else {
        state.step = 'awaiting_full_address';
        userStates.set(from, state);
        
        const addressMsg = `✅ पिनकोड: *${cleaned}*\n📍 जिला: *${pinDetails.district}*\n📍 राज्य: *${pinDetails.state}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता* विस्तार से लिखें:\n_Write your complete address:_\n\nजैसे: मकान नंबर, गली, गांव/शहर, landmark\n_Like: House no., street, village/city, landmark_`;
        
        await sock.sendMessage(from, { text: addressMsg });
        scheduleReminder(sock, from, state, sessionName, false);
      }
      return;
    }
    
    // ==================== LOCATION CHOICE ====================
    if (state.step === 'awaiting_location_choice') {
      const choice = parseInt(text);
      if (isNaN(choice) || choice < 1 || choice > state.postOffices.length) {
        await sock.sendMessage(from, { text: '❌ सही नंबर भेजें | Send correct number' });
        return;
      }
      
      state.selectedLocation = state.postOffices[choice - 1].name;
      state.step = 'awaiting_full_address';
      userStates.set(from, state);
      
      const addressMsg = `✅ क्षेत्र: *${state.selectedLocation}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता* विस्तार से लिखें:\n_Write complete address in detail:_\n\nजैसे: मकान नंबर, गली, गांव, landmark\n_Like: House no., street, village, landmark_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 जितना विस्तार से, उतना बेहतर!\n_More details = Better delivery!_`;
      
      await sock.sendMessage(from, { text: addressMsg });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== FULL ADDRESS INPUT ====================
    if (state.step === 'awaiting_full_address') {
      if (text.length < 10) {
        await sock.sendMessage(from, { text: '❌ पता बहुत छोटा है! कृपया पूरा पता लिखें।\n_Address too short! Please write complete address._' });
        return;
      }
      
      state.fullAddress = text;
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      
      const confirmationMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ऑर्डर कन्फर्मेशन*
_Order Confirmation_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *नाम:* ${state.name}
👨 *पिता:* ${state.father}
📞 *मोबाइल:* +91${state.mobile}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *पुस्तक:* ${state.bookName}
🌐 *भाषा:* ${state.language}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 *पता:* ${state.fullAddress}
${state.selectedLocation ? `📮 *क्षेत्र:* ${state.selectedLocation}\n` : ''}📮 *पिनकोड:* ${state.pincode}
🏘️ *जिला:* ${state.district}
🗺️ *राज्य:* ${state.stateName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(from, { text: confirmationMsg });
      
      const finalMsg = `✅ *Order Done* के लिए: *1* / "yes" / "order"\n❌ *Cancel* के लिए: *2* / "no" / "cancel"\n\nअपना जवाब भेजें | Send reply:`;
      
      await sock.sendMessage(from, { text: finalMsg });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== FINAL CONFIRMATION ====================
    if (state.step === 'awaiting_confirmation') {
      if (isYes(text)) {
        await sock.sendMessage(from, { text: '⏳ आपका ऑर्डर process हो रहा है...\n_Processing your order..._' });
        
        // Prepare order data
        const orderData = {
          name: state.name,
          father: state.father,
          mobile: state.mobile,
          bookName: state.bookName,
          language: state.language,
          fullAddress: state.fullAddress,
          selectedLocation: state.selectedLocation || '',
          pincode: state.pincode,
          district: state.district,
          stateName: state.stateName,
          timestamp: new Date().toISOString(),
          sessionName: sessionName,
          userJID: from
        };
        
        // Save to database
        try {
          await saveOrder(orderData);
          console.log(`✅ Order saved to database: ${state.name}`);
        } catch (error) {
          console.error(`❌ Database save error: ${error.message}`);
        }
        
        // Forward to all destinations
        const forwardResult = await forwardOrderToAll(sock, sessionName, orderData);
        
        // Update session statistics
        updateSessionStats(sessionName, 'order');
        updateOrderCount(sessionName);
        
        // Get PDF link if available
        const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.bookName] && CONFIG.BOOK_PDFS[state.bookName][state.language] 
          ? CONFIG.BOOK_PDFS[state.bookName][state.language] 
          : null;
        
        // Send confirmation to user
        let userConfirmation = MESSAGES.orderConfirmed[userLang];
        
        if (pdfLink) {
          userConfirmation += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📖 *${state.bookName} (${state.language})* PDF:\n\n${pdfLink}\n\n📥 *Download करें और पढ़ें*\n_Download and read_`;
        }
        
        if (CONFIG.USER_GROUP_LINK) {
          userConfirmation += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n_Join our WhatsApp group:_\n\n${CONFIG.USER_GROUP_LINK}`;
        }
        
        userConfirmation += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *Order Status:* ${forwardResult.success ? 'Successfully Forwarded' : 'Received'}`;
        
        await sock.sendMessage(from, { text: userConfirmation });
        
        // Mark order as completed
        userOrderCompleted.set(from, Date.now());
        
        // Clear state
        userStates.delete(from);
        if (reminderTimeouts.has(from)) {
          clearTimeout(reminderTimeouts.get(from));
          reminderTimeouts.delete(from);
        }
        
        console.log(`✅ Order completed: ${state.name} | Session: ${sessionName}`);
        return;
        
      } else if (isNo(text)) {
        userStates.delete(from);
        if (reminderTimeouts.has(from)) {
          clearTimeout(reminderTimeouts.get(from));
          reminderTimeouts.delete(from);
        }
        
        await sock.sendMessage(from, { text: '❌ *Order Cancelled*\n\nकोई बात नहीं! आप फिर से order कर सकते हैं।\n_No problem! You can order again anytime._\n\n🙏 धन्यवाद | Thank you!' });
        return;
      }
    }
    
    // ==================== PDF FLOW ====================
    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      
      if (!book) {
        await sock.sendMessage(from, { text: MESSAGES.bookSelection[userLang] + '\n\n❌ 1 या 2 भेजें | Send 1 or 2' });
        return;
      }
      
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = `✅ *${book}* PDF\n\nकिस भाषा में? | Which language?\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें | Send number`;
      
      await sock.sendMessage(from, { text: langMenu });
      state.availablePdfLangs = langs;
      state.step = 'awaiting_pdf_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    if (state.step === 'awaiting_pdf_language') {
      const langIdx = parseInt(text) - 1;
      let langSelected;
      const langs = state.availablePdfLangs || ['हिंदी', 'English'];
      
      if (!isNaN(langIdx) && langIdx >= 0 && langIdx < langs.length) {
        langSelected = langs[langIdx];
      } else {
        langSelected = langs.find(l => l && l.toLowerCase() === text.toLowerCase());
      }
      
      if (!langSelected) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें | Send correct number` });
        return;
      }
      
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.pdfBook] && CONFIG.BOOK_PDFS[state.pdfBook][langSelected] 
        ? CONFIG.BOOK_PDFS[state.pdfBook][langSelected] 
        : '';
      
      if (pdfLink) {
        const pdfMsg = `📖 *${state.pdfBook} (${langSelected})* PDF:\n\n${pdfLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📚 कृपया PDF देखें!\n_Please view the PDF!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअगर निःशुल्क पुस्तक चाहिए:\n_If you want free physical book:_\n\n1️⃣ ज्ञान गंगा के लिए *1*\n2️⃣ जीने की राह के लिए *2*\n\nया पुस्तक का नाम लिखें`;
        
        await sock.sendMessage(from, { text: pdfMsg });
      }
      
      state.step = 'pdf_shown';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    if (state.step === 'pdf_shown') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      
      if (!book) {
        await sock.sendMessage(from, { text: `कौनसी पुस्तक order करें?\n_Which book to order?_\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n1 या 2 भेजें` });
        return;
      }
      
      state.bookName = book;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = `✅ *${book}*\n\nकिस भाषा में? | Which language?\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें`;
      
      await sock.sendMessage(from, { text: langMenu });
      state.availableLangs = langs;
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
  } catch (error) {
    console.error(`❌ Message Handler Error: ${error.message}`);
    console.error(error.stack);
  }
}

// ========================= RESEND MENU HELPER =========================
async function resendMenu(sock, from, state, userLang = 'hi') {
  const step = state.step;
  
  if (step === 'awaiting_book' || step === 'awaiting_pdf_book') {
    await sock.sendMessage(from, { text: MESSAGES.welcome[userLang] + '\n\n' + MESSAGES.bookSelection[userLang] });
  }
  else if (step === 'awaiting_language') {
    const bookName = state.bookName || 'ज्ञान गंगा';
    const langs = state.availableLangs || ['हिंदी', 'English'];
    let langMenu = `✅ *${bookName}*\n\nकिस भाषा में?\n\n`;
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
    await sock.sendMessage(from, { text: langMenu });
  }
  else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `अपना *पूरा नाम* भेजें:\n_Your Full Name:_` });
  }
  else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `नाम: *${state.name}*\n\nक्या सही है? | Correct?\n\n✅ *1* / "हाँ"\n❌ *2* / "नहीं"` });
  }
  else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: `*पिता का नाम* लिखें:\n_Father's Name:_` });
  }
  else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `पिता: *${state.father}*\n\nक्या सही है? | Correct?\n\n✅ *1*\n❌ *2*` });
  }
  else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: `*मोबाइल नंबर* (10-digit):\n_Mobile Number:_` });
  }
  else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `मोबाइल: *${state.mobile}*\n\nक्या सही है?\n\n✅ *1*\n❌ *2*` });
  }
  else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: `*पिनकोड* (6-digit):\n_Pincode:_` });
  }
  else if (step === 'awaiting_full_address') {
    await sock.sendMessage(from, { text: `अपना *पूरा पता* लिखें:\n_Complete address:_` });
  }
}

// ========================= INITIALIZATION =========================
export function initializeReporting(sock) {
  console.log('🚀 Initializing Daily Reporting System...');
  scheduleReporting(sock);
  console.log('✅ Daily Reports will be sent at 6:30 PM IST');
}

// ========================= EXPORTS =========================
export default {
  handleMessage,
  initializeReporting,
  getSessionStats,
  sendDailyReports
};
