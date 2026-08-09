import type { QuestionId } from "@/lib/questions";

export type Applicant = {
  /** The submitter's email. Google Forms gives no stable id, and sheet row
   *  numbers shift when the sheet is sorted, so email is the durable key. */
  id: string;
  name: string;
  submittedAt: string;
  responses: Record<QuestionId, string>;
};

// Fixture data. Swapping to Google Sheets means rewriting only this file's two
// exported functions; nothing else reads the fixture directly. See TODO.md.
const APPLICANTS: Applicant[] = [
  {
    id: "amara.osei@example.edu",
    name: "Amara Osei",
    submittedAt: "2026-08-02T14:12:00Z",
    responses: {
      q1: "I have been circling this club since my first year without ever actually applying. What finally pushed me was watching the teardown session last spring, where two members disagreed about an architectural decision for forty minutes and neither of them got defensive about it. That is rare. I want to be somewhere that treats being wrong as cheap and interesting rather than embarrassing. Concretely, I want to get better at defending decisions out loud, because I can write reasonable code and then completely fail to explain why it is reasonable.",
      q2: "Last summer I built a scheduling tool for the volunteer tutoring programme I coordinate. Before it existed, matching sixty tutors to student availability was a spreadsheet that one person owned and everyone feared. I wrote a small constraint solver that produced a draft schedule and, importantly, explained which constraints it had to break and why.\n\nThe technical part was not the hard part. The hard part was that the first version produced mathematically optimal schedules that everybody hated, because it would assign someone three sessions on one day and none for the rest of the week. I had optimised for the wrong thing. I learned to go sit with the coordinators and watch them use it rather than asking them what they wanted in the abstract.",
      q3: "On a group project last term, two of us wanted to ship a rough version early and two wanted to keep building until it was polished. It got tense because we were arguing about taste when the actual disagreement was about risk. I suggested we write down what we each thought would go wrong with the other approach. Once it was on paper it turned out the polish camp was worried about a specific demo, and the ship-early camp was worried about running out of time. Both were solvable. We demoed a rough version privately and kept polishing for the public one.",
      q4: "I started a reading group for papers that nobody assigns. It runs every other Thursday and has about twelve regulars. The main thing I did was lower the bar: you do not have to have read the paper to come, and someone always presents it from scratch. Attendance tripled after I made that change and stopped pretending it was a seminar.",
      q5: "I am unusually willing to be the person who says they do not understand something in a room full of people nodding. That sounds small but it changes meetings. Half the time three other people did not follow either and the explanation improves for everyone.",
    },
  },
  {
    id: "devan.roy@example.edu",
    name: "Devan Roy",
    submittedAt: "2026-08-03T09:41:00Z",
    responses: {
      q1: "I want to join because my current work is solitary and I think that is making me worse. I want people who will tell me when an idea is bad before I spend three weeks on it.",
      q2: "I wrote a static analysis tool that flags database queries inside loops in our codebase at my internship. It found 140 real instances in the first run, which was both satisfying and slightly alarming.\n\nWhat I learned was about adoption rather than analysis. The first version had a 30% false positive rate and people turned it off within a week. I spent the rest of the internship getting that under 5%, and only then did anyone leave it on. A tool nobody trusts is worth less than no tool, because it also burns the credibility of the next person who tries.",
      q3: "My co-lead and I disagreed about whether to rewrite a component or patch it. I wanted the rewrite. I lost that argument and I now think I was wrong: the patch held for the rest of the year and the rewrite would have eaten a month. What changed my mind was that she asked me to estimate the rewrite in terms of what we would not build instead. I had been comparing the rewrite to the status quo rather than to the alternatives.",
      q4: "I maintain an open source library for parsing a niche scientific file format. It has 400 stars and, more meaningfully, about eight people who file thoughtful bug reports. I started it because I needed it and nothing existed.",
      q5: "I am good at the unglamorous middle of projects. Lots of people are good at starting things and a few are good at finishing. I am reliable in week three when the novelty is gone and it is just work.",
    },
  },
  {
    id: "priya.venkatesan@example.edu",
    name: "Priya Venkatesan",
    submittedAt: "2026-08-03T18:05:00Z",
    responses: {
      q1: "Honestly, partly for the people. I have gotten most of my useful ideas from conversations rather than from reading, and this seems like a dense concentration of the kind of person who argues carefully. I also want structure. I work much better with a group expecting something from me than I do alone with an open calendar.",
      q2: "I ran the logistics for a 300-person hackathon. Not a technical project, but the one I am proudest of, because it was the first time I was responsible for something where failure would have been visible and immediate.\n\nThe thing I got right was building slack into the schedule. Everything ran about twenty minutes late all weekend and nobody noticed, because I had padded every transition. The thing I got wrong was that I did not delegate enough and spent Saturday night doing a job that three people had volunteered for. I was so worried about it being done correctly that I made myself the bottleneck.",
      q3: "We disagreed about the judging criteria, specifically whether to weight technical difficulty or polish. It got circular. What broke it was realising we were both arguing about what kind of event we wanted rather than about a rubric. Once we named that, the rubric took ten minutes.",
      q4: "I set up a mentoring pairing scheme in my department that is still running two years later. The trick was making the commitment tiny and specific: thirty minutes, twice a term. Every previous attempt had failed because it asked for open-ended commitment and everyone felt guilty and quit.",
      q5: "Follow-through on the boring parts. I will actually send the reminder email, book the room, and notice that nobody has confirmed the thing we all agreed to three weeks ago.",
    },
  },
  {
    id: "tomas.lindqvist@example.edu",
    name: "Tomas Lindqvist",
    submittedAt: "2026-08-05T11:27:00Z",
    responses: {
      q1: "To be around people who are better than me at this. That is the whole answer.",
      q2: "A compiler for a small statically typed language, written for a course but continued well past it. It does type inference, which I did not understand at all when I started and now understand about 60% of.\n\nThe moment that mattered was rewriting the parser for the second time. The first parser worked but I could not extend it without breaking something. The second one took a weekend and every feature since has been easy. I had heard the advice about clean foundations and dismissed it as the sort of thing people say. Feeling the difference was different from being told.",
      q3: "A partner and I disagreed about whether to use an existing library or write our own. I wanted to write our own, which in retrospect was mostly because I wanted to learn rather than because the project needed it. We used the library. The project shipped. I wrote my own version afterwards on my own time, which was the right split.",
      q4: "I have written a blog post roughly monthly for two years about things I got confused by. Low readership, but it is the single thing that has most improved my thinking, because I cannot write up something I only half understand.",
      q5: "I read the actual specification. When there is a disagreement about how something behaves I will go and find the primary source rather than arguing from memory, and I have been the annoying person who was right about this often enough to keep doing it.",
    },
  },
  {
    id: "nadia.haddad@example.edu",
    name: "Nadia Haddad",
    submittedAt: "2026-08-06T16:53:00Z",
    responses: {
      q1: "I am switching into this field from statistics and I need a community that will let me be visibly behind for a while without treating me as a tourist. From what I have seen this club is unusually good about that.",
      q2: "I built a model to predict which patients would miss appointments at the clinic where I volunteered, so they could be called the day before.\n\nThe model was fine. What I am proud of is that I pushed back when the clinic wanted to use it to deprioritise those patients rather than to support them. Same prediction, opposite intervention. I put together a short memo on what the feedback loop would do over a year and they changed course. I learned that the most consequential decision in a modelling project is usually not in the model.",
      q3: "My research group disagreed about whether a result was strong enough to publish. I thought it was not. Rather than relitigating it in meetings, I ran the additional analysis I thought was missing. It turned out the result held, and I was wrong, but everyone was more confident afterwards, including me.",
      q4: "I taught myself to program at 26 while working full time, which I mention not as a hardship story but because nobody made me do it and it took three years.",
      q5: "A statistician's instinct for when a number is being asked to carry more weight than it can. I notice sample sizes.",
    },
  },
  {
    id: "kwame.mensah@example.edu",
    name: "Kwame Mensah",
    submittedAt: "2026-08-07T08:19:00Z",
    responses: {
      q1: "I want to build things with other people instead of alone in my room at 2am, which is my current arrangement and is not going well.",
      q2: "I made a browser extension that strips the recommendation feeds out of a handful of sites. About 2,000 people use it. It is technically simple and I am aware of that, but it is the only thing I have built that people use every day.\n\nWhat I learned is how much maintenance costs. The sites change their markup constantly and I spend a couple of hours a month keeping it alive. I had thought of shipping as the finish line.",
      q3: "Two of us on a project disagreed about scope, quite badly, and I handled it poorly at the time by going quiet and just building my part the way I wanted. It worked out but only by luck. What I would do now is force the disagreement into the open early, because the version where we argue in week one is much cheaper than the version where we discover the mismatch in week six.",
      q4: "The extension above, and a small tool that converts my handwritten notes into searchable text, which only I use.",
      q5: "I am comfortable shipping things that are slightly embarrassing, which I have found is a rarer trait than it should be and is usually the difference between a project existing and not.",
    },
  },
];

export async function getApplicants(): Promise<Applicant[]> {
  return APPLICANTS;
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  return APPLICANTS.find((applicant) => applicant.id === id) ?? null;
}
