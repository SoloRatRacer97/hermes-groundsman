'use strict';

/**
 * HubSpot CRM adapter — stub wired to correct API format, ready for production keys.
 * Docs: https://developers.hubspot.com/docs/api/crm/contacts
 */
const HS_BASE = 'https://api.hubapi.com/crm/v3';

class HubSpotAdapter {
  constructor({ apiKey }) {
    if (!apiKey) throw new Error('CRM_API_KEY is required for HubSpot adapter');
    this.apiKey = apiKey;
  }

  _mapLead(lead) {
    return {
      properties: {
        firstname: lead.name.split(' ')[0] || lead.name,
        lastname: lead.name.split(' ').slice(1).join(' ') || '',
        phone: lead.phone,
        email: lead.email || '',
        hs_lead_status: lead.temperature === 'HOT' ? 'NEW' : lead.temperature === 'WARM' ? 'OPEN' : 'UNQUALIFIED',
        service_requested: lead.service,
        timeline: lead.timeline,
        problem_description: lead.problem,
        lead_source: lead.source,
        submitted_date: lead.submitted,
        ...(lead.conversationUrl && { conversation_url: lead.conversationUrl }),
      },
    };
  }

  async create(lead) {
    const payload = this._mapLead(lead);
    const res = await fetch(`${HS_BASE}/objects/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HubSpot create failed: ${res.status} ${body}`);
    }
    const data = await res.json();
    return { status: res.status, id: data.id };
  }

  async update(id, lead) {
    const payload = this._mapLead(lead);
    const res = await fetch(`${HS_BASE}/objects/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HubSpot update failed: ${res.status} ${body}`);
    }
    return { status: res.status };
  }
}

module.exports = HubSpotAdapter;
