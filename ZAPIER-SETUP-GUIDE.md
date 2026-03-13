# Zapier Setup Guide - Hermes Demo

**Step-by-Step Instructions for Creating the Zapier Workflow**

---

## Prerequisites

Before starting, ensure you have:
- ✅ Google Form created (from infrastructure setup)
- ✅ Asana project created with custom fields
- ✅ Slack channel #001-hermes-leads created
- ✅ Zapier account (sign up at zapier.com if needed)

**Recommended Plan:** Zapier Starter ($19.99/mo) for instant triggers  
**Free Tier Works But:** 15-minute delay on triggers (not ideal for demo)

---

## Create the Zap

### Step 1: Create New Zap

1. Go to https://zapier.com/app/zaps
2. Click **"+ Create"** button (top right)
3. Click **"New Zap"**

---

## Configure Trigger: Google Forms

### Step 2: Set Up Trigger

1. **Search for app:** Type "Google Forms"
2. **Select:** Google Forms (by Google)
3. **Choose Event:** "New Response in Spreadsheet"
   - ⚠️ Note: Google Forms auto-creates a Google Sheet for responses
   - This is more reliable than direct form trigger
4. Click **Continue**

### Step 3: Connect Google Account

1. Click **"Sign in to Google"**
2. Select your Google account
3. Authorize Zapier to access Google Sheets
4. Click **Continue**

### Step 4: Choose Spreadsheet

1. **Spreadsheet:** Select the one that matches your form
   - Should be named "Lawn Care Service Request (Responses)"
   - Usually has "(Responses)" suffix
2. **Worksheet:** Sheet1 (default)
3. Click **Continue**

### Step 5: Test Trigger

1. **Important:** Submit a test response to your form first!
   - Go to your form URL
   - Fill out: Name, Phone, Service Type
   - Submit
2. In Zapier, click **"Test trigger"**
3. You should see your test response data
4. Verify fields: Timestamp, Name, Phone, Service Type
5. Click **Continue**

---

## Configure Action 1: Asana

### Step 6: Add Asana Action

1. Click **"+"** to add action
2. **Search for app:** Type "Asana"
3. **Select:** Asana
4. **Choose Event:** "Create Task"
5. Click **Continue**

### Step 7: Connect Asana Account

1. Click **"Sign in to Asana"**
2. Select your Asana account
3. Authorize Zapier
4. Click **Continue**

### Step 8: Configure Asana Task

Fill in the following fields:

**Workspace:**
- Select your workspace from dropdown

**Project:**
- Select "Hermes Skeleton Build"
- If not visible, click "Load more" or search

**Section:**
- Select "New Leads"

**Task Name:**
```
New Lead: [Name from Google Forms]
```
- Click in field, then click "Name" from data picker

**Notes / Description:**
```
Name: [Name]
Phone: [Phone]  
Service Type: [Service Type]
Submitted: [Timestamp]
```
- Map each field from Google Forms data

**Custom Fields:** (If available in Zapier)
- Lead Name → [Name from Google Forms]
- Phone → [Phone from Google Forms]
- Service Type → [Service Type from Google Forms]
- Status → "New Lead" (type manually)

⚠️ **Note:** Custom field mapping may not be available in free Asana plan.  
If you don't see custom fields, that's OK - the data will be in the description.

### Step 9: Test Asana Action

1. Click **"Test action"**
2. Zapier will create a real task in Asana
3. Go to Asana and verify:
   - Task appears in "New Leads" section
   - Task name is correct
   - Description contains all data
4. Click **Continue**

---

## Configure Action 2: Slack

### Step 10: Add Slack Action

1. Click **"+"** to add another action
2. **Search for app:** Type "Slack"
3. **Select:** Slack
4. **Choose Event:** "Send Channel Message"
5. Click **Continue**

### Step 11: Connect Slack Account

1. Click **"Sign in to Slack"**
2. Select your workspace
3. Authorize Zapier
4. Click **Continue**

### Step 12: Configure Slack Message

Fill in the following fields:

**Channel:**
- Option 1: Type `#001-hermes-leads` (if public)
- Option 2: Paste channel ID from infrastructure setup
  - Format: `C01234567890`
  - Find in demo-infrastructure-config.json

**Message Text:**
```
🆕 *New Lead: [Name from Google Forms]*

📞 *Phone:* [Phone from Google Forms]
🌿 *Service:* [Service Type from Google Forms]  
📅 *Submitted:* [Timestamp from Google Forms]

🔗 *View in Asana:* [URL from Asana step]
```

**Formatting Tips:**
- `*bold*` for bold text
- Use emojis for visual appeal
- Click fields to insert dynamic data
- Asana URL comes from previous step output

**Bot Name:** (Optional)
- Hermes Lead Bot

**Bot Icon Emoji:** (Optional)
- `:herb:` or `:rocket:`

### Step 13: Test Slack Action

1. Click **"Test action"**
2. Zapier will send a real message to Slack
3. Go to Slack #001-hermes-leads channel
4. Verify message appears with all data
5. Check formatting looks good
6. Click **Continue**

---

## Finalize and Publish

### Step 14: Name Your Zap

1. Click on "Untitled Zap" at top
2. Rename to: **"Hermes Demo — Form to Asana to Slack"**
3. Press Enter to save

### Step 15: Turn On Zap

1. **Important:** Review all steps one more time
2. Click the toggle switch to turn Zap **ON** 🟢
3. Confirm in the modal that appears

### Step 16: Save Zap URL

1. Copy the URL from your browser
   - Format: `https://zapier.com/editor/123456/published`
2. Save this to your notes for documentation
3. You'll need it to edit the Zap later

---

## Verify End-to-End

### Step 17: Full Pipeline Test

1. **Submit a NEW form response** (Zapier only sees new data)
   - Name: Jane Demo
   - Phone: +1-555-987-6543
   - Service: Tree Trimming

2. **Wait 1-2 minutes** (or 15 min on free tier)

3. **Check Asana:**
   - New task "New Lead: Jane Demo" in New Leads section
   - Description has all data

4. **Check Slack:**
   - Message in #001-hermes-leads
   - All data matches form submission

5. **Check Zapier:**
   - Go to Zap History (in Zapier dashboard)
   - Should show successful run
   - All 3 steps should be green ✅

### Success Criteria

- ✅ Form submitted
- ✅ Asana task created automatically
- ✅ Slack message sent automatically
- ✅ All data transferred correctly
- ✅ Latency acceptable (<5 min, ideally <2 min)

---

## Troubleshooting

### Trigger Not Firing

**Problem:** Zap doesn't run when I submit form

**Solutions:**
- Ensure you submitted a NEW response after creating Zap
- Check Zap is ON (green toggle)
- On free tier, wait 15 minutes
- Check Zap History for errors
- Try disconnecting and reconnecting Google account

### Data Not Mapping

**Problem:** Fields showing as blank in Asana or Slack

**Solutions:**
- Click "Refresh fields" in Zapier editor
- Ensure you selected the correct Google Sheet
- Submit a new test form to get fresh data
- Check field names match exactly

### Asana Custom Fields Missing

**Problem:** Can't see custom fields in Zapier

**Solutions:**
- Custom fields may require paid Asana plan
- Use Description field to store data instead
- Fields can be updated manually in Asana after

### Slack Channel Not Found

**Problem:** Can't find #001-hermes-leads in channel list

**Solutions:**
- Use Channel ID instead of name
- Ensure Zapier Slack app is in the channel
- For private channels, invite Zapier to channel first
- Type channel ID manually (starts with C)

### Zap History Shows Errors

**Problem:** Runs appear in history but have red X

**Solutions:**
- Click into the run to see error details
- Common issues:
  - Permissions: Reconnect the app
  - Rate limits: Wait and retry
  - Invalid data: Check field formatting
- Edit Zap and re-test affected step

---

## Optimization Tips

### For Faster Performance

1. **Upgrade to Zapier Starter** ($19.99/mo)
   - Instant triggers (no 15-min delay)
   - More tasks per month (750 vs 100)
   - Multi-step Zaps

2. **Use Zapier Paths** (Advanced)
   - Add conditional logic
   - Route high-priority leads differently
   - Requires paid plan

3. **Add Filters**
   - Skip certain form submissions
   - Only process during business hours
   - Quality checks on data

### For Better Data

1. **Add Formatter Steps**
   - Format phone numbers consistently
   - Clean up text fields
   - Parse timestamps to local timezone

2. **Add Lead Scoring**
   - Calculate score based on service type
   - Set priority in Asana automatically
   - Flag high-value leads

3. **Add Enrichment**
   - Look up location from phone
   - Get weather data for service area
   - Cross-reference with existing customers

---

## Monitoring

### Daily Checks

- Open Zap History
- Verify recent runs are successful
- Check for any error patterns

### Weekly Review

- Review Asana tasks created
- Ensure all data is accurate
- Check for any automation failures

### Alerts

Set up in Zapier:
- Email on Zap errors
- Slack notification on failures
- Weekly summary report

---

## Maintenance

### When to Edit Zap

- Form questions change
- Asana project structure changes
- Slack channel moves
- Need to add/remove steps

### How to Edit

1. Go to https://zapier.com/app/zaps
2. Find "Hermes Demo" Zap
3. Click **"Edit"**
4. Make changes
5. Test each modified step
6. **Turn OFF Zap before major changes**
7. Turn back ON when ready

### When to Recreate

If you get stuck, it's often faster to:
1. Turn OFF old Zap
2. Create new Zap from scratch
3. Delete old Zap once new one works

---

## Next Steps

After Zap is working:

1. ✅ Run multiple test submissions
2. ✅ Time the end-to-end latency
3. ✅ Screenshot successful runs
4. ✅ Document in demo-infrastructure-config.json
5. 🎯 Add Hermes SMS agent (Phase 2)
6. 🎯 Configure lead qualification logic
7. 🎯 Set up monitoring and alerts

---

## Resources

- **Zapier Help Docs:** https://help.zapier.com/
- **Google Forms + Zapier:** https://help.zapier.com/hc/en-us/articles/8496181195277
- **Asana + Zapier:** https://help.zapier.com/hc/en-us/articles/8496181481741
- **Slack + Zapier:** https://help.zapier.com/hc/en-us/articles/8496196067213

---

*Created: 2026-02-27*  
*For: Hermes Demo Infrastructure*  
*Version: 1.0*
