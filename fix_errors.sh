#!/bin/bash

echo "🔧 Fixing WhatsApp Bot Errors..."
echo ""

# 1. Clean corrupted sessions
echo "1️⃣ Cleaning corrupted session data..."
node -e "
import('./utils/sessionCleaner.js').then(m => {
  const result = m.cleanAllCorruptedSessions();
  console.log('✅ Cleaned:', result);
});
"

# 2. Remove node_modules cache (if needed)
echo ""
echo "2️⃣ Checking node modules..."
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "✅ Cleared node_modules cache"
fi

# 3. Restart recommendation
echo ""
echo "3️⃣ Recommended actions:"
echo "   - Restart bot: node bot.js"
echo "   - If errors persist, delete problem session:"
echo "     rm -rf ./sessions/[session_name]"
echo "     Then reconnect that session"
echo ""
echo "✅ Fix script completed!"
