/**
 * ================================
 * LANGUAGE TRANSLATOR UTILITY
 * ================================
 * Simple language detection and translation helper
 * for Indian languages support
 */

// Language detection based on Unicode ranges
export async function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'hi';
  
  // Unicode ranges for Indian scripts
  const scripts = {
    hi: /[\u0900-\u097F]/, // Devanagari (Hindi/Marathi)
    pa: /[\u0A00-\u0A7F]/, // Gurmukhi (Punjabi)
    bn: /[\u0980-\u09FF]/, // Bengali-Assamese
    te: /[\u0C00-\u0C7F]/, // Telugu
    ta: /[\u0B80-\u0BFF]/, // Tamil
    gu: /[\u0A80-\u0AFF]/, // Gujarati
    kn: /[\u0C80-\u0CFF]/, // Kannada
    ml: /[\u0D00-\u0D7F]/, // Malayalam
    or: /[\u0B00-\u0B7F]/, // Odia
    ur: /[\u0600-\u06FF]/, // Arabic (Urdu)
    sa: /[\u0900-\u097F]/, // Sanskrit (Devanagari)
  };
  
  // Check each script
  for (const [lang, regex] of Object.entries(scripts)) {
    if (regex.test(text)) {
      return lang;
    }
  }
  
  // Check for common English indicators
  if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text)) {
    return 'en';
  }
  
  // Default to Hindi
  return 'hi';
}

// Simple translation mapper (for basic phrases)
export async function translateText(text, targetLang = 'hi') {
  // This is a basic implementation
  // For production, integrate with Google Translate API or similar
  
  const translations = {
    'welcome': {
      hi: 'स्वागत है',
      en: 'Welcome',
      pa: 'ਸੁਆਗਤ ਹੈ',
      bn: 'স্বাগতম',
      te: 'స్వాగతం',
      mr: 'स्वागत',
      ta: 'வரவேற்பு',
      gu: 'સ્વાગત છે',
      kn: 'ಸ್ವಾಗತ',
      ml: 'സ്വാഗതം',
      or: 'ସ୍ୱାଗତ',
      as: 'স্বাগতম',
      ur: 'خوش آمدید'
    },
    'thank you': {
      hi: 'धन्यवाद',
      en: 'Thank you',
      pa: 'ਧੰਨਵਾਦ',
      bn: 'ধন্যবাদ',
      te: 'ధన్యవాదాలు',
      mr: 'धन्यवाद',
      ta: 'நன்றி',
      gu: 'આભાર',
      kn: 'ಧನ್ಯವಾದಗಳು',
      ml: 'നന്ദി',
      or: 'ଧନ୍ୟବାଦ',
      as: 'ধন্যবাদ',
      ur: 'شکریہ'
    },
    'order confirmed': {
      hi: 'ऑर्डर कन्फर्म हो गया',
      en: 'Order confirmed',
      pa: 'ਆਰਡਰ ਕਨਫਰਮ ਹੋ ਗਿਆ',
      bn: 'অর্ডার নিশ্চিত হয়েছে',
      te: 'ఆర్డర్ నిర్ధారించబడింది',
      mr: 'ऑर्डर पुष्टी झाली',
      ta: 'ஆர்டர் உறுதிப்படுத்தப்பட்டது',
      gu: 'ઓર્ડર કન્ફર્મ થયો',
      kn: 'ಆರ್ಡರ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ',
      ml: 'ഓർഡർ സ്ഥിరീകരിച്ചു',
      or: 'ଅର୍ଡର ନିଶ୍ଚିତ ହୋଇଛି',
      as: 'অৰ্ডাৰ নিশ্চিত কৰা হৈছে',
      ur: 'آرڈر کی تصدیق ہو گئی'
    }
  };
  
  const key = text.toLowerCase();
  if (translations[key] && translations[key][targetLang]) {
    return translations[key][targetLang];
  }
  
  // Return original if no translation found
  return text;
}

// Check if text is in a specific language
export function isLanguage(text, langCode) {
  const detected = detectLanguage(text);
  return detected === langCode;
}

// Get language name in native script
export function getLanguageName(langCode) {
  const names = {
    hi: 'हिंदी',
    en: 'English',
    pa: 'ਪੰਜਾਬੀ',
    bn: 'বাংলা',
    te: 'తెలుగు',
    mr: 'मराठी',
    ta: 'தமிழ்',
    gu: 'ગુજરાતી',
    kn: 'ಕನ್ನಡ',
    ml: 'മലയാളം',
    or: 'ଓଡ଼ିଆ',
    as: 'অসমীয়া',
    ur: 'اردو',
    sa: 'संस्कृत',
    ne: 'नेपाली'
  };
  
  return names[langCode] || 'Unknown';
}

// Convert number to words in different languages (for amounts, counts, etc.)
export function numberToWords(num, langCode = 'hi') {
  // Basic implementation for common numbers
  const words = {
    hi: ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस'],
    en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
    pa: ['ਜ਼ੀਰੋ', 'ਇੱਕ', 'ਦੋ', 'ਤਿੰਨ', 'ਚਾਰ', 'ਪੰਜ', 'ਛੇ', 'ਸੱਤ', 'ਅੱਠ', 'ਨੌਂ', 'ਦਸ'],
    bn: ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ'],
    te: ['సున్నా', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది', 'పది'],
    ta: ['பூஜ்யம்', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது', 'பத்து'],
    gu: ['શૂન્ય', 'એક', 'બે', 'ત્રણ', 'ચાર', 'પાંચ', 'છ', 'સાત', 'આઠ', 'નવ', 'દસ'],
    kn: ['ಶೂನ್ಯ', 'ಒಂದು', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು', 'ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು', 'ಹತ್ತು'],
    ml: ['പൂജ്യം', 'ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്', 'ആറ്', 'ഏഴ്', 'എട്ട്', 'ഒമ്പത്', 'പത്ത്'],
    ur: ['صفر', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس']
  };
  
  if (num >= 0 && num <= 10 && words[langCode]) {
    return words[langCode][num];
  }
  
  return num.toString();
}

// Format phone number for different regions
export function formatPhoneNumber(number, countryCode = '91') {
  const cleaned = number.replace(/[^0-9]/g, '');
  
  if (cleaned.length === 10) {
    return `+${countryCode}${cleaned}`;
  }
  
  return cleaned;
}

// Validate Indian language text
export function isValidIndianText(text) {
  const indianScriptRegex = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF]/;
  const englishRegex = /[a-zA-Z]/;
  
  return indianScriptRegex.test(text) || englishRegex.test(text);
}

// Get greeting based on time and language
export function getGreeting(langCode = 'hi') {
  const hour = new Date().getHours();
  
  const greetings = {
    morning: {
      hi: 'सुप्रभात',
      en: 'Good Morning',
      pa: 'ਸ਼ੁਭ ਸਵੇਰ',
      bn: 'সুপ্রভাত',
      te: 'శుభోదయం',
      mr: 'सुप्रभात',
      ta: 'காலை வணக்கம்',
      gu: 'સુપ્રભાત',
      kn: 'ಶುಭೋದಯ',
      ml: 'സുപ്രഭാതം',
      or: 'ସୁପ୍ରଭାତ',
      ur: 'صبح بخیر'
    },
    afternoon: {
      hi: 'नमस्ते',
      en: 'Good Afternoon',
      pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',
      bn: 'শুভ অপরাহ্ণ',
      te: 'శుభ మధ్యాహ్నం',
      mr: 'नमस्कार',
      ta: 'மதிய வணக்கம்',
      gu: 'નમસ્તે',
      kn: 'ನಮಸ್ಕಾರ',
      ml: 'നമസ്കാരം',
      or: 'ନମସ୍କାର',
      ur: 'السلام علیکم'
    },
    evening: {
      hi: 'शुभ संध्या',
      en: 'Good Evening',
      pa: 'ਸ਼ੁਭ ਸੰਧਿਆ',
      bn: 'শুভ সন্ধ্যা',
      te: 'శుభ సాయంత్రం',
      mr: 'शुभ संध्याकाळ',
      ta: 'மாலை வணக்கம்',
      gu: 'શુભ સાંજ',
      kn: 'ಶುಭ ಸಂಜೆ',
      ml: 'ശുഭ സന്ധ്യ',
      or: 'ଶୁଭ ସନ୍ଧ୍ୟା',
      ur: 'شام بخیر'
    },
    night: {
      hi: 'शुभ रात्रि',
      en: 'Good Night',
      pa: 'ਸ਼ੁਭ ਰਾਤਰੀ',
      bn: 'শুভ রাত্রি',
      te: 'శుభ రాత్రి',
      mr: 'शुभ रात्री',
      ta: 'இரவு வணக்கம்',
      gu: 'શુભ રાત્રિ',
      kn: 'ಶುಭ ರಾತ್ರಿ',
      ml: 'ശുഭ രാത്രി',
      or: 'ଶୁଭ ରାତ୍ରି',
      ur: 'شب بخیر'
    }
  };
  
  let timeOfDay = 'morning';
  if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else if (hour >= 21 || hour < 5) timeOfDay = 'night';
  
  return greetings[timeOfDay][langCode] || greetings[timeOfDay]['hi'];
}

// Export all functions
export default {
  detectLanguage,
  translateText,
  isLanguage,
  getLanguageName,
  numberToWords,
  formatPhoneNumber,
  isValidIndianText,
  getGreeting
};
