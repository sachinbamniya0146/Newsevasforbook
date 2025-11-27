import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { sendToOrderGroup } from '../utils/groupManager.js';
import CONFIG from '../config.js';
import fs from 'fs';

const userStates = new Map();
const orderCounters = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();

// 📚 Enhanced Book Descriptions Rotation (60+ variations)
const BOOK_DESCRIPTIONS = [
  "इस पुस्तक में सच्चे आध्यात्मिक ज्ञान का खजाना है जो आपके जीवन की सभी समस्याओं का समाधान देता है। | This book contains the treasure of true spiritual knowledge that solves all life problems.",
  "यह पुस्तक आपको बताती है कि परमात्मा को कैसे पाएं और मोक्ष कैसे प्राप्त करें। सद्ग्रंथों के प्रमाण सहित। | Learn how to attain God and salvation with evidence from holy scriptures.",
  "जीवन की सभी परेशानियों - बीमारी, गरीबी, दुख - से मुक्ति का सही तरीका इस पुस्तक में है। | The right way to get rid of all troubles - disease, poverty, sorrow - is in this book.",
  "यह पुस्तक हजारों लोगों की ज़िंदगी बदल चुकी है! आध्यात्मिक ज्ञान से भरपूर। | This book has changed thousands of lives! Full of spiritual knowledge.",
  "परमात्मा कबीर साहेब का सच्चा परिचय और पूर्ण मोक्ष का मार्ग इस पुस्तक में है। | True introduction of Supreme God Kabir and path to complete salvation in this book.",
  "सच्चे संत की पहचान कैसे करें? सतभक्ति क्या है? जानें इस पुस्तक में। | How to identify true saint? What is true worship? Learn in this book.",
  "वेदों, गीता, कुरान, बाइबिल का वास्तविक अर्थ समझें। सभी धर्मों का सार एक है। | Understand real meaning of Vedas, Geeta, Quran, Bible. Essence of all religions is one.",
  "जन्म-मृत्यु के चक्र से छुटकारा पाने का एकमात्र तरीका इस पुस्तक में बताया गया है। | The only way to escape birth-death cycle is explained in this book.",
  "84 लाख योनियों में भटकने से बचें। सतनाम और सारनाम की महिमा जानें। | Avoid wandering in 8.4 million species. Learn glory of Satnam and Saarnam.",
  "काल के जाल से कैसे बचें? सतलोक कैसे जाएं? पूरी जानकारी इस पुस्तक में। | How to escape trap of Kaal? How to reach Satlok? Complete information in this book.",
  "मोक्ष प्राप्ति का सही मार्ग संत रामपाल जी महाराज ने इस पुस्तक में बताया है। | Sant Rampal Ji Maharaj has shown the right path to salvation in this book.",
  "इस पुस्तक में जीवन जीने की सही कला सिखाई गई है जो सुख-शांति देती है। | This book teaches the right art of living that gives peace and happiness.",
  "धर्म के नाम पर हो रहे पाखंड का भंडाफोड़! सच्चा धर्म क्या है जानें। | Exposure of hypocrisy in religion! Learn what true religion is.",
  "कबीर साहेब की अमृतवाणी का सही अर्थ इस पुस्तक में समझाया गया है। | True meaning of Kabir Saheb's nectar words explained in this book.",
  "रोग, शोक, दुख से हमेशा के लिए मुक्ति चाहते हैं? यह पुस्तक पढ़ें। | Want permanent freedom from disease, grief, sorrow? Read this book.",
  "सच्चे सतगुरु की शरण में जाने से सभी पाप धुल जाते हैं। जानें कैसे। | Taking refuge of true Satguru washes away all sins. Learn how.",
  "भक्ति करने की सही विधि नहीं जानते? इस पुस्तक में step-by-step बताया गया है। | Don't know right method of worship? Step-by-step explained in this book.",
  "पूर्ण ब्रह्म कौन है? अपूर्ण ब्रह्म कौन है? भेद समझें इस पुस्तक में। | Who is complete God? Who is incomplete God? Understand difference in this book.",
  "सृष्टि रचना का वास्तविक रहस्य जो कहीं नहीं मिलेगा, इस पुस्तक में है। | Real secret of creation that you won't find anywhere is in this book.",
  "मनुष्य जीवन का असली उद्देश्य क्या है? पैसा कमाना या मोक्ष पाना? जानें। | What is real purpose of human life? Earning money or attaining salvation? Learn.",
  "स्वर्ग-नरक से परे सतलोक है जहां कोई दुख नहीं। कैसे पहुंचें? पुस्तक पढ़ें। | Beyond heaven-hell is Satlok where there is no sorrow. How to reach? Read book.",
  "काल लोक में सभी दुखी हैं। सतलोक में सदा सुख है। अंतर जानें। | Everyone is sad in Kaal Lok. There is eternal happiness in Satlok. Know difference.",
  "भगवान और पूर्ण परमात्मा में बहुत बड़ा अंतर है। समझें इस पुस्तक में। | There is huge difference between God and Supreme God. Understand in this book.",
  "अवतारों (राम, कृष्ण) का सच्चा रहस्य क्या है? पूरी जानकारी पुस्तक में। | What is true mystery of incarnations (Ram, Krishna)? Complete info in book.",
  "पाप-पुण्य का सिद्धांत और कर्म का नियम सही तरीके से समझाया गया है। | Principle of sin-virtue and law of karma explained properly.",
  "धर्म ग्रंथों (गीता, वेद, कुरान) के गूढ़ रहस्य खोले गए हैं इस पुस्तक में। | Deep secrets of holy scriptures (Geeta, Vedas, Quran) revealed in this book.",
  "सच्ची भक्ति करने से जीवन में चमत्कार होते हैं। उदाहरण सहित बताया गया है। | Miracles happen in life through true worship. Explained with examples.",
  "गरीबदास जी की अमृतवाणी का सार इस पुस्तक में दिया गया है। | Essence of Garibdas Ji's nectar words given in this book.",
  "नानक देव जी ने जो सच्चा ज्ञान दिया, वह इस पुस्तक में विस्तार से बताया है। | True knowledge given by Nanak Dev Ji explained in detail in this book.",
  "घोर कलयुग में मोक्ष पाने का यह एकमात्र उपाय है। समय बर्बाद मत करें। | This is the only way to attain salvation in this dark age. Don't waste time.",
  "तत्वज्ञान पढ़कर हजारों लोगों का जीवन बदल गया। आप भी बदल सकते हैं। | Thousands changed their lives after reading Tatvagyan. You can change too.",
  "सतगुरु की कृपा से असंभव भी संभव हो जाता है। विश्वास रखें। | Even impossible becomes possible by grace of Satguru. Have faith.",
  "जीते जी मुक्ति पाने का उपाय इस पुस्तक में बताया गया है। मरने का इंतजार मत करें। | Way to attain liberation while alive explained in this book. Don't wait for death.",
  "सच्चे धर्म और पाखंड में बहुत फर्क है। सावधान रहें, धोखा न खाएं। | Big difference between true religion and hypocrisy. Be careful, don't get cheated.",
  "आत्मा और परमात्मा का सच्चा संबंध समझें। हम सब उसी के अंश हैं। | Understand true relationship between soul and Supreme Soul. We are all His parts.",
  "भक्ति मार्ग की विभिन्न साधनाएं बताई गई हैं। अपनी सुविधा अनुसार करें। | Various practices of devotion path explained. Do according to your convenience.",
  "संत रामपाल जी महाराज का जीवन परिचय प्रेरणादायक है। पढ़कर जीवन बदलें। | Life of Sant Rampal Ji Maharaj is inspiring. Change your life after reading.",
  "इस पुस्तक को पढ़कर लाखों लोगों ने नाम दीक्षा ली और सुखी हो गए। | Millions took Naam initiation after reading this book and became happy.",
  "आध्यात्मिक जिज्ञासा का पूरा समाधान इस पुस्तक में है। सभी प्रश्नों के उत्तर हैं। | Complete solution to spiritual curiosity in this book. Answers to all questions.",
  "यह पुस्तक आपके परिवार के लिए अमूल्य है। सबको पढ़ाएं। | This book is priceless for your family. Make everyone read.",
  "सच्चे ज्ञान से जीवन में सफलता और शांति दोनों मिलती है। | True knowledge gives both success and peace in life.",
  "इस पुस्तक में वह ज्ञान है जो किसी स्कूल-कॉलेज में नहीं मिलेगा। | This book has knowledge you won't get in any school-college.",
  "पूर्ण संत की पहचान करना बहुत जरूरी है। गलत गुरु से सावधान रहें। | Identifying complete saint is very important. Beware of wrong guru.",
  "नाम दीक्षा लेने से सभी पाप नष्ट हो जाते हैं। मुफ्त है, जल्दी लें। | Taking Naam initiation destroys all sins. It's free, take it soon.",
  "मृत्यु के बाद क्या होता है? कहां जाते हैं? जानकारी इस पुस्तक में। | What happens after death? Where do we go? Information in this book.",
  "गरीबी, बीमारी से परेशान हैं? भक्ति का सही तरीका जानें इस पुस्तक में। | Troubled by poverty, disease? Learn right way of devotion in this book.",
  "परिवार में झगड़े हो रहे हैं? सुख-शांति चाहिए? यह पुस्तक पढ़ें। | Family disputes happening? Want peace? Read this book.",
  "मन की शांति कैसे पाएं? तनाव से मुक्ति कैसे मिले? उपाय पुस्तक में। | How to get peace of mind? How to get rid of stress? Solutions in book.",
  "सच्चा सुख क्या है? पैसा-दौलत से नहीं मिलता। जानें सही तरीका। | What is true happiness? Money-wealth doesn't give it. Learn right way.",
  "भगवान को कैसे पाएं? प्रार्थना-पूजा सही तरीके से कैसे करें? पुस्तक पढ़ें। | How to attain God? How to pray-worship correctly? Read book.",
  "यह पुस्तक 100% निःशुल्क है। कोई चार्ज नहीं। घर तक डिलीवरी फ्री। | This book is 100% free. No charges. Home delivery free.",
  "ज्ञान गंगा पुस्तक में 1000+ पेज का आध्यात्मिक ज्ञान है। अमूल्य है। | Gyan Ganga book has 1000+ pages of spiritual knowledge. Priceless.",
  "जीने की राह पुस्तक सभी धर्मों के लोग पढ़ सकते हैं। सबके लिए है। | Way of Living book can be read by people of all religions. For everyone.",
  "इस पुस्तक में प्रमाण सहित ज्ञान है। अंधविश्वास नहीं, विज्ञान है। | This book has knowledge with proof. Not superstition, it's science.",
  "मोक्ष पाने की गारंटी इस पुस्तक में बताए गए तरीके से है। | Guarantee of attaining salvation is with method explained in this book.",
  "समय बहुत कम है। मानव जीवन दुर्लभ है। जल्दी पुस्तक मंगाएं। | Time is very less. Human life is rare. Order book quickly.",
  "आपके परिवार का कल्याण इस पुस्तक से होगा। सबको दें। | Your family's welfare will happen from this book. Give to everyone.",
  "यह पुस्तक जीवन बदल देने वाली है। एक बार जरूर पढ़ें। | This book is life-changing. Must read once.",
  "सच्चा धर्म, सच्ची भक्ति, सच्चा ज्ञान - सब इस पुस्तक में है। | True religion, true worship, true knowledge - everything in this book.",
  "दुनियाभर में लाखों लोग इस ज्ञान को अपना चुके हैं। आप भी अपनाएं। | Millions worldwide have adopted this knowledge. You adopt too."
];

function getRandomDescription() {
  return BOOK_DESCRIPTIONS[Math.floor(Math.random() * BOOK_DESCRIPTIONS.length)];
}

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हाँ','done','order','yes.','ok.','haan.','haa','y','Y','ha.','ہاں','ji','जी','han','theek'];
  return yes.includes(txt.trim().toLowerCase());
}
function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','no.','nahi.','nope','नहि','n','N','nhi','cancel','نہیں','galat'];
  return no.includes(txt.trim().toLowerCase());
}
function isBack(txt) {
  const back = ['back','वापस','peeche','0','⬅️','पीछे','vapas'];
  return back.includes(txt.trim().toLowerCase());
}
function autoBook(text) {
  const low = text.trim().toLowerCase();
  if (low.includes('ganga') || low.includes('ज्ञान')) return 'ज्ञान गंगा';
  if (low.includes('jeene') || low.includes('जीने') || low.includes('living') || low.includes('राह')) return 'जीने की राह';
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
    const files = fs.readdirSync(base).filter(f => f.match(/.(jpg|jpeg|png)$/i));
    if (!files.length) return null;
    const idx = Math.abs((userJid || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % files.length;
    return base + files[idx];
  } catch {
    return null;
  }
}
function scheduleReminder(sock, from, state, sessionName, isAdmin) {
  if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
  const reminderTime = 6 * 60 * 60 * 1000;
  reminderTimeouts.set(from, setTimeout(async () => {
    if (userStates.has(from)) {
      const imgPath = getRotatedImage(from);
      let remTxt = isAdmin
        ? `🛠️ *[Admin Test Mode Reminder]*
आप अभी भी Test-Mode में हैं।
(You are still in Test Mode!)
(Reply 'exit' या 0 छोड़ने के लिए)`
        : `🙏 आपकी निःशुल्क पुस्तक का ऑर्डर अधूरा है!
Your free book order is pending.
कृपया reply करें शुरू करने हेतु।`;
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: remTxt });
      } else {
        await sock.sendMessage(from, { text: remTxt });
      }
    }
  }, reminderTime));
}

async function resendMenu(sock, from, state) {
  const step = state.step;
  if (step === 'awaiting_book' || step === 'awaiting_pdf_book') {
    const randomDesc = getRandomDescription();
    const welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा
_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।
_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*कौनसी पुस्तक चाहिए?*
_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)

*1 भेजें यदि ज्ञान गंगा चाहिए*
*2 भेजें यदि जीने की राह चाहिए*
*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`;
    await sock.sendMessage(from, { text: welcome });
  } else if (step === 'awaiting_language') {
    const bookName = state.bookName || 'ज्ञान गंगा';
    const langs = state.availableLangs || (CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[bookName] ? Object.keys(CONFIG.BOOK_PDFS[bookName]) : ['हिंदी', 'English']);
    let langMenu = "";
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}
`);
    await sock.sendMessage(from, { text: `✅ *${bookName}* चुना।
✍️ लेखक: संत रामपाल जी महाराज
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
किस भाषा में?
Which language?

${langMenu}
भाषा का नंबर भेजें (Send language number)` });
  } else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `✅ भाषा: *${state.language || 'हिंदी'}*

अब अपना *पूरा नाम* भेजें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Full Name:
उदाहरण (Example): राज कुमार शर्मा` });
  } else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
क्या सही है? | Is it correct?

✅ सही है तो: *1* / "हाँ" / "Yes"
❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Father's Name:
उदाहरण (Example): संतोष कुमार शर्मा` });
  } else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
क्या सही है? | Is it correct?

✅ सही है तो: *1* / "हाँ" / "Yes"
❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mobile Number:
उदाहरण (Example): 9876543210` });
  } else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
क्या सही है? | Is it correct?

✅ सही है तो: *1* / "हाँ" / "Yes"
❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pincode:
उदाहरण (Example): 110001` });
  } else if (step === 'awaiting_village') {
    let menu = "";
    if (state.villages && state.villages.length) {
      state.villages.forEach((v, i) => menu += `${i + 1}. ${v.split(', ')[0]}
`);
    }
    await sock.sendMessage(from, { text: `✅ पिनकोड: *${state.pincode}*
📍 डिस्ट्रिक्ट: ${state.district || ''}
📍 राज्य: ${state.stateName || ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*अपना गांव/शहर चुनें:*
Select your village/city:

${menu}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
नंबर भेजें (Send number)` });
  } else if (step === 'awaiting_confirmation') {
    await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ऑर्डर कन्फर्मेशन*
_Order Confirmation_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
नाम (Name): ${state.name}
पिता (Father): ${state.father}
मोबाइल (Mobile): +91${state.mobile}
पुस्तक (Book): ${state.bookName}
भाषा (Language): ${state.language}
पता (Address): ${state.address}
पिनकोड (Pincode): ${state.pincode}
डिस्ट्रिक्ट (District): ${state.district}
राज्य (State): ${state.stateName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
    await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"
❌ *Cancel* के लिए: *2* / "no" / "cancel"

अपना जवाब भेजें (Send your reply):` });
  }
}

export async function handleMessage(sock, msg, sessionName = 'WhatsApp') {
  try {
    const from = msg.key?.remoteJid ?? msg.key?.participant ?? '';
    if (!from) return;
    if (from.endsWith('@g.us')) {
      console.log('Ignoring group message from:', from);
      return;
    }
    const textRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const text = textRaw.trim();
    if (!text) return;
    const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
    let state = userStates.get(from) || {};

    if (isAdmin) {
      let imgPath = getRotatedImage(from);
      if (!state.testMode) {
        if (text.toLowerCase() === "test" || text === "1") {
          state.testMode = true;
          userStates.set(from, state);
          if (imgPath && fs.existsSync(imgPath)) {
            await sock.sendMessage(from, { image: { url: imgPath }, caption: `🛠️ *Test Mode activated for admin!*
हर message पर image जाएगा।
(Reply '0'/exit to leave)` });
          } else {
            await sock.sendMessage(from, { text: `🛠️ *Test Mode activated for admin!*
(Reply '0'/exit to leave)` });
          }
          scheduleReminder(sock, from, state, sessionName, true);
          return;
        }
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: `Admin verified!
Test Mode चालू करने के लिए 'test' या 1 भेजें।` });
        } else {
          await sock.sendMessage(from, { text: `Admin verified!
Test Mode चालू करने के लिए 'test' या 1 भेजें।` });
        }
        return;
      }
      if (text.toLowerCase() === "exit" || text === "0") {
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        await sock.sendMessage(from, { text: "🚫 Test Mode समाप्त! (Exited Test Mode)" });
        return;
      }
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: `🔁 *[Test Mode]*
Admin message: "${text}"
(Reply '0'/exit to leave)` });
      } else {
        await sock.sendMessage(from, { text: `🔁 *[Test Mode]*
Admin message: "${text}"
(Reply '0'/exit to leave)` });
      }
      scheduleReminder(sock, from, state, sessionName, true);
      return;
    }

    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const remindText = `🙏 आपका ऑर्डर पहले ही दर्ज हो चुका है!
Your order is already placed!

नया ऑर्डर ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} घंटे बाद कर सकते हैं।
You can place new order after ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} hours.`;
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

    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      let welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा
_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।
_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*कौनसी पुस्तक चाहिए?*
_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)

*1 भेजें यदि ज्ञान गंगा चाहिए*
*2 भेजें यदि जीने की राह चाहिए*
*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`;

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

    state = userStates.get(from);
    state.lastActive = Date.now();
    userStates.set(from, state);

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
        awaiting_village: 'awaiting_pincode',
        awaiting_confirmation: 'awaiting_village',
        awaiting_pdf_language: 'awaiting_pdf_book',
        pdf_shown: 'awaiting_book'
      };
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `⬅️ पिछला स्टेप चालू हो गया!
_Previous step resumed!_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
        await resendMenu(sock, from, state);
      }
      return;
    }

    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक का PDF देखना चाहते हैं?
Which book PDF do you want to see?

📖 ${randomDesc}

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)

1 या 2 भेजें (Send 1 or 2)

⬅️ पीछे जाने के लिए *0* भेजें
_Send *0* to go back_` });
        return;
      }
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}
`);
      await sock.sendMessage(from, { text: `✅ *${book}* PDF

किस भाषा में पढ़ना चाहते हैं?
Which language?

${langMenu}
भाषा का नंबर भेजें (Send language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
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
        await sock.sendMessage(from, { text: `❌ सही भाषा नंबर भेजें। (Send correct language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.pdfBook] && CONFIG.BOOK_PDFS[state.pdfBook][langSelected] ? CONFIG.BOOK_PDFS[state.pdfBook][langSelected] : '';
      const randomDesc = getRandomDescription();
      if (pdfLink) {
        await sock.sendMessage(from, { text: `📖 *${state.pdfBook} (${langSelected})* PDF:

${pdfLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *इस पुस्तक में:*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 कृपया PDF देखें और हमें बताएं!
Please view the PDF and let us know!

अगर आपको निःशुल्क पुस्तक चाहिए तो अपना नाम, पता भेजें।
If you want the free physical book, send us your name & address.

1️⃣ ज्ञान गंगा (Gyan Ganga) के लिए 1 भेजें
2️⃣ जीने की राह (Way of Living) के लिए 2 भेजें

या पुस्तक का नाम लिखें। (Or write book name directly)` });
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
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक ऑर्डर करना चाहते हैं?
Which book do you want to order?

📖 ${randomDesc}

1️⃣ ज्ञान गंगा
2️⃣ जीने की राह

1 या 2 भेजें

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}
`);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।
✍️ लेखक: संत रामपाल जी महाराज
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
किस भाषा में?
Which language?

${langMenu}
भाषा का नंबर भेजें (Send language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `📖 पहले PDF देखना चाहते हैं!
You want to see PDF first!

${randomDesc}

कौनसी पुस्तक का PDF?
Which book PDF?

1️⃣ ज्ञान गंगा
2️⃣ जीने की राह

1 या 2 भेजें (Send 1 or 2)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      } else {
        book = autoBook(text);
      }
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `❌ कृपया 1, 2, या 3/pdf भेजें।
_Send 1, 2, or 3/pdf._

📖 ${randomDesc}

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}
`);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।
✍️ लेखक: संत रामपाल जी महाराज
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
किस भाषा में?
Which language?

${langMenu}
भाषा का नंबर भेजें (Send language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

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
        await sock.sendMessage(from, { text: `❌ सही भाषा नंबर भेजें। (Send correct language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.language = langSelected;
      await sock.sendMessage(from, { text: `✅ भाषा (Language): *${state.language}*

अब अपना *पूरा नाम* भेजें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Full Name:
उदाहरण (Example): राज कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_name') {
      state.name = text;
      await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
क्या आपने सही (Correct) नाम लिखा है?
Is the name above correct?

✅ सही है तो reply करें: *1* / "हाँ" / "Yes"
❌ बदलना है तो reply करें: *2* / "नहीं" / "No"

उदाहरण (Example): 1

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    if (state.step === 'confirm_name') {
      if (isNo(text)) {
        state.step = 'awaiting_name';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं! (No problem!)
कृपया फिर से अपना *पूरा नाम* लिखें:
Re-enter your full name:

उदाहरण (Example): राज कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया सही जवाब दें:

✅ सही है तो: *1* / "हाँ" / "Yes"
❌ नहीं तो: *2* / "नहीं" / "No"

Please reply *1* (Yes) or *2* (No)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Father's Name:
उदाहरण (Example): संतोष कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_father') {
      state.father = text;
      await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
क्या ऊपर लिखा *पिता का नाम* सही है?
Is your father's name correct?

✅ सही है तो reply करें: *1* / "हाँ" / "Yes"
❌ बदलना है तो reply करें: *2* / "नहीं" / "No"

उदाहरण (Example): 1

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    if (state.step === 'confirm_father') {
      if (isNo(text)) {
        state.step = 'awaiting_father';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं! (No problem!)
फिर से *पिता का नाम* लिखें:
Re-enter father's name:

उदाहरण (Example): संतोष कुमार

⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया सही जवाब दें:

✅ सही है तो: *1* / "हाँ" / "Yes"
❌ नहीं तो: *2* / "नहीं" / "No"

Please reply *1* (Yes) or *2* (No)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mobile Number:
उदाहरण (Example): 9876543210

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_mobile') {
      const mob = text.replace(/[^0-9]/g, "");
      if (mob.length !== 10) {
        await sock.sendMessage(from, { text: `❌ 10 अंक का नंबर दें
(Enter 10-digit mobile number)

उदाहरण (Example): 9876543210

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      const dupKey = `${state.name.toLowerCase().trim()}_${mob}`;
      if (duplicateOrders.has(dupKey)) {
        await sock.sendMessage(from, { text: `⚠️ *आपने पहले ही ऑर्डर कर दिया है!*
You have already placed an order before!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
अब आप मुफ्त में पुस्तक नहीं ले सकते हैं।
You cannot get a free book again.

अगर कोई पड़ोसी/मित्र को निःशुल्क पुस्तक देनी है, तो उनके नंबर से हमें मैसेज करवा दो।
If you want to send a free book to a neighbor/friend, ask them to message us from their number.

🙏 धन्यवाद! Thank you!` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }
      state.mobile = mob;
      await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
क्या यह मोबाइल नंबर सही है?
Is this mobile number correct?

✅ सही है तो: *1* / "हाँ" / "Yes"
❌ नहीं तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    if (state.step === 'confirm_mobile') {
      if (isNo(text)) {
        state.step = 'awaiting_mobile';
        await sock.sendMessage(from, { text: `फिर से 10-digit मोबाइल नंबर भेजें:
Re-enter 10-digit mobile:

उदाहरण (Example): 9876543210

⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हाँ) या *2* (No/नहीं) भेजें।

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pincode:
उदाहरण (Example): 110001

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_pincode';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_pincode') {
      const pin = text.replace(/[^0-9]/g, "");
      if (pin.length !== 6) {
        await sock.sendMessage(from, { text: `❌ 6 अंक का पिनकोड दर्ज करें
(Enter 6-digit pincode)

उदाहरण (Example): 110001

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      let locs = [];
      for (let i = 0; i < 10; i++) {
        const pinInfo = await fetchPinDetails(pin);
        if (pinInfo && pinInfo.success && pinInfo.locations && pinInfo.locations.length) {
          locs = pinInfo.locations;
          break;
        }
        await new Promise(r => setTimeout(r, 900));
      }
      if (!locs.length) {
        await sock.sendMessage(from, { text: `❌ पिनकोड verify नहीं हुआ। फिर से try करें।
(Pincode verification failed. Try again.)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.pincode = pin;
      state.district = locs[0].split(', ')[2] || '';
      state.stateName = locs[0].split(', ')[3] || '';
      state.villages = locs;
      let menu = "";
      locs.forEach((v, i) => menu += `${i + 1}. ${v.split(', ')[0]}
`);
      await sock.sendMessage(from, { text: `✅ पिनकोड (Pincode): *${pin}*
📍 डिस्ट्रिक्ट (District): ${state.district}
📍 राज्य (State): ${state.stateName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*अपना गांव/शहर चुनें:*
Select your village/city:

${menu}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
नंबर भेजें (Send number)

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_village';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_village') {
      let sel = null;
      const idx = parseInt(text) - 1;
      if (!isNaN(idx) && idx >= 0 && state.villages && idx < state.villages.length) {
        sel = state.villages[idx].split(', ')[0];
      } else if (state.villages) {
        const match = state.villages.find(v => v.split(', ')[0].toLowerCase() === text.toLowerCase());
        if (match) sel = match.split(', ')[0];
      }
      if (!sel) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.address = sel;
      await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ऑर्डर कन्फर्मेशन*
_Order Confirmation_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
नाम (Name): ${state.name}
पिता (Father): ${state.father}
मोबाइल (Mobile): +91${state.mobile}
पुस्तक (Book): ${state.bookName}
भाषा (Language): ${state.language}
पता (Address): ${state.address}
पिनकोड (Pincode): ${state.pincode}
डिस्ट्रिक्ट (District): ${state.district}
राज्य (State): ${state.stateName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"
❌ *Cancel* के लिए: *2* / "no" / "cancel"

अपना जवाब भेजें (Send your reply):

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    if (state.step === 'awaiting_confirmation') {
      if (isNo(text)) {
        await sock.sendMessage(from, { text: `❌ ऑर्डर रद्द!
Order Cancelled!` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1*/yes/order/done या *2*/no/cancel भेजें
(Please send *1* to confirm or *2* to cancel)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }

      const dupKey = `${state.name.toLowerCase().trim()}_${state.mobile}`;
      duplicateOrders.set(dupKey, Date.now());

      const orderData = {
        name: state.name,
        father: state.father,
        mobile: state.mobile,
        bookName: state.bookName,
        language: state.language,
        address: state.address,
        pincode: state.pincode,
        district: state.district,
        stateName: state.stateName,
        whatsapp: from,
        timestamp: new Date().toISOString()
      };
      await saveOrder(orderData);
      
      const orderCount = updateOrderCount(sessionName);
      const now = new Date();
      const dateStr = now.toLocaleDateString('hi-IN');
      const timeStr = now.toLocaleTimeString('hi-IN');
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.bookName] && CONFIG.BOOK_PDFS[state.bookName][state.language] ? CONFIG.BOOK_PDFS[state.bookName][state.language] : '';
      
      if (pdfLink) {
        await sock.sendMessage(from, { text: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*
_Your order is placed successfully!_

📖 *${state.bookName} (${state.language})* PDF:
${pdfLink}

🙏 धन्यवाद! Thank you!` });
      }
      if (CONFIG.USER_GROUP_LINK) {
        await sock.sendMessage(from, { text: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*
_Join our WhatsApp group:_

${CONFIG.USER_GROUP_LINK}` });
      }
      
      const fwMsg = `📦 *नया ऑर्डर!* (Order #${orderCount})
📅 Date: ${dateStr}
⏰ Time: ${timeStr}
📱 Session: ${sessionName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
नाम (Name): ${state.name}
पिता (Father): ${state.father}
मोबाइल (Mobile): +91${state.mobile}
पुस्तक (Book): ${state.bookName}
भाषा (Language): ${state.language}
पता (Address): ${state.address}
पिनकोड (Pincode): ${state.pincode}
डिस्ट्रिक्ट (District): ${state.district}
राज्य (State): ${state.stateName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      try {
        if (CONFIG.ADMIN && CONFIG.ADMIN.JID) {
          await sock.sendMessage(CONFIG.ADMIN.JID, { text: fwMsg });
        }
      } catch (e) {
        console.error('Admin send error:', e);
      }
      
      await sendToOrderGroup(sock, sessionName, fwMsg);
      
      userOrderCompleted.set(from, Date.now());
      userStates.delete(from);
      if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      return;
    }

  } catch (err) {
    console.error('Handler error:', err);
    try {
      const from = msg.key?.remoteJid ?? msg.key?.participant ?? '';
      if (from && !from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: `❌ त्रुटि आई! (Error occurred!)
फिर से try करें। (Please try again.)` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      }
    } catch (e2) {
      console.error('Error in error handler:', e2);
    }
  }
}
