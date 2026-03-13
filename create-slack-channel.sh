#!/bin/bash
# Quick script to create Slack channel using API

if [ -z "$SLACK_BOT_TOKEN" ]; then
  echo "❌ SLACK_BOT_TOKEN not set"
  echo "   Export it first: export SLACK_BOT_TOKEN=xoxb-..."
  exit 1
fi

# Create private channel
curl -X POST https://slack.com/api/conversations.create \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "001-hermes-leads",
    "is_private": true
  }' | jq

# Set channel purpose  
# Note: Need channel ID from above response
