'use strict';

/**
 * GoHighLevel CRM adapter — stub wired to correct API format, ready for production keys.
 * Docs: https://highlevel.stoplight.io/docs/integrations
 */
const GHL_BASE = 'https://services.leadconnectorhq.com';

class GoHighLevelAdapter {
  constructor({ apiKey }) {
    if (!apiKey) throw new Error('CRM_API_KEY is required for GoHighLevel adapter');
    this.apiKey = apiKey;
  }

  _mapLead(lead) {
    return {
      firstName: lead.name.split(' ')[0] || lead.name,
      lastName: lead.name.split(' ').slice(1).join(' ') || '',
      phone: lead.phone,
      email: lead.email || '',
      tags: [lead.temperature, lead.service],
      customFields: [
        { key: 'timeline', value: lead.timeline },
        { key: 'problem', value: lead.problem },
        { key: 'source', value: lead.source },
        { key: 'submitted', value: lead.submitted },
        ...(lead.conversationUrl ? [{ key: 'conversation_url', value: lead.conversationUrl }] : []),
      ],
    };
  }

  async create(lead) {
    const payload = this._mapLead(lead);
    const res = await fetch(`${GHL_BASE}/contacts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Version: '2021-07-28',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GHL create failed: ${res.status} ${body}`);
    }
    const data = await res.json();
    return { status: res.status, id: data.contact?.id };
  }

  async update(id, lead) {
    const payload = this._mapLead(lead);
    const res = await fetch(`${GHL_BASE}/contacts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Version: '2021-07-28',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GHL update failed: ${res.status} ${body}`);
    }
    return { status: res.status };
  }
}

module.exports = GoHighLevelAdapter;
