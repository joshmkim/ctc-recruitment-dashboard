/**
 * Generates seed/seed_applicants.csv: a fake cohort in the exact shape of the
 * Google Form's response export.
 *
 *   node scripts/generate-seed.mjs
 *
 * Plain .mjs with no imports so it runs on a bare `node` without tsx or any
 * dependency, and so it cannot drift into being part of the app.
 *
 * The output is deliberately a CSV rather than direct database writes: seeding
 * then travels the same path as a real cohort, through the same parser and the
 * same import action, so exercising the seed exercises the importer.
 *
 * Random but not arbitrary — the PRNG is seeded, so regenerating produces a
 * byte-identical file and a diff on this script is the only way the seed moves.
 */

const APPLICANTS = 260;
/** Same person submitting twice. The importer keeps the later one, so the seed
 *  has more rows than applicants and the dedupe shows up in its report. */
const RESUBMISSIONS = 3;
const SEED = 20262027;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

let state = SEED;
function random() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (probability) => random() < probability;

function pickWeighted(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Amara", "Devan", "Priya", "Tomas", "Nadia", "Kwame", "Elena", "Rahul",
  "Sofia", "Malik", "Yuki", "Isabel", "Omar", "Freya", "Diego", "Aisha",
  "Lucas", "Mei", "Karim", "Anika", "Mateo", "Chiara", "Jonas", "Leila",
  "Andres", "Ingrid", "Hassan", "Rosa", "Niko", "Thandiwe", "Emre", "Paloma",
  "Sven", "Zainab", "Rafael", "Hana", "Bilal", "Marta", "Kenji", "Adaeze",
  "Viktor", "Camila", "Tariq", "Saoirse", "Joon", "Valeria", "Idris", "Noor",
  "Felix", "Ayaan", "Greta", "Santiago", "Lin", "Yara", "Dmitri", "Beatriz",
  "Arjun", "Mira", "Sekou", "Clara", "Hugo", "Amina", "Théo", "Rania",
  "Oscar", "Divya", "Levi", "Sanaa", "Milan", "Esther",
];

const LAST_NAMES = [
  "Osei", "Roy", "Venkatesan", "Lindqvist", "Haddad", "Mensah", "Petrova",
  "Chaudhry", "Marchetti", "Okonkwo", "Tanaka", "Reyes", "Farouk", "Solberg",
  "Cabrera", "Bello", "Nakamura", "Duarte", "Kowalski", "Adeyemi", "Silva",
  "Novak", "Bergström", "Nasser", "Ferreira", "Halvorsen", "Rahman", "Molina",
  "Papadakis", "Mabaso", "Yilmaz", "Guerrero", "Andersen", "Sadiq", "Costa",
  "Watanabe", "Iqbal", "Serrano", "Fujimoto", "Nwosu", "Volkov", "Almeida",
  "Nasr", "O'Donnell", "Park", "Ibarra", "Diallo", "Zaman", "Brandt", "Khan",
  "Lindgren", "Vargas", "Zhou", "Mansour", "Sokolov", "Pereira", "Nair",
  "Mwangi", "Beltran", "Hoffmann", "Ellis", "Trần", "Bourdon", "Aziz",
];

const MAJORS = [
  "Computer Science", "Computer Engineering and Computer Science",
  "Business Administration", "Applied and Computational Mathematics",
  "Economics", "Cognitive Science", "Data Science", "Industrial and Systems Engineering",
  "Communication", "Electrical Engineering", "Physics", "Neuroscience",
  "Computer Science and Business Administration", "Political Science",
  "Biomedical Engineering", "Design", "Environmental Studies",
  "Public Policy", "Mechanical Engineering", "Psychology",
  "Computer Science, Linguistics", "Economics, Mathematics",
  "International Relations", "Music Industry", "Statistics",
];

const MINORS = [
  "", "", "", "Computer Programming", "Design", "Applied Analytics",
  "Entrepreneurship", "Social Entrepreneurship", "Mathematics", "Cinematic Arts",
  "Human-Centered Design", "Data Analytics", "Public Health", "Spanish",
  "Music Recording", "Philosophy", "Occupational Science",
];

const ROLES = [
  { value: "Developer", weight: 6 },
  { value: "Designer", weight: 2 },
  { value: "Product Manager", weight: 2 },
];

const PRONOUNS = [
  { value: "she/her/hers", weight: 42 },
  { value: "he/him/his", weight: 42 },
  { value: "they/them/theirs", weight: 8 },
  { value: "she/they", weight: 3 },
  { value: "he/they", weight: 2 },
  { value: "", weight: 3 },
];

const GENDERS = [
  { value: "Female", weight: 45 },
  { value: "Male", weight: 45 },
  { value: "Nonbinary", weight: 5 },
  { value: "Prefer not to say", weight: 5 },
];

const RACES = [
  { value: "Asian", weight: 30 },
  { value: "White", weight: 24 },
  { value: "Hispanic or Latino", weight: 18 },
  { value: "Black or African American", weight: 10 },
  { value: "Two or more races", weight: 8 },
  { value: "Middle Eastern or North African", weight: 5 },
  { value: "Native Hawaiian or Other Pacific Islander", weight: 2 },
  { value: "American Indian or Alaska Native", weight: 1 },
  { value: "Prefer not to say", weight: 2 },
];

// ---------------------------------------------------------------------------
// Answers
//
// Composed from three pools per question rather than picked whole, so 260
// applications do not read as sixteen applications repeated. Tiers keep the tone
// coherent: a weak opening does not get a reflective closing, which is what makes
// scores spread instead of clustering.
// ---------------------------------------------------------------------------

const TIERS = [
  { value: "weak", weight: 20 },
  { value: "mid", weight: 50 },
  { value: "strong", weight: 30 },
];

const SUBJECTS = [
  "food waste in dining halls", "the cost of textbooks", "transit deserts near campus",
  "how few girls stayed in my school's robotics club", "digital literacy for older adults",
  "the way clinics schedule appointments", "how hard it is to find mental health care",
  "language access at the county courthouse", "e-waste from campus upgrades",
  "how volunteer tutoring gets matched", "unclaimed produce at the farmers market",
  "the paperwork small nonprofits drown in",
];

const ACTIONS = [
  "I started a weekly pickup that routes leftovers to a shelter downtown",
  "I built a spreadsheet, then an actual tool, that matches donations to need",
  "I organised a workshop and eleven people came to the first one",
  "I wrote a script that cut a four-hour manual process to about ten minutes",
  "I interviewed fourteen people before I wrote a single line of code",
  "I ran a pilot with one classroom before asking the district for anything",
  "I rebuilt their intake form so it stopped losing half the submissions",
  "I trained two other volunteers so it would survive me graduating",
];

const Q1 = {
  weak: {
    open: [
      "Something I care about is {subject}.",
      "I think {subject} is a real problem.",
      "{Subject} is important to me.",
      "The problem I would pick is {subject}.",
    ],
    close: [
      "I learned a lot from it.",
      "It taught me to keep going.",
      "I want to keep working on things like this.",
      "It was a good experience overall.",
    ],
  },
  mid: {
    open: [
      "I did not expect to care about {subject}, and then I spent a summer close to it.",
      "The problem I keep coming back to is {subject}, mostly because I watched it up close.",
      "{Subject} is small compared to what people usually write about here, which is exactly why nobody had fixed it.",
      "I got interested in {subject} through a job I took for the money and stayed in for other reasons.",
    ],
    close: [
      "What I learned was that the technical part was never the hard part.",
      "The lesson was that I should have asked the people doing the work before designing anything.",
      "I learned that a solution nobody adopts is worth less than no solution at all.",
      "It taught me to make the first version much smaller than I wanted to.",
    ],
  },
  strong: {
    open: [
      "I care about {subject}, and I want to be precise about why rather than gesturing at it.",
      "The problem I picked is {subject}, which sounds minor until you count how many hours it costs the people carrying it.",
      "I spent two years adjacent to {subject} before I felt entitled to an opinion about it.",
      "{Subject} is the problem I have actually done something about, so it is the one I will write about.",
    ],
    close: [
      "What I learned is that the most consequential decision in a project like this is usually not a technical one.",
      "The thing I got wrong was optimising for the outcome I could measure instead of the one that mattered.",
      "I learned to build the boring, durable version rather than the impressive one, because I would not be there in a year.",
      "What stayed with me is how much of the work was earning enough trust to be allowed to help.",
    ],
  },
};

const COMMUNITIES = [
  "a robotics team that met in a borrowed garage",
  "the kitchen of my family's restaurant",
  "a 6am swim squad nobody else wanted to join",
  "a debate circuit that travelled by van",
  "my high school's stage crew",
  "a community garden run entirely by retirees and me",
  "a Discord server for a game that died years ago",
  "the overnight shift at a campus radio station",
  "a mutual aid group that started as a group chat",
  "a church youth orchestra with no conductor",
];

const BELONGING = [
  "Nobody there cared what I was good at yet, only whether I showed up",
  "It was the first place where being confused out loud was normal",
  "We shared tools and, more importantly, shared credit",
  "The rule was that whoever knew the least got to ask first",
  "People stayed after to clean up without anyone organising it",
  "It ran on a hundred small favours nobody kept score of",
];

/** Scene-setting, so a mid or strong answer has some substance between its
 *  opening and its lesson rather than jumping straight to the moral. */
const Q1_CONTEXT = [
  "I spent last summer working somewhere it was impossible to ignore, and the pattern was always the same: the people closest to it had known about it for years and had never been asked",
  "The version of it I know best is narrow — one office, one process, maybe two hundred people affected — but I could see the whole shape of it from there",
  "What made it stick was realising that everybody involved was competent and well-meaning and it still did not work, which meant the problem was structural rather than anybody's fault",
  "I had assumed somebody upstream was handling it. Nobody was, and the reason nobody was is that it belonged to no single person's job description",
  "It is the kind of problem that never becomes urgent enough to fix, so it just quietly costs people hours every week forever",
];

const Q1_STAKES = [
  "It took about six weeks before anyone used it without being asked, and that was the real milestone rather than the day it worked",
  "The first version was worse than the spreadsheet it replaced, which was humbling and useful in roughly equal measure",
  "Two people still run it now that I have handed it over, which matters more to me than anything about how it was built",
  "It saves them somewhere around five hours a week, which is not dramatic, but it is five hours a week that nobody has to argue for",
  "I was wrong about which part would be hard, and I was wrong in the direction of thinking the code mattered most",
];

const Q2 = {
  weak: {
    open: ["I felt like I belonged to {community}.", "{Community} was my community.", "The community I would pick is {community}."],
    close: ["I hope to bring that energy to CTC.", "I want to bring that to the CTC family.", "I think CTC has that too."],
  },
  mid: {
    open: [
      "The community I belonged to was {community}, and it took me a year to notice it had become one.",
      "I found it in {community}, which is not where I expected to find it.",
      "{Community} is the honest answer, even though it is not the impressive one.",
    ],
    close: [
      "What I would bring into CTC is that habit of making the entry cost low.",
      "I would like to bring the part where the newest person is asked first.",
      "The thing worth carrying over is that nobody there performed competence they did not have.",
    ],
  },
  strong: {
    open: [
      "I belonged to {community}, and I have spent a while trying to work out what made it work so I could reproduce it.",
      "The community that shaped me most was {community}, mostly because it was bad at hierarchy.",
      "{Community} taught me that belonging is built out of logistics more than sentiment.",
    ],
    close: [
      "What I would bring to CTC is the unglamorous maintenance that keeps a community alive: the reminder message, the booked room, the noticing that somebody has gone quiet.",
      "I would want to bring the norm that you can say you do not understand something in a room full of people nodding.",
      "The thing I would carry in is that we lowered the bar to enter and raised it to stay, and both mattered.",
    ],
  },
};

const Q2_SCENES = [
  "We had almost nothing. One working laptop, a whiteboard somebody had rescued from a skip, and a standing agreement that you cleaned up whether or not it was your mess",
  "The whole thing ran on Sunday evenings, which meant everyone there had chosen it over something easier",
  "There was no hierarchy to speak of, which sounds idealistic and was mostly just practical: whoever knew how to do the thing did the thing, and taught the next person",
  "People turned up for each other's unrelated stuff — recitals, matches, one memorably grim moving day — and that is the part I did not appreciate until it stopped",
  "I joined because a friend dragged me and stayed because within a month three people had asked me to explain something and taken the answer seriously",
];

const MENTOR_TITLES = ["Ms.", "Mr.", "Dr.", "Coach", "Professor"];

const Q3_MEMORIES = [
  "The specific moment I keep returning to is the afternoon I handed in something I knew was mediocre, and instead of grading it you asked me what I would change if I had another week. I did not have an answer, which was the point",
  "I remember you stopping a whole session because one person had not followed, and doing it in a way that made it obvious the fault was in the explanation rather than in them. I have tried to run every meeting I lead like that since",
  "You told me once, fairly bluntly, that I was hiding behind how much I had read. It was the most useful unkind thing anyone has said to me",
  "There was a week where I was clearly out of my depth and you neither rescued me nor let me drown, which I now understand took actual restraint",
  "You gave me a job that was slightly too hard on purpose and then made it obvious you were nearby. I have never had a better arrangement",
];

const Q3_CLOSINGS = [
  "I do not think you would remember any of this, which is sort of the point — it cost you very little and it rearranged how I work",
  "I have not told you any of this, so consider this the version I would say badly in person",
  "Thank you for it. I am still working out how to do the same for somebody else without being insufferable about it",
  "I hope you are still doing it for whoever came after me",
];

const LESSONS = [
  "that a wrong answer said out loud is worth more than a right one kept quiet",
  "that I should write the thing down before I believe I understand it",
  'that "good enough, shipped" beats "perfect, someday"',
  "that being the least experienced person in a room is a resource, not a liability",
  "how to disagree with someone without making it about them",
  "that the person who asks the naive question is doing everyone a favour",
  "that I was allowed to start things without permission",
];

const Q4_PROJECTS = [
  "a scheduling tool for the volunteer tutoring programme I coordinate",
  "a static analysis pass that flags database queries inside loops",
  "a browser extension that strips recommendation feeds, now used by about 2,000 people",
  "an inventory app for my family's restaurant, written in Django one summer",
  "a model predicting missed clinic appointments, so patients could be called the day before",
  "a compiler for a small statically typed language, continued well past the course",
  "a screen reader plugin I shipped to roughly 60 users",
  "an internship on a payments team, mostly writing migrations and tests",
  "a research assistantship cleaning sensor data nobody had documented",
  "a parser for a niche scientific file format, now with eight regular bug reporters",
];

const Q4_LEARNINGS = [
  "The lesson was about adoption, not analysis: the first version had a 30% false positive rate and people turned it off inside a week",
  "What surprised me was the maintenance cost; I had thought of shipping as the finish line",
  "I learned that the optimal schedule was the one everybody hated, because I had optimised for the wrong thing",
  "The useful part was sitting with the people using it rather than asking them what they wanted in the abstract",
  "It taught me that a tool nobody trusts is worse than no tool, because it burns the next person's credibility too",
];

const Q4_STACK = [
  "Mostly Python and Postgres, with enough React to be dangerous",
  "TypeScript, a lot of SQL, and more shell scripting than I expected",
  "Go for the service, Figma for the parts I should not have been trusted with",
  "Java and C++ from coursework, Python and Django for anything I choose myself",
  "Swift for the app, and a Raspberry Pi doing something it was not designed for",
];

const Q4_EXCITED = [
  "I want to get better at systems design and at reading other people's code quickly",
  "I am eager to learn more about accessibility work and about testing that is actually worth maintaining",
  "I would like to get properly good at databases rather than superstitious about them",
  "I want to learn how to scope a project so it can ship in a semester",
  "I am keen to work on something with real users and real consequences for once",
];

const TALKS = [
  "how to read a subway map, and why almost every city gets it wrong",
  "the correct way to argue about tipping",
  "why every restaurant menu is designed badly on purpose",
  "an eight-minute history of the shipping container",
  "how to fold a fitted sheet, performed live and with stakes",
  "the physics of why bad coffee tastes bad",
  "competitive dog agility, which I promise is a real sport",
  "why the QWERTY story you have heard is wrong",
  "how to sight-read music badly but confidently",
  "the surprisingly bitter world of competitive crossword construction",
  "what actually happens when you flush on an aeroplane",
  "why my hometown has three names",
];

const TALK_REASONS = [
  "I have given a version of this at a dinner table and it worked",
  "It is the only thing I can talk about for ten minutes with no notes",
  "Everyone thinks they already know this and nearly everyone is wrong",
  "I want an excuse to finally make the slides",
  "It changed how I look at a city and I want to inflict that on other people",
];

const TALK_DETAILS = [
  "There is a diagram involved and I think it gets an audible reaction",
  "I would need about three slides and one prop, and I already own the prop",
  "The best part is the bit where everyone realises they have been doing it wrong for years",
  "I would keep it to four minutes and take questions, because the questions are better than the talk",
  "It ends with a genuinely unresolved argument, which I think is a better ending than a conclusion",
];

const CLASSES = [
  "CSCI 103", "CSCI 104", "CSCI 170", "CSCI 201", "CSCI 270", "CSCI 356",
  "CSCI 360", "MATH 225", "MATH 226", "EE 109", "DSCI 351", "WRIT 150",
  "BUAD 304", "ITP 259", "MATH 407", "PSYC 314",
];

const COMMITMENTS = [
  "part-time job ~12 hrs/week", "marching band ~10 hrs/week", "club soccer ~6 hrs/week",
  "research assistantship ~8 hrs/week", "another club board position ~5 hrs/week",
  "tutoring ~4 hrs/week", "intramural volleyball ~3 hrs/week",
  "campus radio show ~2 hrs/week", "TA office hours ~6 hrs/week",
];

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

function sentence(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    const value = values[lower] ?? "";
    return key[0] === key[0].toUpperCase()
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;
  });
}

function clamp(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}.`;
}

/**
 * Answer length tracks tier on purpose. A weak application is not just a worse
 * argument, it is a shorter one, and a seed where every answer runs to the
 * character limit would not tell you whether the scoring screen copes with the
 * real spread.
 */
function buildAnswers(tier, firstName) {
  const subject = pick(SUBJECTS);
  const community = pick(COMMUNITIES);
  const full = tier === "strong";
  const some = tier !== "weak";

  const q1 = clamp(
    [
      sentence(pick(Q1[tier].open), { subject }),
      some ? `${pick(Q1_CONTEXT)}.` : "",
      some ? `${pick(ACTIONS)}.` : "",
      full ? `${pick(Q1_STAKES)}.` : "",
      sentence(pick(Q1[tier].close), { subject }),
    ]
      .filter(Boolean)
      .join(" "),
    900,
  );

  const q2 = clamp(
    [
      sentence(pick(Q2[tier].open), { community }),
      some ? `${pick(Q2_SCENES)}.` : "",
      some ? `${pick(BELONGING)}.` : "",
      sentence(pick(Q2[tier].close), {}),
    ]
      .filter(Boolean)
      .join(" "),
    900,
  );

  // Always at least two paragraphs. Real notes are written this way, and it keeps
  // a newline inside a quoted field in every single row of the seed.
  const q3 = [
    `Dear ${pick(MENTOR_TITLES)} ${pick(LAST_NAMES)},`,
    [
      `Thank you for teaching me ${pick(LESSONS)}.`,
      some ? `${pick(Q3_MEMORIES)}.` : "",
      tier === "weak"
        ? "It mattered to me."
        : tier === "mid"
          ? "I did not understand why it mattered until much later, when I caught myself doing it without deciding to."
          : "I think about it more than almost anything else I was formally taught, and I have started passing it on badly, which I am told is how these things travel.",
      full ? `${pick(Q3_CLOSINGS)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    `— ${firstName}`,
  ].join("\n\n");

  const q4 = clamp(
    [
      `${pick(Q4_PROJECTS).replace(/^an /, "I built an ").replace(/^a /, "I built a ")}.`,
      some ? `${pick(Q4_STACK)}.` : "",
      some ? `${pick(Q4_LEARNINGS)}.` : "",
      `${pick(Q4_EXCITED)}.`,
    ]
      .filter(Boolean)
      .join(" "),
    600,
  );

  const q5 = clamp(
    [
      `I would talk about ${pick(TALKS)}.`,
      some ? `${pick(TALK_REASONS)}.` : "It is interesting.",
      full ? `${pick(TALK_DETAILS)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    450,
  );

  return { q1, q2, q3, q4, q5 };
}

function buildCommitments() {
  const taken = new Set();
  const count = 2 + Math.floor(random() * 4);
  while (taken.size < count) taken.add(pick(CLASSES));

  const load = new Set();
  const loadCount = 1 + Math.floor(random() * 2);
  while (load.size < loadCount) load.add(pick(COMMITMENTS));

  return `${[...taken].join(", ")}; ${[...load].join("; ")}`;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Sheet format: month-first, no timezone, exactly as Google writes it. */
function sheetTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()} ` +
    `${date.getUTCHours()}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** Submissions cluster towards the deadline, which is what a real window looks
 *  like, and gives the queue an uneven ordering to sort. */
function submissionDate() {
  const start = Date.UTC(2026, 7, 1, 8, 0, 0);
  const end = Date.UTC(2026, 7, 14, 23, 45, 0);
  const skewed = 1 - Math.pow(random(), 2.1);
  const at = start + skewed * (end - start);
  return new Date(at - (at % 1000));
}

const usedEmails = new Set();
function emailFor(first, last) {
  const base = `${first}.${last}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z.]/g, "");

  let candidate = `${base}@usc.edu`;
  let suffix = 2;
  while (usedEmails.has(candidate)) candidate = `${base}${suffix++}@usc.edu`;
  usedEmails.add(candidate);
  return candidate;
}

function driveId() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = "1";
  for (let index = 0; index < 32; index += 1) id += pick(alphabet.split(""));
  return id;
}

function buildApplicant() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const tier = pickWeighted(TIERS);
  const answers = buildAnswers(tier, first);

  return {
    timestamp: submissionDate(),
    email: emailFor(first, last),
    studentId: String(1000000000 + Math.floor(random() * 8999999999)).slice(0, 10),
    name: `${first} ${last}`,
    majors: pick(MAJORS),
    minors: pick(MINORS),
    graduationYear: String(pickWeighted([
      { value: 2027, weight: 2 },
      { value: 2028, weight: 4 },
      { value: 2029, weight: 5 },
      { value: 2030, weight: 3 },
    ])),
    pronouns: pickWeighted(PRONOUNS),
    gender: pickWeighted(GENDERS),
    race: pickWeighted(RACES),
    // A handful attach nothing, so the resume panel's empty state is reachable
    // from seeded data instead of only in theory.
    resume: chance(0.96) ? `https://drive.google.com/open?id=${driveId()}` : "",
    otherLinks: chance(0.45)
      ? `https://www.linkedin.com/in/${first.toLowerCase()}${last.toLowerCase().replace(/[^a-z]/g, "")}/`
      : "",
    role: pickWeighted(ROLES),
    tier,
    ...answers,
    commitments: buildCommitments(),
  };
}

const applicants = [];
for (let index = 0; index < APPLICANTS; index += 1) applicants.push(buildApplicant());

// Resubmissions: the same person, later, with different answers.
const resubmissions = [];
for (let index = 0; index < RESUBMISSIONS; index += 1) {
  const original = applicants[Math.floor(random() * applicants.length)];
  if (resubmissions.some((row) => row.email === original.email)) continue;

  resubmissions.push({
    ...original,
    ...buildAnswers("strong", original.name.split(" ")[0]),
    tier: "strong",
    timestamp: new Date(original.timestamp.getTime() + 3600_000 * (2 + Math.floor(random() * 20))),
    commitments: buildCommitments(),
  });
}

// Google appends in submission order, so the export is sorted by timestamp.
const rows = [...applicants, ...resubmissions].sort((a, b) => a.timestamp - b.timestamp);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const HEADERS = [
  "Timestamp",
  "Email Address",
  "Student ID",
  "Full Name",
  "Major(s)",
  "Minor(s)",
  "Graduation Year",
  "Pronouns",
  "Gender",
  "Race & Ethnicity",
  "Resume",
  "Other Links (optional)",
  "Role",
  "What is important to you? Tell us about a problem you see in the world (big or small), what actions you\u2019ve taken to make a positive impact, and what you learned.",
  "Community is a core pillar of CTC. Tell us about a community you felt like you truly belonged to. What aspects do you hope to bring into the CTC family?",
  "Write a short thank-you note acknowledging someone who has taught you something valuable and why it mattered (not a family member).",
  "Please briefly describe any relevant technical or group work experiences\u2014it does not need to be extensive! For example, personal projects, internships, classes, or any technologies or projects that you\u2019re excited about and would like to learn more about, etc.",
  "At CTC, one of our favorite traditions is Lightning Talks, where a member gives a short presentation on an interest, passion, or hobby of theirs\u2014some topics from last year were how to DJ, a self defense workshop, and all about Niki Zefanya. What would you give a lightning talk on and why?",
  "Please list out any relevant classes you have taken so far or are taking at USC. Also, list out any planned commitments for the current school year and their estimated weekly time commitment.",
];

/** RFC 4180: quote only when the value contains a delimiter, a quote, or a
 *  newline, and double any embedded quotes. Matches what Sheets emits. */
function cell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const lines = [HEADERS.map(cell).join(",")];
for (const row of rows) {
  lines.push(
    [
      sheetTimestamp(row.timestamp),
      row.email,
      row.studentId,
      row.name,
      row.majors,
      row.minors,
      row.graduationYear,
      row.pronouns,
      row.gender,
      row.race,
      row.resume,
      row.otherLinks,
      row.role,
      row.q1,
      row.q2,
      row.q3,
      row.q4,
      row.q5,
      row.commitments,
    ]
      .map(cell)
      .join(","),
  );
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("seed", { recursive: true });
writeFileSync("seed/seed_applicants.csv", `${lines.join("\n")}\n`, "utf8");

console.log(
  `seed/seed_applicants.csv: ${rows.length} rows, ${applicants.length} applicants, ` +
    `${resubmissions.length} resubmissions.`,
);

// ---------------------------------------------------------------------------
// Round 1 interview cohort
//
// Sixty people "pass" written and go on to interviews. Strong essays first,
// then mid, then weak, ties broken by email. Last-write wins on email so a
// resubmission that upgraded the answers can pull someone through. This list
// is emails rather than aliases: aliases are assigned at anonymize time, and
// the seed action resolves them from the active set.
// ---------------------------------------------------------------------------

const ROUND1_PASSED = 60;
const TIER_RANK = { strong: 0, mid: 1, weak: 2 };
const latestByEmail = new Map();
for (const row of rows) latestByEmail.set(row.email, row);
const passed = [...latestByEmail.values()]
  .sort(
    (left, right) =>
      TIER_RANK[left.tier] - TIER_RANK[right.tier] ||
      left.email.localeCompare(right.email),
  )
  .slice(0, ROUND1_PASSED);

writeFileSync(
  "seed/seed_round1_passed.csv",
  ["Email Address", ...passed.map((row) => row.email)].join("\n") + "\n",
  "utf8",
);

const passedTiers = { strong: 0, mid: 0, weak: 0 };
for (const row of passed) passedTiers[row.tier] += 1;
console.log(
  `seed/seed_round1_passed.csv: ${passed.length} applicants ` +
    `(${passedTiers.strong} strong, ${passedTiers.mid} mid, ${passedTiers.weak} weak).`,
);
