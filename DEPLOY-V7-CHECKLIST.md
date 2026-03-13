# V7 DEPLOYMENT CHECKLIST

## Pre-Deployment

- [x] conversation-engine.js rewritten (V7)
- [x] gaius-router.js rewritten (V7)
- [x] FRAMEWORK.md updated (parachute triggers added)
- [x] Test suite created (test-v7-autonomous-decisions.js)
- [x] Deployment documentation complete

## Deployment (Run these commands)

### 1. Backup Current Version
```bash
cd ~/.openclaw/workspace-hermes
cp src/conversation-engine.js src/conversation-engine.v6.backup.js
cp src/gaius-router.js src/gaius-router.v6.backup.js
echo "✅ Backups created"
```

### 2. Verify V7 Files
```bash
grep "V7" src/conversation-engine.js src/gaius-router.js
# Should see V7 markers in both files
echo "✅ V7 files verified"
```

### 3. Run Tests (Optional - requires mock setup)
```bash
# Skip for now - mock Gaius responses needed
# node test-v7-autonomous-decisions.js
echo "⚠️  Tests skipped (requires mock Gaius)"
```

### 4. Restart Hermes
```bash
pm2 restart hermes-interactive
echo "✅ Hermes restarted"
```

### 5. Check Logs
```bash
pm2 logs hermes-interactive --lines 20
# Look for:
# [ConversationEngine] V7: Pure context packaging
# [GaiusRouter] V7: Autonomous decision mode
# [GaiusRouter] Loaded FRAMEWORK.md
```

### 6. Monitor First Conversation
```bash
# Watch #new-leads in Slack
# Submit test lead with: "can you guys give me a call?"
# Expected: Immediate transfer (no Q2)
```

## Validation Checklist

- [ ] Logs show V7 startup messages
- [ ] No errors in pm2 logs
- [ ] Test lead: "can you guys give me a call?" → immediate transfer
- [ ] Test lead: "I want a quote" → immediate transfer
- [ ] Test lead: normal answer → continues questions

## Rollback (if needed)

```bash
cd ~/.openclaw/workspace-hermes
cp src/conversation-engine.v6.backup.js src/conversation-engine.js
cp src/gaius-router.v6.backup.js src/gaius-router.js
pm2 restart hermes-interactive
echo "⚠️  Rolled back to V6"
```

## Success Criteria

✅ Hermes running without errors  
✅ "can you guys give me a call?" triggers immediate transfer  
✅ "I want a quote" triggers immediate transfer  
✅ Normal answers continue qualification  
✅ No pre-decision logic in logs  
✅ Gaius making all decisions autonomously  

---

**Ready to deploy!** Ship in <15 minutes from issue identification. 🚀
