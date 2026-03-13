'use strict';

/**
 * Generic webhook CRM adapter — POSTs validated lead JSON to a configurable URL.
 */
class WebhookAdapter {
  constructor({ url, apiKey }) {
    if (!url) throw new Error('CRM_WEBHOOK_URL is required for webhook adapter');
    this.url = url;
    this.apiKey = apiKey;
  }

  async create(lead) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({ action: 'create', lead }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Webhook create failed: ${res.status} ${body}`);
    }
    return { status: res.status, id: (await res.json().catch(() => ({}))).id };
  }

  async update(id, lead) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({ action: 'update', id, lead }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Webhook update failed: ${res.status} ${body}`);
    }
    return { status: res.status };
  }
}

module.exports = WebhookAdapter;
