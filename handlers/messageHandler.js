      if (!langSelected) {
        await sock.sendMessage(from, { text: `❌ सही भाषा नंबर भेजें। (Send correct language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.pdfBook] && CONFIG.BOOK_PDFS[state.pdfBook][langSelected] ? CONFIG.BOOK_PDFS[state.pdfBook][langSelected] : '';
      if (pdfLink) {
        await sock.sendMessage(from, { text: `📖 *${state.pdfBook} (${langSelected})* PDF:

${pdfLink}

╔═══════════════════════════════

📚 कृपया PDF देखें और हमें बताएं!

Please view the PDF and let us know!

अगर आपको *निःशुल्क पुस्तक* चाहिए (20 दिनों में घर पहुंचेगी), तो अपना नाम, पता भेजें।

If you want the *free physical book* (will reach home in 20 days), send us your name & address.

1️⃣ ज्ञान गंगा (Gyan Ganga) के लिए 1 भेजें

2️⃣ जीने की राह (Way of Living) के लिए 2 भेजें

या पुस्तक का नाम लिखें। (Or write book name directly)` });
      }
      state.step = 'pdf_shown';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // PDF Shown - Book Selection
    if (state.step === 'pdf_shown') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      if (!book) {
        await sock.sendMessage(from, { text: `कौनसी पुस्तक ऑर्डर करना चाहते हैं?

Which book do you want to order?

1️⃣ ज्ञान गंगा

2️⃣ जीने की राह

1 या 2 भेजें

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।

✏️ लेखक: संत रामपाल जी महाराज

╔═══════════════════════════════

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

    // Book Selection
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `📖 पहले PDF देखना चाहते हैं!

You want to see PDF first!

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
        await sock.sendMessage(from, { text: `❌ कृपया 1, 2, या 3/pdf भेजें।

_Send 1, 2, or 3/pdf._

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।

✏️ लेखक: संत रामपाल जी महाराज

╔═══════════════════════════════

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

    // Language Selection
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

╔═══════════════════════════════

Your Full Name:

उदाहरण (Example): राज कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Name Input
    if (state.step === 'awaiting_name') {
      state.name = text;
      await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*

╔═══════════════════════════════

क्या आपने सही (Correct) नाम लिखा है?

Is the name above correct?

✅ सही है तो reply करें: *1* / "हां" / "Yes"

❌ बदलना है तो reply करें: *2* / "नहीं" / "No"

उदाहरण (Example): 1

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Name Confirmation
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

✅ सही है तो: *1* / "हां" / "Yes"

❌ नहीं तो: *2* / "नहीं" / "No"

Please reply *1* (Yes) or *2* (No)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:

╔═══════════════════════════════

Father's Name:

उदाहरण (Example): संतोष कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Father Name Input
    if (state.step === 'awaiting_father') {
      state.father = text;
      await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*

╔═══════════════════════════════

क्या ऊपर लिखा *पिता का नाम* सही है?

Is your father's name correct?

✅ सही है तो reply करें: *1* / "हां" / "Yes"

❌ बदलना है तो reply करें: *2* / "नहीं" / "No"

उदाहरण (Example): 1

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Father Name Confirmation
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

✅ सही है तो: *1* / "हां" / "Yes"

❌ नहीं तो: *2* / "नहीं" / "No"

Please reply *1* (Yes) or *2* (No)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:

╔═══════════════════════════════

Mobile Number:

उदाहरण (Example): 9876543210

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Mobile Input
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

╔═══════════════════════════════

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

╔═══════════════════════════════

क्या यह मोबाइल नंबर सही है?

Is this mobile number correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ नहीं तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Mobile Confirmation
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
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हां) या *2* (No/नहीं) भेजें।

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:

╔═══════════════════════════════

Pincode:

उदाहरण (Example): 465227

⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_pincode';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Pincode Input
    if (state.step === 'awaiting_pincode') {
      const pin = text.replace(/[^0-9]/g, "");
      if (pin.length !== 6) {
        await sock.sendMessage(from, { text: `❌ 6 अंक का पिनकोड दर्ज करें

(Enter 6-digit pincode)

उदाहरण (Example): 465227

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sock.sendMessage(from, { text: `⏳ कृपया प्रतीक्षा करें...

_Please wait..._

पिनकोड की जानकारी प्राप्त की जा रही है।

Fetching pincode details.` });
      
      let pinData = null;
      for (let i = 0; i < 10; i++) {
        const pinInfo = await fetchPinDetails(pin);
        if (pinInfo && pinInfo.success) {
          pinData = pinInfo;
          break;
        }
        await new Promise(r => setTimeout(r, 900));
      }
      
      if (!pinData || !pinData.postOffices || !pinData.postOffices.length) {
        await sock.sendMessage(from, { text: `❌ पिनकोड verify नहीं हुआ। फिर से try करें।

(Pincode verification failed. Try again.)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.pincode = pin;
      state.district = pinData.district || '';
      state.stateName = pinData.state || '';
      state.postOffices = pinData.postOffices;
      
      await sock.sendMessage(from, { text: `पिनकोड (Pincode): *${pin}*

🏛️ डिस्ट्रिक्ट (District): ${state.district}

🗺️ राज्य (State): ${state.stateName}

╔═══════════════════════════════

क्या यह पिनकोड सही है?

Is this pincode correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ बदलना है तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'confirm_pincode';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Pincode Confirmation
    if (state.step === 'confirm_pincode') {
      if (isNo(text)) {
        state.step = 'awaiting_pincode';
        await sock.sendMessage(from, { text: `फिर से 6-digit पिनकोड भेजें:

Re-enter 6-digit pincode:

उदाहरण (Example): 465227

⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हां) या *2* (No/नहीं) भेजें।

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      let menu = "";
      if (state.postOffices && state.postOffices.length) {
        state.postOffices.forEach((po, i) => menu += `${i + 1}. ${po.name}\n`);
      }
      
      await sock.sendMessage(from, { text: `✅ पिनकोड: *${state.pincode}*

╔═══════════════════════════════

📮 *अपना Post Office चुनें:*

_Select your Post Office:_

${menu}╚═══════════════════════════════

नंबर भेजें (Send number)

⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_postoffice';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Post Office Selection
    if (state.step === 'awaiting_postoffice') {
      let selectedPO = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.postOffices && idx < state.postOffices.length) {
        selectedPO = state.postOffices[idx];
      } else if (state.postOffices) {
        const match = state.postOffices.find(po => 
          po.name.toLowerCase().includes(text.toLowerCase())
        );
        if (match) selectedPO = match;
      }
      
      if (!selectedPO) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.selectedPostOffice = selectedPO.name;
      state.villages = selectedPO.villages || [];
      
      await sock.sendMessage(from, { text: `✅ Post Office: *${state.selectedPostOffice}*

╔═══════════════════════════════

🏘️ *क्या आपका गाँव/शहर का नाम "${state.selectedPostOffice}" है?*

_Is your village/city name "${state.selectedPostOffice}"?_

✅ हाँ, यही मेरा गाँव/शहर है: *1* / "Yes"

❌ नहीं, मुझे list से चुनना है: *2* / "No"

📝 अन्य (अपना पता खुद लिखना है): *3*

╚═══════════════════════════════

अपना जवाब भेजें (Send your reply)

⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'confirm_village_selection';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Confirm Village Selection
    if (state.step === 'confirm_village_selection') {
      if (isYes(text)) {
        state.address = state.selectedPostOffice;
        
        await sock.sendMessage(from, { text: `╔═══════════════════════════════

📋 *ऑर्डर कन्फर्मेशन*

_Order Confirmation_

╠═══════════════════════════════

👤 नाम (Name): ${state.name}

👨 पिता (Father): ${state.father}

📞 मोबाइल (Mobile): +91${state.mobile}

📚 पुस्तक (Book): ${state.bookName}

🌐 भाषा (Language): ${state.language}

📮 Post Office: ${state.selectedPostOffice}

🏘️ पता (Address): ${state.address}

📮 पिनकोड (Pincode): ${state.pincode}

🏛️ डिस्ट्रिक्ट (District): ${state.district}

🗺️ राज्य (State): ${state.stateName}

╠═══════════════════════════════

📦 पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी।

Book will reach your home in *20 days*.

🆓 बिल्कुल निःशुल्क!

Completely free!

╚═══════════════════════════════` });
      
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"

❌ *Cancel* के लिए: *2* / "no" / "cancel"

अपना जवाब भेजें (Send your reply):

⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Custom Address Input
    if (state.step === 'awaiting_custom_address') {
      if (text.length < 5) {
        await sock.sendMessage(from, { text: `❌ कृपया पूरा पता लिखें।

Please write complete address.

उदाहरण (Example):
कड़वाला, तहसील शुजालपुर, जिला शाजापुर

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.customAddress = text;
      
      await sock.sendMessage(from, { text: `📍 *आपका पता (Your Address):*

${state.customAddress}

╔═══════════════════════════════

क्या यह पता सही है?

Is this address correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ बदलना है तो: *2* / "नहीं" / "No"

╚═══════════════════════════════

⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'confirm_custom_address';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Confirm Custom Address
    if (state.step === 'confirm_custom_address') {
      if (isNo(text)) {
        state.step = 'awaiting_custom_address';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं!

फिर से अपना पूरा पता लिखें:

Re-write your complete address:

उदाहरण (Example):
कड़वाला, तहसील शुजालपुर, जिला शाजापुर

⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हां) या *2* (No/नहीं) भेजें।

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.address = state.customAddress;
      
      await sock.sendMessage(from, { text: `╔═══════════════════════════════

📋 *ऑर्डर कन्फर्मेशन*

_Order Confirmation_

╠═══════════════════════════════

👤 नाम (Name): ${state.name}

👨 पिता (Father): ${state.father}

📞 मोबाइल (Mobile): +91${state.mobile}

📚 पुस्तक (Book): ${state.bookName}

🌐 भाषा (Language): ${state.language}

📮 Post Office: ${state.selectedPostOffice}

🏘️ पता (Address): ${state.address}

📮 पिनकोड (Pincode): ${state.pincode}

🏛️ डिस्ट्रिक्ट (District): ${state.district}

🗺️ राज्य (State): ${state.stateName}

╠═══════════════════════════════

📦 पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी।

Book will reach your home in *20 days*.

🆓 बिल्कुल निःशुल्क!

Completely free!

╚═══════════════════════════════` });
      
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"

❌ *Cancel* के लिए: *2* / "no" / "cancel"

अपना जवाब भेजें (Send your reply):

⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Final Confirmation
    if (state.step === 'awaiting_confirmation') {
      if (isNo(text)) {
        await sock.sendMessage(from, { text: `❌ ऑर्डर रद्द!

Order Cancelled!

╔═══════════════════════════════

कोई बात नहीं! फिर से शुरू करने के लिए कोई भी मैसेज भेजें।

No problem! Send any message to start again.` });
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
        postOffice: state.selectedPostOffice,
        address: state.address,
        pincode: state.pincode,
        district: state.district,
        stateName: state.stateName,
        whatsapp: from,
        timestamp: new Date().toISOString(),
        sessionName: sessionName
      };
      
      await saveOrder(orderData);
      
      const orderCount = updateOrderCount(sessionName);
      const totalOrders = getTotalOrders();
      const now = new Date();
      const dateStr = now.toLocaleDateString('hi-IN');
      const timeStr = now.toLocaleTimeString('hi-IN');
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.bookName] && CONFIG.BOOK_PDFS[state.bookName][state.language] ? CONFIG.BOOK_PDFS[state.bookName][state.language] : '';
      
      await sock.sendMessage(from, { text: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*

_Your order is placed successfully!_

╔═══════════════════════════════

📦 आपकी पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी।

Your book will reach your home in *20 days*.

🆓 *बिल्कुल निःशुल्क! कोई चार्ज नहीं!*

*Completely free! No charges!*

╚═══════════════════════════════

🙏 धन्यवाद! Thank you!` });
      
      if (pdfLink) {
        await sock.sendMessage(from, { text: `📖 *${state.bookName} (${state.language})* PDF:

${pdfLink}

╔═══════════════════════════════

📚 पुस्तक आने तक PDF पढ़ सकते हैं।

You can read the PDF until the book arrives.` });
      }
      
      if (CONFIG.USER_GROUP_LINK) {
        await sock.sendMessage(from, { text: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*

_Join our WhatsApp group:_

${CONFIG.USER_GROUP_LINK}

╔═══════════════════════════════

यहां रोज़ आध्यात्मिक ज्ञान मिलता है।

Daily spiritual knowledge shared here.` });
      }
      
      const fwMsg = `╔═══════════════════════════════

📦 *नया ऑर्डर!* 

╚═══════════════════════════════

📊 *Order #${orderCount}* (Session)
📈 *Total Orders: ${totalOrders}*

📅 Date: ${dateStr}
⏰ Time: ${timeStr}
📱 Session: ${sessionName}

╔═══════════════════════════════

👤 *Customer Details:*

नाम (Name): ${state.name}
पिता (Father): ${state.father}
📞 Mobile: +91${state.mobile}

╠═══════════════════════════════

📚 *Book Details:*

पुस्तक (Book): ${state.bookName}
भाषा (Language): ${state.language}

╠═══════════════════════════════

🏘️ *Delivery Address:*

Post Office: ${state.selectedPostOffice}
Village/City: ${state.address}
Pincode: ${state.pincode}
District: ${state.district}
State: ${state.stateName}

╠═══════════════════════════════

📦 Delivery: 20 days
🆓 Free Book Service

╚═══════════════════════════════`;
      
      try {
        if (CONFIG.ADMIN && CONFIG.ADMIN.JID) {
          await sock.sendMessage(CONFIG.ADMIN.JID, { text: fwMsg });
          console.log('✅ Order forwarded to main admin:', CONFIG.ADMIN.JID);
        }
      } catch (e) {
        console.error('❌ Main admin send error:', e);
      }
      
      try {
        const sessionAdmin = CONFIG.SESSION_ADMINS && CONFIG.SESSION_ADMINS[sessionName];
        if (sessionAdmin) {
          await sock.sendMessage(sessionAdmin, { text: fwMsg });
          console.log('✅ Order forwarded to session admin:', sessionAdmin);
        }
      } catch (e) {
        console.error('❌ Session admin send error:', e);
      }
      
      try {
        await sendToOrderGroup(sock, sessionName, fwMsg);
        console.log('✅ Order forwarded to group for session:', sessionName);
      } catch (e) {
        console.error('❌ Group send error:', e);
      }
      
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

फिर से try करें। (Please try again.)

╔═══════════════════════════════

कोई भी मैसेज भेजकर शुरू करें।

Send any message to start.` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      }
    } catch (e2) {
      console.error('Error in error handler:', e2);
    }
  }
} (Father): ${state.father}

📞 मोबाइल (Mobile): +91${state.mobile}

📚 पुस्तक (Book): ${state.bookName}

🌐 भाषा (Language): ${state.language}

📮 Post Office: ${state.selectedPostOffice}

🏘️ पता (Address): ${state.address}

📮 पिनकोड (Pincode): ${state.pincode}

🏛️ डिस्ट्रिक्ट (District): ${state.district}

🗺️ राज्य (State): ${state.stateName}

╠═══════════════════════════════

📦 पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी।

Book will reach your home in *20 days*.

🆓 बिल्कुल निःशुल्क!

Completely free!

╚═══════════════════════════════` });
        
        await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"

❌ *Cancel* के लिए: *2* / "no" / "cancel"

अपना जवाब भेजें (Send your reply):

⬅️ पीछे जाने के लिए *0* भेजें` });
        
        state.step = 'awaiting_confirmation';
        userStates.set(from, state);
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        if (!state.villages.length) {
          await sock.sendMessage(from, { text: `❌ इस Post Office में कोई गाँव/शहर नहीं मिला।

No villages/cities found for this post office.

कृपया दूसरा Post Office चुनें।

Please select another post office.

⬅️ पीछे जाने के लिए *0* भेजें` });
          state.step = 'awaiting_postoffice';
          userStates.set(from, state);
          return;
        }
        
        let villageMenu = "";
        state.villages.forEach((v, i) => villageMenu += `${i + 1}. ${v}\n`);
        
        await sock.sendMessage(from, { text: `✅ Post Office: *${state.selectedPostOffice}*

╔═══════════════════════════════

🏘️ *अपना गाँव/शहर चुनें:*

_Select your village/city:_

${villageMenu}╚═══════════════════════════════

नंबर भेजें (Send number)

📝 अगर आपका गाँव/शहर list में नहीं है तो *3* भेजें
_If your village/city is not in list, send *3*_

⬅️ पीछे जाने के लिए *0* भेजें` });
        
        state.step = 'awaiting_village';
        userStates.set(from, state);
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isCustomAddress(text)) {
        await sock.sendMessage(from, { text: `📝 *अपना पूरा पता लिखें:*

╔═══════════════════════════════

_Write your complete address:_

कृपया अपने गाँव/शहर का नाम और पूरा पता लिखें।

Please write your village/city name and complete address.

उदाहरण (Example):
कड़वाला, तहसील शुजालपुर, जिला शाजापुर

╚═══════════════════════════════

⬅️ पीछे जाने के लिए *0* भेजें` });
        
        state.step = 'awaiting_custom_address';
        userStates.set(from, state);
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else {
        await sock.sendMessage(from, { text: `कृपया सही विकल्प चुनें:

✅ हाँ, यही मेरा गाँव/शहर है: *1* / "Yes"

❌ नहीं, list से चुनना है: *2* / "No"

📝 अन्य (खुद लिखना है): *3*

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
    }

    // Village Selection
    if (state.step === 'awaiting_village') {
      if (isCustomAddress(text)) {
        await sock.sendMessage(from, { text: `📝 *अपना पूरा पता लिखें:*

╔═══════════════════════════════

_Write your complete address:_

कृपया अपने गाँव/शहर का नाम और पूरा पता लिखें।

Please write your village/city name and complete address.

उदाहरण (Example):
कड़वाला, तहसील शुजालपुर, जिला शाजापुर

╚═══════════════════════════════

⬅️ पीछे जाने के लिए *0* भेजें` });
        
        state.step = 'awaiting_custom_address';
        userStates.set(from, state);
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      }
      
      let sel = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.villages && idx < state.villages.length) {
        sel = state.villages[idx];
      } else if (state.villages) {
        const match = state.villages.find(v => v.toLowerCase().includes(text.toLowerCase()));
        if (match) sel = match;
      }
      
      if (!sel) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)

📝 अगर आपका गाँव/शहर list में नहीं है तो *3* भेजें

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.address = sel;
      
      await sock.sendMessage(from, { text: `╔═══════════════════════════════

📋 *ऑर्डर कन्फर्मेशन*

_Order Confirmation_

╠═══════════════════════════════

👤 नाम (Name): ${state.name}

👨 पिताimport { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { sendToOrderGroup } from '../utils/groupManager.js';
import CONFIG from '../config.js';
import fs from 'fs';

const userStates = new Map();
const orderCounters = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हां','done','order','yes.','ok.','haan.','haa','y','Y','ha.','ہاں','ji','जी','han','theek','sahi'];
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

function isCustomAddress(txt) {
  const custom = ['3','custom','अन्य','other','anya'];
  return custom.includes(txt.trim().toLowerCase());
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

function getTotalOrders() {
  let total = 0;
  orderCounters.forEach(count => total += count);
  return total;
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

async function handleAdminCommands(sock, from, text) {
  const cmd = text.toLowerCase().trim();
  
  if (cmd === 'report' || cmd === 'stats' || cmd === 'status') {
    const total = getTotalOrders();
    let sessionReport = '*📊 Session-wise Order Report:*\n\n';
    orderCounters.forEach((count, session) => {
      sessionReport += `📱 ${session}: ${count} orders\n`;
    });
    
    const reportMsg = `╔═══════════════════════════════

📈 *Order Statistics Report*

╠═══════════════════════════════

📦 *Total Orders:* ${total}

${sessionReport}
╠═══════════════════════════════

👥 *Active Users:* ${userStates.size}

🔄 *Completed Orders:* ${userOrderCompleted.size}

╠═══════════════════════════════

📅 Date: ${new Date().toLocaleDateString('hi-IN')}
⏰ Time: ${new Date().toLocaleTimeString('hi-IN')}

╚═══════════════════════════════`;

    await sock.sendMessage(from, { text: reportMsg });
    return true;
  }
  
  if (cmd === 'help' || cmd === 'commands') {
    const helpMsg = `╔═══════════════════════════════

🛠️ *Admin Commands*

╠═══════════════════════════════

📊 *report* - Order statistics
📈 *stats* - Same as report
📋 *status* - System status

🧪 *test* - Enter test mode
🚫 *exit* - Exit test mode

❓ *help* - Show this menu
📜 *commands* - Show commands

╚═══════════════════════════════`;
    
    await sock.sendMessage(from, { text: helpMsg });
    return true;
  }
  
  return false;
}

async function resendMenu(sock, from, state) {
  const step = state.step;
  if (step === 'awaiting_book' || step === 'awaiting_pdf_book') {
    const welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा

_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।

_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*

जीते जी मुक्ति पाने का उपाय इस पुस्तक में बताया गया है। मरने का इंतजार मत करें। | Way to attain liberation while alive explained in this book. Don't wait for death.

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
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
    await sock.sendMessage(from, { text: `✅ *${bookName}* चुना।

✏️ लेखक: संत रामपाल जी महाराज

╔═══════════════════════════════

किस भाषा में?

Which language?

${langMenu}
भाषा का नंबर भेजें (Send language number)

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `✅ भाषा: *${state.language || 'हिंदी'}*

अब अपना *पूरा नाम* भेजें:

╔═══════════════════════════════

Your Full Name:

उदाहरण (Example): राज कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*

╔═══════════════════════════════

क्या सही है? | Is it correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ बदलना है तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:

╔═══════════════════════════════

Father's Name:

उदाहरण (Example): संतोष कुमार शर्मा

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*

╔═══════════════════════════════

क्या सही है? | Is it correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ बदलना है तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:

╔═══════════════════════════════

Mobile Number:

उदाहरण (Example): 9876543210

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*

╔═══════════════════════════════

क्या सही है? | Is it correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ नहीं तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:

╔═══════════════════════════════

Pincode:

उदाहरण (Example): 465227

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'confirm_pincode') {
    await sock.sendMessage(from, { text: `पिनकोड (Pincode): *${state.pincode}*

🏛️ डिस्ट्रिक्ट (District): ${state.district || ''}

🗺️ राज्य (State): ${state.stateName || ''}

╔═══════════════════════════════

क्या यह पिनकोड सही है?

Is this pincode correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ बदलना है तो: *2* / "नहीं" / "No"

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_postoffice') {
    let menu = "";
    if (state.postOffices && state.postOffices.length) {
      state.postOffices.forEach((po, i) => menu += `${i + 1}. ${po.name}\n`);
    }
    await sock.sendMessage(from, { text: `✅ पिनकोड: *${state.pincode}*

╔═══════════════════════════════

📮 *अपना Post Office चुनें:*

_Select your Post Office:_

${menu}╚═══════════════════════════════

नंबर भेजें (Send number)

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'confirm_village_selection') {
    await sock.sendMessage(from, { text: `✅ Post Office: *${state.selectedPostOffice}*

╔═══════════════════════════════

🏘️ *क्या आपका गाँव/शहर का नाम "${state.selectedPostOffice}" है?*

_Is your village/city name "${state.selectedPostOffice}"?_

✅ हाँ, यही मेरा गाँव/शहर है: *1* / "Yes"

❌ नहीं, मुझे list से चुनना है: *2* / "No"

📝 अन्य (अपना पता खुद लिखना है): *3*

╚═══════════════════════════════

अपना जवाब भेजें (Send your reply)

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_village') {
    let menu = "";
    if (state.villages && state.villages.length) {
      state.villages.forEach((v, i) => menu += `${i + 1}. ${v}\n`);
    }
    await sock.sendMessage(from, { text: `✅ Post Office: *${state.selectedPostOffice}*

╔═══════════════════════════════

🏘️ *अपना गाँव/शहर चुनें:*

_Select your village/city:_

${menu}╚═══════════════════════════════

नंबर भेजें (Send number)

📝 अगर आपका गाँव/शहर list में नहीं है तो *3* भेजें
_If your village/city is not in list, send *3*_

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_custom_address') {
    await sock.sendMessage(from, { text: `📝 *अपना पूरा पता लिखें:*

╔═══════════════════════════════

_Write your complete address:_

कृपया अपने गाँव/शहर का नाम और पूरा पता लिखें।

Please write your village/city name and complete address.

उदाहरण (Example):
कड़वाला, तहसील शुजालपुर, जिला शाजापुर

╚═══════════════════════════════

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'confirm_custom_address') {
    await sock.sendMessage(from, { text: `📍 *आपका पता (Your Address):*

${state.customAddress}

╔═══════════════════════════════

क्या यह पता सही है?

Is this address correct?

✅ सही है तो: *1* / "हां" / "Yes"

❌ बदलना है तो: *2* / "नहीं" / "No"

╚═══════════════════════════════

⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_confirmation') {
    await sock.sendMessage(from, { text: `╔═══════════════════════════════

📋 *ऑर्डर कन्फर्मेशन*

_Order Confirmation_

╠═══════════════════════════════

नाम (Name): ${state.name}

पिता (Father): ${state.father}

मोबाइल (Mobile): +91${state.mobile}

पुस्तक (Book): ${state.bookName}

भाषा (Language): ${state.language}

Post Office: ${state.selectedPostOffice}

पता (Address): ${state.address}

पिनकोड (Pincode): ${state.pincode}

डिस्ट्रिक्ट (District): ${state.district}

राज्य (State): ${state.stateName}

╚═══════════════════════════════` });
    await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"

❌ *Cancel* के लिए: *2* / "no" / "cancel"

अपना जवाब भेजें (Send your reply):

⬅️ पीछे जाने के लिए *0* भेजें` });
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

    // Admin Commands Handler
    if (isAdmin && !state.testMode) {
      const handled = await handleAdminCommands(sock, from, text);
      if (handled) return;
    }

    // Admin Test Mode Handler
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
          await sock.sendMessage(from, { image: { url: imgPath }, caption: `✅ Admin verified!

🧪 Test Mode: *test* या *1*
📊 Report: *report* या *stats*
❓ Help: *help* या *commands*` });
        } else {
          await sock.sendMessage(from, { text: `✅ Admin verified!

🧪 Test Mode: *test* या *1*
📊 Report: *report* या *stats*
❓ Help: *help* या *commands*` });
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
        await sock.sendMessage(from, { image: { url: imgPath }, caption: `🔍 *[Test Mode]*

Admin message: "${text}"

(Reply '0'/exit to leave)` });
      } else {
        await sock.sendMessage(from, { text: `🔍 *[Test Mode]*

Admin message: "${text}"

(Reply '0'/exit to leave)` });
      }
      scheduleReminder(sock, from, state, sessionName, true);
      return;
    }

    // Duplicate Order Check
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

    // New User Welcome
    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      let welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा

_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।

_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*

जीते जी मुक्ति पाने का उपाय इस पुस्तक में बताया गया है। मरने का इंतजार मत करें। | Way to attain liberation while alive explained in this book. Don't wait for death.

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

    // Back Navigation
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
        confirm_pincode: 'awaiting_pincode',
        awaiting_postoffice: 'confirm_pincode',
        confirm_village_selection: 'awaiting_postoffice',
        awaiting_village: 'confirm_village_selection',
        awaiting_custom_address: 'awaiting_village',
        confirm_custom_address: 'awaiting_custom_address',
        awaiting_confirmation: 'awaiting_village',
        awaiting_pdf_language: 'awaiting_pdf_book',
        pdf_shown: 'awaiting_book'
      };
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `⬅️ पिछला स्टेप चालू हो गया!

_Previous step resumed!_

╔═══════════════════════════════` });
        await resendMenu(sock, from, state);
      }
      return;
    }

    // PDF Book Selection
    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      if (!book) {
        await sock.sendMessage(from, { text: `कौनसी पुस्तक का PDF देखना चाहते हैं?

Which book PDF do you want to see?

1️⃣ ज्ञान गंगा (Gyan Ganga)

2️⃣ जीने की राह (Way of Living)

1 या 2 भेजें (Send 1 or 2)

⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
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

    // PDF Language Selection
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
