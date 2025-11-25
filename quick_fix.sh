#!/bin/bash

echo "⚡ QUICK FIX FOR BAD MAC ERRORS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop bot
pkill -f "node bot" 2>/dev/null
sleep 1

# Clean problematic sessions
echo "🧹 Cleaning sessions..."
for session in ./sessions/*; do
  if [ -d "$session" ]; then
    rm -f "$session"/app-state-sync-*.json 2>/dev/null
    echo "✓ Cleaned: $(basename "$session")"
  fi
done

echo ""
echo "✅ Sessions cleaned!"
echo ""
echo "Now restart bot:"
echo "  node bot.js"
echo ""
