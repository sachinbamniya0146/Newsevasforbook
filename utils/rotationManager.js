import fs from 'fs';
import path from 'path';

// ✅ Correct Termux/Android internal storage path
const IMAGE_FOLDER = '/storage/emulated/0/DCIM/gyan ganga seva';

const userImageTracking = new Map();
const userDescriptionTracking = new Map();
const userEngagementTracking = new Map();

// 50+ Best Extended Bilingual Descriptions (Pure Bhakti & Knowledge)
const DESCRIPTIONS = [
  "📖 *ज्ञान गंगा पुस्तक* - पूर्ण परमात्मा कौन है? Complete knowledge of Supreme God! वेद-गीता-कुरान-बाइबिल का सार। 100% FREE book + home delivery!",
  "📚 *जीने की राह पुस्तक* - True worship method that transforms lives! सच्ची भक्ति विधि और शास्त्र प्रमाणित साधना। Free book at your doorstep.",
  "🌟 *वेद-गीता-कुरान-बाइबिल का सार* - Essence of all holy scriptures! जानिए सभी धर्मग्रंथों में छिपे पूर्ण परमात्मा कबीर साहेब के प्रमाण। FREE book!",
  "✨ *संत की पहचान* - Real Saint identification! सच्चे संत के 17 लक्षण जानें। नकली गुरुओं से बचें। 100% FREE!",
  "🙏 *मोक्ष का मार्ग* - Path to salvation! सतभक्ति से 84 लाख योनियों से छुटकारा। Book FREE!",
  "📕 *कौन है पूर्ण परमात्मा?* - Who is the complete God? परमेश्वर कबीर साहेब ही पूर्ण ब्रह्म हैं। Free delivery!",
  "🔥 *काल लोक vs सतलोक* - Truth about temporary and eternal worlds! Sant Rampal Ji's divine knowledge - FREE!",
  "💫 *भगवद गीता अध्याय 15:1-4* - Real meaning revealed! गीता का वास्तविक ज्ञानदाता ब्रह्म/काल है। Order free book now!",
  "🌺 *सच्ची भक्ति से चमत्कार* - True devotion removes all sorrows! रोग-शोक-गरीबी मिटती है। Free book!",
  "📗 *84 लाख योनियों से छुटकारा* - Freedom from 84 lakh life forms forever! 100% Free Book with home delivery!",
  "🕉️ *वेदों में कबीर साहेब* - Kabir is Supreme God - Vedic evidence! यजुर्वेद 5:32, 40:13 में साफ प्रमाण। FREE!",
  "🌸 *सतगुरु की शरण* - All problems solved in True Guru's shelter! Real life examples - Free!",
  "📘 *गीता ज्ञान दाता काल है* - Brahm/Kaal is not immortal! True immortal God Kabir Saheb revealed - Free!",
  "🔔 *मानव जीवन का उद्देश्य* - Purpose of human life explained! 100% FREE book!",
  "⭐ *सतनाम और सारनाम* - Glory of true mantras! Order free book today!",
  "📙 *तत्वज्ञान* - Brahm, ParBrahm, Param Akshar Purush explained! Free home delivery!",
  "🌼 *जीवन में शांति-सुख* - Peace, happiness, prosperity! Free book!",
  "🎯 *धर्मग्रंथों के रहस्य* - Deep secrets of scriptures! Sant Rampal Ji's book FREE!",
  "📕 *सृष्टि रचना का सत्य* - Creation Theory! How universe was created - Free Book!",
  "🌟 *ब्रह्मा-विष्णु-शिव से ऊपर* - Who is above three gods? Answer in book - FREE!",
  "💐 *सच्चे संत के लक्षण* - 17 Signs of True Saint! Gyan Ganga book FREE!",
  "📖 *गरीब निवाज़ कबीर* - Kabir is merciful Supreme God! Free book!",
  "✅ *पाप से मुक्ति* - Freedom from sins! Book FREE!",
  "🌺 *सतलोक अमर है* - Beyond heaven-hell is Satlok! Free book!",
  "📚 *शास्त्र अनुकूल भक्ति* - Worship according to scriptures! FREE!",
  "🔥 *मृत्यु के बाद क्या?* - What after death? Soul's journey - Book FREE!",
  "🌸 *दुख-रोग का समाधान* - Solution to all problems! Free book!",
  "📗 *सतभक्ति के चमत्कार* - Miracles through devotion! Real examples - Free!",
  "🙏 *गुरु-शिष्य परंपरा* - Guru-disciple tradition! Way of Living FREE!",
  "⭐ *कबीर साहेब का आगमन* - Kabir came millions of years ago! Proof FREE!",
  "📘 *सच्चे धर्म की पहचान* - True religion! Essence of all faiths - Free!",
  "🌼 *परमेश्वर साकार है* - God has form! Truth revealed - FREE!",
  "🔔 *गीता 18:62-66* - Complete surrender secret! Book FREE!",
  "📙 *यजुर्वेद में परमात्मा* - Complete God in Vedas! Free book!",
  "🌟 *सच्ची भक्ति* - True worship vs hypocrisy! 100% FREE!",
  "💫 *तत्वदर्शी संत* - World's only Tatvdarshi Saint! FREE!",
  "📕 *नशा मुक्ति* - Leave intoxication! Life transformation - Free!",
  "🌺 *अमर सतलोक* - Immortality in Satlok! Book FREE!",
  "📖 *ब्रह्म लोक नाशवान* - Brahm Lok temporary, Satlok eternal! Free!",
  "✨ *सच्चा ज्ञान* - True knowledge rare! 100% FREE!",
  "🙏 *धर्मदास-कबीर संवाद* - Divine conversation! FREE delivery!",
  "📚 *पूर्ण ब्रह्म कबीर* - All scriptures proof! Free Book!",
  "🌸 *5 यज्ञ, 16 संस्कार* - Truth of rituals! Book FREE!",
  "🔥 *ॐ मंत्र का सत्य* - Om is Kaal's mantra! True mantra - FREE!",
  "📗 *नाम दीक्षा* - Initiation method! Free Book!",
  "🌼 *कबीर वाणी रहस्य* - Mystery of Kabir's verses! Book FREE!",
  "⭐ *परमात्मा के नाम* - 17 names of God! Scriptural proof - Free!",
  "📘 *सतलोक आश्रम* - Heaven on Earth! Book FREE!",
  "🌟 *मानव जीवन अनमोल* - Human life precious! Knowledge book FREE!",
  "📕 *विश्व शांति* - World peace solution! FREE!"
];

// Get rotated image (same for 24h per user)
export async function getRotatedImage(userJid) {
  try {
    if (!fs.existsSync(IMAGE_FOLDER)) {
      return null;
    }
    
    const files = fs.readdirSync(IMAGE_FOLDER).filter(f => /.(jpg|jpeg|png|webp)$/i.test(f));
    if (!files.length) {
      return null;
    }

    const lastSent = userImageTracking.get(userJid);
    const now = Date.now();
    
    if (lastSent && (now - lastSent.time < 24*60*60*1000)) {
      return path.join(IMAGE_FOLDER, lastSent.image);
    }

    const randomImage = files[Math.floor(Math.random() * files.length)];
    userImageTracking.set(userJid, { image: randomImage, time: now });
    return path.join(IMAGE_FOLDER, randomImage);
    
  } catch (err) {
    console.error('❌ Image rotation error:', err);
    return null;
  }
}

// Get rotated description
export async function getRotatedDescription(userJid) {
  try {
    const lastIndex = userDescriptionTracking.get(userJid) || 0;
    const newIndex = (lastIndex + 1) % DESCRIPTIONS.length;
    userDescriptionTracking.set(userJid, newIndex);
    return DESCRIPTIONS[newIndex];
  } catch (err) {
    return DESCRIPTIONS[0];
  }
}

// Track engagement
export async function trackUserEngagement(userJid) {
  try {
    if (!userEngagementTracking.has(userJid)) {
      userEngagementTracking.set(userJid, {
        firstReply: Date.now(),
        notificationsSent: 0,
        day1: false,
        day2: false,
        day3: false
      });
    }
  } catch (err) {
    console.error('❌ Tracking error:', err);
  }
}

// Daily 9 AM notifications (3 days max) - NO "Shubh Prabhat"
export async function sendDailyNotifications(sock) {
  const now = Date.now();
  
  for (const [jid, data] of userEngagementTracking.entries()) {
    try {
      if (data.notificationsSent >= 3) continue;
      
      const daysPassed = Math.floor((now - data.firstReply) / (24*60*60*1000));
      
      if (daysPassed >= 1 && daysPassed <= 3) {
        const dayKey = `day${daysPassed}`;
        
        if (!data[dayKey]) {
          const img = await getRotatedImage(jid);
          const desc = await getRotatedDescription(jid);
          
          // Removed "Shubh Prabhat" completely
          const captionText = `🙏 *सत साहेब! Sat Saheb!*

${desc}

📲 Reply करें और निःशुल्क पुस्तक मंगवाएं!
_Reply to order your FREE book!_ 📚`;

          if (img && fs.existsSync(img)) {
            await sock.sendMessage(jid, {
              image: { url: img },
              caption: captionText
            });
          } else {
            await sock.sendMessage(jid, {
              text: captionText
            });
          }
          
          data[dayKey] = true;
          data.notificationsSent++;
          console.log(`✅ Day ${daysPassed} notification sent to ${jid}`);
        }
      }
    } catch (err) {
      console.error('❌ Notification error:', err);
    }
  }
}
