#!/usr/bin/env node
/**
 * Hermes Demo Infrastructure Setup
 * Creates: Slack channel → Asana project → Google Form
 * For: Google Form → Asana → Slack → Hermes pipeline
 */

const { WebClient } = require('@slack/web-api');
const { google } = require('googleapis');
const asana = require('asana');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  slack: {
    token: process.env.SLACK_BOT_TOKEN,
    channelName: '001-hermes-leads',
    channelPurpose: 'Receives lead notifications from Zapier for Hermes demo'
  },
  asana: {
    token: process.env.ASANA_PAT,
    projectName: 'Hermes Skeleton Build',
    workspaceGid: process.env.ASANA_WORKSPACE_GID
  },
  google: {
    formTitle: 'Lawn Care Service Request',
    formDescription: 'Get a free quote for your lawn care needs!',
    confirmationMessage: "Thanks! We'll text you within 5 minutes."
  }
};

// Results storage
const results = {
  slack: {},
  asana: {},
  google: {},
  errors: []
};

/**
 * Step 1: Create Slack Channel
 */
async function createSlackChannel() {
  console.log('\n📱 Step 1: Creating Slack Channel...');
  
  if (!CONFIG.slack.token) {
    const error = 'SLACK_BOT_TOKEN not found. Please set it in environment.';
    console.error('❌', error);
    results.errors.push(error);
    return false;
  }

  try {
    const slack = new WebClient(CONFIG.slack.token);
    
    // Check if channel already exists
    const channels = await slack.conversations.list({
      types: 'private_channel,public_channel'
    });
    
    const existing = channels.channels.find(c => c.name === CONFIG.slack.channelName);
    
    if (existing) {
      console.log(`✅ Channel #${CONFIG.slack.channelName} already exists`);
      results.slack = {
        id: existing.id,
        name: existing.name,
        url: `https://app.slack.com/client/${existing.id}`
      };
      return true;
    }
    
    // Create new private channel
    const result = await slack.conversations.create({
      name: CONFIG.slack.channelName,
      is_private: true
    });
    
    // Set channel purpose
    await slack.conversations.setPurpose({
      channel: result.channel.id,
      purpose: CONFIG.slack.channelPurpose
    });
    
    // Post initialization message
    await slack.chat.postMessage({
      channel: result.channel.id,
      text: '🚀 *Hermes Demo Infrastructure Initialized*\n\nThis channel will receive lead notifications from Zapier.\n\n*Flow:* Google Form → Asana → Slack → Hermes Agent'
    });
    
    results.slack = {
      id: result.channel.id,
      name: result.channel.name,
      url: `https://app.slack.com/client/${result.channel.id}`
    };
    
    console.log(`✅ Created channel: #${result.channel.name}`);
    console.log(`   Channel ID: ${result.channel.id}`);
    return true;
    
  } catch (error) {
    console.error('❌ Slack channel creation failed:', error.message);
    results.errors.push(`Slack: ${error.message}`);
    return false;
  }
}

/**
 * Step 2: Create Asana Project
 */
async function createAsanaProject() {
  console.log('\n📋 Step 2: Creating Asana Project...');
  
  if (!CONFIG.asana.token) {
    const error = 'ASANA_PAT not found. Please set it in environment.';
    console.error('❌', error);
    results.errors.push(error);
    return false;
  }

  try {
    const client = asana.Client.create().useAccessToken(CONFIG.asana.token);
    
    // Get workspace
    let workspaceGid = CONFIG.asana.workspaceGid;
    if (!workspaceGid) {
      const workspaces = await client.workspaces.getWorkspaces();
      workspaceGid = workspaces.data[0].gid;
      console.log(`   Using workspace: ${workspaces.data[0].name}`);
    }
    
    // Create project
    const project = await client.projects.createProject({
      name: CONFIG.asana.projectName,
      workspace: workspaceGid,
      notes: 'Hermes demo CRM - tracks leads from Google Form submissions',
      color: 'light-green',
      layout: 'board'
    });
    
    console.log(`✅ Created project: ${project.name}`);
    console.log(`   Project ID: ${project.gid}`);
    
    // Create sections
    const sections = ['New Leads', 'Contacted', 'Qualified', 'Closed'];
    for (const sectionName of sections) {
      await client.sections.createSectionForProject(project.gid, {
        name: sectionName
      });
      console.log(`   ✓ Created section: ${sectionName}`);
    }
    
    // Create custom fields
    const customFields = [
      { name: 'Lead Name', type: 'text' },
      { name: 'Phone', type: 'text' },
      { name: 'Service Type', type: 'enum', enum_options: [
        { name: 'Lawn Mowing', color: 'green' },
        { name: 'Tree Trimming', color: 'yellow' },
        { name: 'Hardscaping', color: 'blue' }
      ]},
      { name: 'Status', type: 'enum', enum_options: [
        { name: 'New Lead', color: 'red' },
        { name: 'Contacted', color: 'yellow' },
        { name: 'Qualified', color: 'blue' },
        { name: 'Closed', color: 'green' }
      ]},
      { name: 'Lead Score', type: 'number', precision: 0 }
    ];
    
    const createdFields = [];
    for (const field of customFields) {
      const customField = await client.customFields.createCustomField({
        workspace: workspaceGid,
        resource_subtype: field.type,
        name: field.name,
        enum_options: field.enum_options,
        precision: field.precision
      });
      
      // Add to project
      await client.projects.addCustomFieldSettingForProject(project.gid, {
        custom_field: customField.gid,
        is_important: true
      });
      
      createdFields.push({ name: field.name, gid: customField.gid });
      console.log(`   ✓ Created custom field: ${field.name}`);
    }
    
    results.asana = {
      projectGid: project.gid,
      projectName: project.name,
      projectUrl: project.permalink_url,
      sections: sections,
      customFields: createdFields
    };
    
    return true;
    
  } catch (error) {
    console.error('❌ Asana project creation failed:', error.message);
    results.errors.push(`Asana: ${error.message}`);
    return false;
  }
}

/**
 * Step 3: Create Google Form
 */
async function createGoogleForm() {
  console.log('\n📝 Step 3: Creating Google Form...');
  
  try {
    // Load OAuth2 credentials
    const credPath = path.join(__dirname, 'config', 'google-credentials.json');
    const tokenPath = path.join(__dirname, 'config', 'google-token.json');
    
    if (!fs.existsSync(credPath)) {
      const error = 'Google credentials not found. Please run auth setup first.';
      console.error('❌', error);
      results.errors.push(error);
      return false;
    }
    
    const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const auth = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      credentials.installed.redirect_uris[0]
    );
    
    if (fs.existsSync(tokenPath)) {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      auth.setCredentials(token);
    } else {
      const error = 'Google token not found. Please run auth setup first.';
      console.error('❌', error);
      results.errors.push(error);
      return false;
    }
    
    const forms = google.forms({ version: 'v1', auth });
    
    // Create form
    const form = await forms.forms.create({
      requestBody: {
        info: {
          title: CONFIG.google.formTitle,
          documentTitle: CONFIG.google.formTitle
        }
      }
    });
    
    console.log(`✅ Created form: ${CONFIG.google.formTitle}`);
    console.log(`   Form ID: ${form.data.formId}`);
    
    // Update form with questions
    await forms.forms.batchUpdate({
      formId: form.data.formId,
      requestBody: {
        requests: [
          // Add description
          {
            updateFormInfo: {
              info: {
                description: CONFIG.google.formDescription
              },
              updateMask: 'description'
            }
          },
          // Add Name field
          {
            createItem: {
              item: {
                title: 'Name',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: {
                      paragraph: false
                    }
                  }
                }
              },
              location: { index: 0 }
            }
          },
          // Add Phone field
          {
            createItem: {
              item: {
                title: 'Phone',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: {
                      paragraph: false
                    }
                  }
                }
              },
              location: { index: 1 }
            }
          },
          // Add Service Type dropdown
          {
            createItem: {
              item: {
                title: 'Service Type',
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: 'DROP_DOWN',
                      options: [
                        { value: 'Lawn Mowing' },
                        { value: 'Tree Trimming' },
                        { value: 'Hardscaping' }
                      ]
                    }
                  }
                }
              },
              location: { index: 2 }
            }
          }
        ]
      }
    });
    
    // Update settings
    await forms.forms.batchUpdate({
      formId: form.data.formId,
      requestBody: {
        requests: [{
          updateSettings: {
            settings: {
              quizSettings: null
            },
            updateMask: 'quizSettings'
          }
        }]
      }
    });
    
    const responderUri = form.data.responderUri;
    
    results.google = {
      formId: form.data.formId,
      formUrl: responderUri,
      editUrl: `https://docs.google.com/forms/d/${form.data.formId}/edit`
    };
    
    console.log(`   Public URL: ${responderUri}`);
    console.log(`   Edit URL: ${results.google.editUrl}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Google Form creation failed:', error.message);
    results.errors.push(`Google Forms: ${error.message}`);
    return false;
  }
}

/**
 * Save results to file
 */
function saveResults() {
  const output = {
    timestamp: new Date().toISOString(),
    success: results.errors.length === 0,
    ...results
  };
  
  const outputPath = path.join(__dirname, 'demo-infrastructure-config.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Configuration saved to: ${outputPath}`);
  
  return output;
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('🎉 HERMES DEMO INFRASTRUCTURE SETUP COMPLETE');
  console.log('='.repeat(60));
  
  if (results.slack.id) {
    console.log('\n📱 SLACK CHANNEL:');
    console.log(`   Name: #${results.slack.name}`);
    console.log(`   ID: ${results.slack.id}`);
    console.log(`   Use this ID in Zapier: ${results.slack.id}`);
  }
  
  if (results.asana.projectGid) {
    console.log('\n📋 ASANA PROJECT:');
    console.log(`   Name: ${results.asana.projectName}`);
    console.log(`   ID: ${results.asana.projectGid}`);
    console.log(`   URL: ${results.asana.projectUrl}`);
    console.log(`   Sections: ${results.asana.sections.join(', ')}`);
  }
  
  if (results.google.formId) {
    console.log('\n📝 GOOGLE FORM:');
    console.log(`   Title: ${CONFIG.google.formTitle}`);
    console.log(`   ID: ${results.google.formId}`);
    console.log(`   Public URL: ${results.google.formUrl}`);
    console.log(`   Edit URL: ${results.google.editUrl}`);
    console.log(`\n   ⚠️  SHARE THIS URL FOR TESTING: ${results.google.formUrl}`);
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:');
    results.errors.forEach(err => console.log(`   - ${err}`));
  }
  
  console.log('\n📖 NEXT STEPS:');
  console.log('   1. Configure Zapier workflow (see DEMO-SETUP.md)');
  console.log('   2. Test the full pipeline by submitting the form');
  console.log('   3. Verify data flows: Form → Asana → Slack');
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Hermes Demo Infrastructure Setup...\n');
  
  // Run setup steps
  await createSlackChannel();
  await createAsanaProject();
  await createGoogleForm();
  
  // Save and display results
  saveResults();
  printSummary();
  
  process.exit(results.errors.length > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { createSlackChannel, createAsanaProject, createGoogleForm, results };
