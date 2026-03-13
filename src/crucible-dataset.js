#!/usr/bin/env node
/**
 * Crucible Dataset Generator — Synthetic 2,000 conversation dataset
 * for local weight optimization. Zero API calls.
 */

const fs = require('fs');
const path = require('path');

// Seeded PRNG for reproducibility
class SeededRandom {
  constructor(seed = 42) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  pickN(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = Math.floor(this.next() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
  chance(p) { return this.next() < p; }
  intBetween(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
}

// Service type distribution
const SERVICE_TYPES = [
  { type: 'hvac', weight: 0.30 },
  { type: 'plumbing', weight: 0.25 },
  { type: 'electrical', weight: 0.15 },
  { type: 'roofing', weight: 0.10 },
  { type: 'general_handyman', weight: 0.10 },
  { type: 'appliance_repair', weight: 0.05 },
  { type: 'pest_control', weight: 0.05 },
];

function pickServiceType(rng) {
  let r = rng.next();
  for (const s of SERVICE_TYPES) {
    r -= s.weight;
    if (r <= 0) return s.type;
  }
  return 'hvac';
}

// Names pool
const FIRST_NAMES = ['Mike', 'Sarah', 'Dave', 'Lisa', 'Tom', 'Jessica', 'Chris', 'Amanda', 'John', 'Maria', 'James', 'Ashley', 'Robert', 'Jennifer', 'Carlos', 'Emily', 'Kevin', 'Nicole', 'Brian', 'Stephanie', 'Dan', 'Rachel', 'Steve', 'Megan', 'Tony', 'Laura', 'Mark', 'Angela', 'Alex', 'Kim'];

// Lead message templates by category
const EASY_CONVERT_OPENERS = {
  hvac: [
    "hey my ac went out need someone to come look at it",
    "Hi, our furnace stopped working this morning. Can you send someone?",
    "AC is blowing warm air, need it fixed asap",
    "hey 👋 need my hvac serviced. when can someone come out?",
    "Our heater isnt working and its cold. need help",
    "hi i need a new thermostat installed. when are you available?",
    "my ac unit is making a loud noise and not cooling",
    "Need annual maintenance on my HVAC system",
    "Hey! Looking to get a quote on a new AC unit",
    "furnace keeps shutting off. Can you fix it?",
  ],
  plumbing: [
    "got a leaky faucet in the kitchen, can someone come fix it?",
    "Hi need a plumber for a clogged drain",
    "water heater is acting up, need someone to look at it",
    "hey our toilet keeps running. need it fixed",
    "need a new garbage disposal installed",
    "bathroom sink is dripping nonstop",
    "need someone to fix a pipe under the sink",
    "Hi, looking to get a water softener installed",
    "shower drain is super slow, need help",
    "my main sewer line might be backed up",
  ],
  electrical: [
    "need an electrician to install some outlets",
    "hey our breaker keeps tripping, need someone to check it",
    "want to get a ceiling fan installed",
    "need to upgrade my electrical panel",
    "some of my outlets stopped working",
    "looking to get recessed lighting installed",
    "need a whole house surge protector put in",
  ],
  roofing: [
    "got a leak in my roof after the storm",
    "need a quote on a new roof",
    "some shingles blew off, need repair",
    "looking to get my roof inspected",
    "roof is about 20 years old, thinking about replacing",
  ],
  general_handyman: [
    "need some drywall patched up",
    "looking for someone to assemble some furniture",
    "got a few odd jobs around the house",
    "need a door replaced and some shelves hung",
    "fence needs repair, couple boards fell off",
  ],
  appliance_repair: [
    "my dishwasher stopped draining",
    "dryer not heating up anymore",
    "fridge is making weird noises",
    "washing machine wont spin",
    "oven isnt heating to the right temp",
  ],
  pest_control: [
    "seeing a lot of ants in the kitchen",
    "think we might have mice in the attic",
    "need someone for termite inspection",
    "wasps built a nest by the front door",
    "seeing roaches, need someone out asap",
  ],
};

const AGENT_RESPONSES = {
  greeting: [
    "Hey {name}! Thanks for reaching out. I'd love to help. Can you tell me a bit more about what's going on?",
    "Hi {name}! Sorry to hear about that. Let me get you connected with someone who can help. Where are you located?",
    "Hey there! We can definitely help with that. What area are you in?",
    "Hi! Thanks for texting us. What's your zip code so I can find the right tech for you?",
    "Hey {name}! Let's get that taken care of. When did this start?",
  ],
  qualify: [
    "Makes sense. How long has this been going on?",
    "Ok, and are you the homeowner?",
    "Got it. When would work best for you?",
    "Sure thing. How urgent is this for you?",
    "Got it. Can you tell me a bit more about what's happening?",
  ],
  transfer: [
    "Perfect, let me get one of our techs to give you a call shortly.",
    "Great, I'll have someone reach out to you right away.",
    "Awesome, we can get someone out there. I'll have our team call you.",
    "I'll connect you with our team. They'll call you within the hour.",
  ],
  empathy: [
    "Oh man, that's no fun. Let's get that sorted out for you.",
    "I totally understand the frustration. We deal with this all the time.",
    "That definitely needs attention. Good thing you reached out.",
    "Yeah that's not something you want to wait on. Let's get it handled.",
  ],
};

const OBJECTION_MESSAGES = {
  price: [
    "how much is this gonna cost though?",
    "idk thats kinda expensive. got any deals?",
    "yeah but whats the price range? i dont want to get ripped off",
    "thats more than i expected. can you do better on price?",
    "i got a quote from another company for less",
    "seems pricey tbh. what if i just do the basic service?",
  ],
  think_about_it: [
    "let me think about it",
    "i need to sleep on it. can i get back to you?",
    "not sure yet, gonna mull it over",
    "sounds good but i want to think it through first",
    "let me consider my options",
  ],
  spouse: [
    "gotta check with my wife first",
    "need to talk to my husband about it",
    "my partner handles this stuff, let me ask them",
    "i need to run it by my spouse",
    "let me see what my wife thinks",
  ],
  timing: [
    "not a great time right now actually",
    "maybe next month? things are crazy rn",
    "im pretty busy this week. later?",
    "can we do this after the holidays?",
    "bad timing. maybe in a few weeks",
  ],
  trust: [
    "how do i know youre legit?",
    "are you guys licensed and insured?",
    "do you have any reviews i can check?",
    "ive been burned by contractors before",
    "whats your bbb rating?",
  ],
  competitor: [
    "im getting quotes from a couple places",
    "another company said they could do it cheaper",
    "what makes you guys different from [competitor]?",
    "i already have a guy but wanted to compare",
    "got a lower quote from someone else",
  ],
  diy: [
    "i was thinking about just doing it myself",
    "watched some youtube videos, seems doable",
    "is this something i could fix on my own?",
    "might just try the diy route first",
    "how hard would it be to do myself?",
  ],
};

const AGENT_OBJECTION_HANDLERS = {
  price: [
    "Totally get it — pricing varies based on the specific issue. Our techs give free estimates so you know exactly what you're looking at before committing.",
    "I hear you on the cost concern. We're competitive and we don't charge hidden fees. Want to at least get a free quote?",
  ],
  think_about_it: [
    "No pressure at all! Just keep in mind these things can get worse if left too long. Want me to check in tomorrow?",
    "Absolutely, take your time. I'll be here whenever you're ready.",
  ],
  spouse: [
    "Of course! Chat with them and let me know. We're here when you're ready.",
    "Makes sense. If it helps, I can send you some info to share with them?",
  ],
  timing: [
    "No worries! Want me to follow up in a couple weeks?",
    "Totally understand. We're not going anywhere — just reach out when you're ready.",
  ],
  trust: [
    "Great question! We're fully licensed, insured, and bonded. Happy to share our reviews too.",
    "We've been doing this for over 10 years with a 4.8 rating. Want me to send you our reviews?",
  ],
  competitor: [
    "We love competition! Our guys are top-rated and we guarantee our work. Worth getting our quote to compare.",
    "Smart to compare. We're happy to beat any written quote from a licensed contractor.",
  ],
  diy: [
    "Hey if you're handy, more power to you! Just be careful — some of this stuff can cause more damage if not done right.",
    "Totally fair. If you run into trouble or want a pro opinion, we're here.",
  ],
};

const HOSTILE_MESSAGES = [
  "wrong number",
  "stop texting me",
  "who is this",
  "not interested. dont text again",
  "k",
  "lol no",
  "🖕",
  "remove me from your list",
  "this is spam",
  "leave me alone",
  "i didnt ask for this",
  "no",
  "nah",
  "why are you texting me",
  "unsubscribe",
  "reported as spam",
  "get lost",
  "dont need anything",
  "im good thanks",
  "pass",
];

const HOSTILE_FOLLOWUPS = [
  "i said stop",
  "still not interested",
  "bruh",
  "...",
  "whatever",
  "can you not",
  "omg stop",
  "STOP",
  "NO",
];

const EMERGENCY_OPENERS = {
  hvac: [
    "NO HEAT and its 15 degrees outside!! kids are freezing please help!!",
    "my furnace is making a loud banging noise and i smell gas!!!",
    "AC completely died in the middle of a heat wave. elderly parent lives here",
    "CARBON MONOXIDE ALARM GOING OFF. is this you guys???",
    "heater caught fire!! its out now but no heat and its freezing",
  ],
  plumbing: [
    "PIPE BURST in the basement!! water everywhere!!! need someone NOW",
    "sewage backing up into bathtub. this is disgusting please help",
    "hot water heater is leaking all over the floor. help!!",
    "toilet overflowing and wont stop. water going into hallway",
    "main water line broke. yard is flooding. EMERGENCY",
  ],
  electrical: [
    "OUTLET IS SPARKING!! i turned off the breaker but im scared",
    "smell burning from the wall. electrical fire??",
    "power out in half the house. breaker wont reset",
    "lights flickering and buzzing sound in the walls. DANGEROUS?",
    "kids room outlet started smoking. please send someone ASAP",
  ],
  roofing: [
    "TREE FELL ON MY ROOF during the storm!! rain coming in everywhere",
    "huge chunk of roof missing after tornado. need emergency tarp at minimum",
    "roof caved in from the snow. water pouring into the house",
  ],
};

const SLOW_BURNER_OPENERS = [
  "hey just wondering about your services",
  "hi",
  "what do you guys do exactly",
  "got your number from a friend. just looking for info",
  "thinking about maybe getting some work done",
  "how does this work?",
  "do you guys do free estimates?",
  "just browsing. what areas do you serve?",
  "👋",
  "might need some help eventually. what are your rates?",
];

const SLOW_BURNER_WARMUPS = [
  "oh ok. yeah i might need that actually",
  "hmm interesting. my {issue} has been bugging me",
  "actually yeah thats exactly what i need",
  "ok you guys sound legit. how do we start?",
  "alright im interested. what do you need from me?",
  "yeah lets do it. whats the next step?",
];

// Warmups that clearly indicate buying intent → for transfer outcomes
const SLOW_BURNER_WARMUPS_TRANSFER = [
  "ok you guys sound legit. how do we start?",
  "alright im interested. what do you need from me?",
  "yeah lets do it. whats the next step?",
  "actually yeah thats exactly what i need. when can you come out?",
  "ok im convinced. send someone out",
  "alright sign me up. whats your availability?",
];

// Warmups that show interest but not commitment → for nurture outcomes
const SLOW_BURNER_WARMUPS_NURTURE = [
  "hmm interesting. ill think about it",
  "ok good to know. let me consider it",
  "maybe. what would something like that cost?",
  "interesting. ill keep you guys in mind",
  "not sure yet but thanks for the info",
  "ok ill talk to my wife about it and get back to you",
];

const MULTI_SERVICE_REVEALS = [
  "oh and while youre at it, i also need {service2}",
  "actually i just noticed {issue2} too. can you handle that?",
  "one more thing — {issue2}. can you do both?",
  "since youre coming out anyway, could you also look at {issue2}?",
];

const COMMERCIAL_OPENERS = [
  "Hi, I manage a commercial property and need {service}",
  "hey this is for our restaurant. we need {service} done",
  "I'm a property manager with 12 units. need {service}",
  "office building needs {service}. do you do commercial?",
  "we run a hotel and need {service} for multiple rooms",
  "apartment complex here. need {service} for 3 units",
];

const EDGE_CASE_TEMPLATES = {
  verbose: [
    "Ok so here's the deal. About three weeks ago I noticed that my {service} started acting weird. At first it was just a little thing, like sometimes it would make this clicking noise when it turned on, but then it started getting worse and now it's basically not working at all. My neighbor said it might be the {component} but I'm not sure. I tried looking online but everything just says to call a professional. My house is about 2000 sq ft and the system is probably 12 years old if that helps. What do you think?",
    "So I've been having this issue for a while now and I keep putting it off but I think it's time to actually deal with it. The {service} in our house has never been great honestly but lately it's been really bad. We had someone come out like 2 years ago and they said we'd need to replace the whole thing eventually but we were hoping to get more life out of it. Now I'm not so sure. What would you recommend?",
  ],
  multilingual: [
    "hola, necesito ayuda con mi {service}. do you speak spanish?",
    "cześć, potrzebuję pomocy z {service}. is there anyone who speaks polish?",
    "hi ich brauche hilfe mit meinem {service}. do you have german speaking techs?",
    "salut, j'ai besoin d'aide avec {service}. anyone speak french?",
  ],
  multiple_decision_makers: [
    "me and my roommate both think we need {service} but we cant agree on when. can you give us options?",
    "im texting for my mom. she needs {service} but shes not great with phones. can i coordinate?",
    "my landlord said i need to get {service} done. they want a quote sent to them too",
  ],
  returning: [
    "hey you guys came out last month for {service}. same issue is back",
    "hi, i used your service before and was happy. need you again for {service}",
    "following up from our earlier conversation about {service}. ready to move forward",
  ],
  insurance: [
    "storm damage to my {service}. need to file an insurance claim. can you help with that?",
    "insurance company needs an estimate for {service} repair. do you do that?",
    "got flood damage. insurance is covering {service} replacement. how does this work?",
  ],
};

const SERVICE_ISSUES = {
  hvac: { issue: 'AC', issue2: 'furnace too', component: 'compressor', service2: 'duct cleaning' },
  plumbing: { issue: 'pipes', issue2: 'water heater', component: 'valve', service2: 'drain cleaning' },
  electrical: { issue: 'wiring', issue2: 'panel upgrade', component: 'breaker', service2: 'outlet installation' },
  roofing: { issue: 'roof', issue2: 'gutter repair', component: 'flashing', service2: 'skylight repair' },
  general_handyman: { issue: 'deck', issue2: 'fence repair', component: 'boards', service2: 'drywall patching' },
  appliance_repair: { issue: 'dishwasher', issue2: 'dryer', component: 'motor', service2: 'fridge repair' },
  pest_control: { issue: 'ant problem', issue2: 'termites', component: 'nest', service2: 'rodent control' },
};

function templateReplace(text, service, rng) {
  const info = SERVICE_ISSUES[service] || SERVICE_ISSUES.hvac;
  return text
    .replace(/\{service\}/g, service.replace(/_/g, ' '))
    .replace(/\{service2\}/g, info.service2)
    .replace(/\{issue\}/g, info.issue)
    .replace(/\{issue2\}/g, info.issue2)
    .replace(/\{component\}/g, info.component)
    .replace(/\{name\}/g, rng.pick(FIRST_NAMES));
}

function generateConversation(id, category, service, rng) {
  const conv = {
    id: `crucible-${id.toString().padStart(4, '0')}`,
    service_type: service,
    category,
    messages: [],
    expected_outcome: 'transfer',
    expected_momentum_trend: 'rising',
    objection_types: [],
  };

  const name = rng.pick(FIRST_NAMES);

  switch (category) {
    case 'easy_convert':
      return generateEasyConvert(conv, service, name, rng);
    case 'objection_heavy':
      return generateObjectionHeavy(conv, service, name, rng);
    case 'slow_burner':
      return generateSlowBurner(conv, service, name, rng);
    case 'hostile':
      return generateHostile(conv, service, name, rng);
    case 'emergency':
      return generateEmergency(conv, service, name, rng);
    case 'multi_service':
      return generateMultiService(conv, service, name, rng);
    case 'commercial':
      return generateCommercial(conv, service, name, rng);
    case 'edge_case':
      return generateEdgeCase(conv, service, name, rng);
    default:
      return generateEasyConvert(conv, service, name, rng);
  }
}

function generateEasyConvert(conv, service, name, rng) {
  const openers = EASY_CONVERT_OPENERS[service] || EASY_CONVERT_OPENERS.hvac;
  conv.messages.push({ role: 'lead', text: rng.pick(openers) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.greeting), service, rng) });
  
  // Quick qualification — conversational detail sharing (we already have their contact info)
  const qualifyResponses = [
    `yeah its been going on for like ${rng.intBetween(1, 5)} days`,
    `yes im the homeowner. been here ${rng.intBetween(2, 15)} years`,
    `started yesterday, getting worse`,
    `yeah its pretty bad. been dealing with it since ${rng.pick(['monday', 'last week', 'yesterday', 'this morning'])}`,
  ];
  conv.messages.push({ role: 'lead', text: rng.pick(qualifyResponses) });
  conv.messages.push({ role: 'agent', text: rng.pick(AGENT_RESPONSES.transfer) });
  
  // Buy commitment instead of phone number
  const commitResponses = [
    `sounds good lets do it`,
    `yeah that works. send someone out`,
    `perfect, lets get it scheduled`,
    `great, yeah go ahead`,
    `absolutely, when can someone come?`,
  ];
  conv.messages.push({ role: 'lead', text: rng.pick(commitResponses) });

  conv.expected_outcome = 'transfer';
  conv.expected_momentum_trend = 'rising';
  return conv;
}

function generateObjectionHeavy(conv, service, name, rng) {
  const openers = EASY_CONVERT_OPENERS[service] || EASY_CONVERT_OPENERS.hvac;
  conv.messages.push({ role: 'lead', text: rng.pick(openers) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.greeting), service, rng) });

  // Pick 1-2 objection types
  const objTypes = Object.keys(OBJECTION_MESSAGES);
  const numObjections = rng.chance(0.4) ? 2 : 1;
  const selectedObjections = rng.pickN(objTypes, numObjections);
  conv.objection_types = selectedObjections;

  for (const objType of selectedObjections) {
    conv.messages.push({ role: 'lead', text: rng.pick(OBJECTION_MESSAGES[objType]) });
    conv.messages.push({ role: 'agent', text: rng.pick(AGENT_OBJECTION_HANDLERS[objType]) });
  }

  // 60% overcome objection → transfer, 40% nurture
  if (rng.chance(0.6)) {
    conv.messages.push({ role: 'lead', text: rng.pick([
      "ok yeah that makes sense. lets do it",
      "alright fine, send someone out",
      "ok you convinced me lol. whats next?",
      "sure lets at least get a quote",
      "yeah ok lets go ahead and schedule it",
    ]) });
    conv.expected_outcome = 'transfer';
    conv.expected_momentum_trend = 'rising';
  } else {
    conv.messages.push({ role: 'lead', text: rng.pick([
      "ill think about it and get back to you",
      "ok thanks for the info. ill let you know",
      "gonna talk to my wife first. thanks",
      "not right now but maybe later",
    ]) });
    conv.expected_outcome = 'nurture';
    conv.expected_momentum_trend = 'flat';
  }

  return conv;
}

function generateSlowBurner(conv, service, name, rng) {
  conv.messages.push({ role: 'lead', text: rng.pick(SLOW_BURNER_OPENERS) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.greeting), service, rng) });

  // Low engagement response
  conv.messages.push({ role: 'lead', text: rng.pick([
    "yeah maybe",
    "idk. just looking",
    "what does that cost",
    "hmm",
    "tell me more",
    "not sure what i need yet",
  ]) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.empathy), service, rng) });

  // Gradual warm up — use appropriate warmup pool based on outcome
  if (rng.chance(0.5)) {
    const warmup = templateReplace(rng.pick(SLOW_BURNER_WARMUPS_TRANSFER), service, rng);
    conv.messages.push({ role: 'lead', text: warmup });
    conv.messages.push({ role: 'agent', text: rng.pick(AGENT_RESPONSES.transfer) });
    conv.expected_outcome = 'transfer';
    conv.expected_momentum_trend = 'rising';
  } else {
    const warmup = templateReplace(rng.pick(SLOW_BURNER_WARMUPS_NURTURE), service, rng);
    conv.messages.push({ role: 'lead', text: warmup });
    conv.expected_outcome = 'nurture';
    conv.expected_momentum_trend = 'rising';
  }

  return conv;
}

function generateHostile(conv, service, name, rng) {
  conv.messages.push({ role: 'lead', text: rng.pick(HOSTILE_MESSAGES) });
  conv.messages.push({ role: 'agent', text: rng.pick([
    "Hey there! Sorry if the timing is off. We're here if you ever need help with home services.",
    "No worries at all! We'll remove you from our list. Have a good one!",
    "Understood! If you ever need anything, don't hesitate to reach out.",
  ]) });

  if (rng.chance(0.6)) {
    conv.messages.push({ role: 'lead', text: rng.pick(HOSTILE_FOLLOWUPS) });
  }

  conv.expected_outcome = 'block';
  conv.expected_momentum_trend = 'falling';
  conv.objection_types = [];
  return conv;
}

function generateEmergency(conv, service, name, rng) {
  const emergencyServices = ['hvac', 'plumbing', 'electrical', 'roofing'];
  const eService = emergencyServices.includes(service) ? service : rng.pick(emergencyServices);
  conv.service_type = eService;
  
  const openers = EMERGENCY_OPENERS[eService] || EMERGENCY_OPENERS.plumbing;
  conv.messages.push({ role: 'lead', text: rng.pick(openers) });
  conv.messages.push({ role: 'agent', text: rng.pick([
    "I understand this is urgent! Let me get someone to you right away.",
    "Oh no, that sounds serious! We have emergency techs available. I'm dispatching someone now.",
    "Don't worry, we'll get this handled ASAP. Let me connect you with our emergency team.",
  ]) });

  conv.messages.push({ role: 'lead', text: rng.pick([
    `yes please hurry!! its getting worse`,
    `PLEASE HURRY. send someone right now`,
    `come now!! this is an emergency`,
    `yes send someone ASAP please!!`,
  ]) });

  conv.expected_outcome = 'transfer';
  conv.expected_momentum_trend = 'rising';
  return conv;
}

function generateMultiService(conv, service, name, rng) {
  const openers = EASY_CONVERT_OPENERS[service] || EASY_CONVERT_OPENERS.hvac;
  conv.messages.push({ role: 'lead', text: rng.pick(openers) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.greeting), service, rng) });
  conv.messages.push({ role: 'lead', text: rng.pick([
    `yeah its been a problem for a while`,
    `started last week`,
    `pretty bad tbh`,
  ]) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.qualify), service, rng) });
  
  // Reveal second service
  conv.messages.push({ role: 'lead', text: templateReplace(rng.pick(MULTI_SERVICE_REVEALS), service, rng) });
  conv.messages.push({ role: 'agent', text: rng.pick(AGENT_RESPONSES.transfer) });

  conv.expected_outcome = 'transfer';
  conv.expected_momentum_trend = 'rising';
  return conv;
}

function generateCommercial(conv, service, name, rng) {
  const opener = templateReplace(rng.pick(COMMERCIAL_OPENERS), service, rng);
  conv.messages.push({ role: 'lead', text: opener });
  conv.messages.push({ role: 'agent', text: "Absolutely, we handle commercial work! Can you tell me more about the scope of the project?" });
  conv.messages.push({ role: 'lead', text: rng.pick([
    `yeah we have ${rng.intBetween(3, 20)} units that need ${service.replace(/_/g, ' ')} work`,
    `its a ${rng.intBetween(5000, 50000)} sq ft building`,
    `we need ongoing service for our ${rng.pick(['restaurant', 'office', 'warehouse', 'apartment complex'])}`,
  ]) });
  conv.messages.push({ role: 'agent', text: rng.pick(AGENT_RESPONSES.transfer) });

  if (rng.chance(0.7)) {
    conv.messages.push({ role: 'lead', text: rng.pick([`sure lets set it up. ask for ${name}`, `sounds good, go ahead and schedule it`, `yeah lets do it`]) });
    conv.expected_outcome = 'transfer';
  } else {
    conv.messages.push({ role: 'lead', text: "let me check with the building owner first and get back to you" });
    conv.expected_outcome = 'nurture';
  }
  conv.expected_momentum_trend = 'rising';
  return conv;
}

function generateEdgeCase(conv, service, name, rng) {
  const edgeTypes = Object.keys(EDGE_CASE_TEMPLATES);
  const edgeType = rng.pick(edgeTypes);
  const templates = EDGE_CASE_TEMPLATES[edgeType];
  
  conv.messages.push({ role: 'lead', text: templateReplace(rng.pick(templates), service, rng) });
  conv.messages.push({ role: 'agent', text: templateReplace(rng.pick(AGENT_RESPONSES.greeting), service, rng) });

  if (edgeType === 'verbose') {
    conv.messages.push({ role: 'lead', text: rng.pick([
      "yeah exactly. so what do you think? can you help?",
      "thats basically it. how much would something like that cost?",
    ]) });
    conv.messages.push({ role: 'agent', text: rng.pick(AGENT_RESPONSES.transfer) });
    conv.expected_outcome = 'transfer';
  } else if (edgeType === 'multilingual') {
    conv.messages.push({ role: 'lead', text: rng.pick([
      "ok great. yes i need help. when can you come?",
      "si, necesito ayuda. when are you available?",
    ]) });
    conv.messages.push({ role: 'agent', text: rng.pick(AGENT_RESPONSES.transfer) });
    conv.expected_outcome = 'transfer';
  } else if (edgeType === 'multiple_decision_makers') {
    conv.messages.push({ role: 'lead', text: "let me check with everyone and get back to you" });
    conv.expected_outcome = 'nurture';
  } else if (edgeType === 'returning') {
    conv.messages.push({ role: 'lead', text: rng.pick([
      "yeah same thing. can you send the same tech?",
      "ready to go. same phone number as before",
    ]) });
    conv.expected_outcome = 'transfer';
  } else if (edgeType === 'insurance') {
    if (rng.chance(0.6)) {
      conv.messages.push({ role: 'lead', text: rng.pick([
        "my adjuster needs a written estimate. can you do that? when can someone come out?",
        "insurance approved it. ready to schedule the work",
        "yes lets get this done. insurance is covering it. whats next?",
      ]) });
      conv.expected_outcome = 'transfer';
    } else {
      conv.messages.push({ role: 'lead', text: rng.pick([
        "insurance said to get 3 quotes. youre number 2",
        "just getting estimates for now. ill let you know",
        "my adjuster needs a written estimate. can you do that?",
      ]) });
      conv.expected_outcome = 'nurture';
    }
  }

  conv.expected_momentum_trend = conv.expected_outcome === 'block' ? 'falling' : 'rising';
  return conv;
}

function generateDataset(seed = 42) {
  const rng = new SeededRandom(seed);

  const archetypeCounts = [
    { category: 'easy_convert', count: 500 },
    { category: 'objection_heavy', count: 400 },
    { category: 'slow_burner', count: 300 },
    { category: 'hostile', count: 200 },
    { category: 'emergency', count: 200 },
    { category: 'multi_service', count: 150 },
    { category: 'commercial', count: 100 },
    { category: 'edge_case', count: 150 },
  ];

  const conversations = [];
  let id = 1;

  for (const { category, count } of archetypeCounts) {
    for (let i = 0; i < count; i++) {
      const service = pickServiceType(rng);
      conversations.push(generateConversation(id++, category, service, rng));
    }
  }

  return conversations;
}

function saveDataset(conversations, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(conversations, null, 2));
  console.log(`[CrucibleDataset] Generated ${conversations.length} conversations → ${outputPath}`);
  
  // Print category breakdown
  const cats = {};
  for (const c of conversations) {
    cats[c.category] = (cats[c.category] || 0) + 1;
  }
  console.log('[CrucibleDataset] Category breakdown:');
  for (const [cat, count] of Object.entries(cats)) {
    console.log(`  ${cat}: ${count}`);
  }
  
  const outcomes = {};
  for (const c of conversations) {
    outcomes[c.expected_outcome] = (outcomes[c.expected_outcome] || 0) + 1;
  }
  console.log('[CrucibleDataset] Expected outcomes:');
  for (const [outcome, count] of Object.entries(outcomes)) {
    console.log(`  ${outcome}: ${count}`);
  }
}

// CLI
if (require.main === module) {
  const outputPath = path.join(__dirname, '..', 'data', 'crucible-dataset.json');
  const dataset = generateDataset(42);
  saveDataset(dataset, outputPath);
}

module.exports = { generateDataset, saveDataset, SeededRandom };
