# MASTER PROMPT — Social Media Analysis Dashboard

## 0. Context

This is a dashboard I've been making for one of my projects — essentially a **social media analysis dashboard**. Not only can you analyze your competitors, but you can also analyze different content packs that have been going viral and save them, so that you know exactly what they are, you can refer to them, and then make your deal.

There's a bunch of stuff I want to bring back and implement. This is exactly what I need your help with.

---

## 1. Operating Rules (read before doing anything)

- **I will not be here to answer any questions throughout this.** That is something you must understand.
- Since I'm putting a frontier model on this, I really want you to **do your research properly and accurately**. Sometimes you may do research that is either inaccurate or not thorough enough — that's where you might miss things. I don't want that to happen. I want you to genuinely do your best.
- This is a set of multiple tasks, and **I want you to conduct each and every one of them autonomously**. Research properly. You might have to go beyond just creating normal code — you might have to do research, run commands, handle credentials, and so on.
- **For all of the tasks:** implement the code changes, the additional code, whatever coding stuff you want to do, **as well as all the commands you have to run**, etc. All of that — you're going to do it autonomously.
- **If you genuinely do need my help** — for example, an API key or something that I have not mentioned in my tasks and that isn't already set somewhere in the codebase — then:
  1. **Still complete all the code changes.**
  2. At the end of this entire conversation, **make a new document** that lists out, in brain-dead, really-in-detail, step-by-step, hand-holding instructions, exactly what needs to be done from my end. Serve that document inside this codebase.

---

## 2. Task 1 — Bring back the Competitor Scout

### 2.1 Source material

Look at the file called **`guide for archived code` (`.md`)** — the markdown file in the root of this entire codebase. This is essentially a guide to recover, or just read, some code I've done before. In there I had stuff like **Competitor Scout**, where I could autonomously run an agent to find competitors for the product.

What I want is to **bring back the Competitor Scout**: given the description of what our current product is, it goes online, conducts some agent workflow, and finally brings back the results.

### 2.2 The problem with what's there now

Currently on our dashboard, if you look at the **Competitor Analysis** pane, it just displays **preset competitors**. I don't want that to happen. **I want this to be dynamic.**

### 2.3 UI — the trigger

- Put a button on the **top-right corner of the Competitor Analysis pane** called **"Run Competitor Scout"**.
- There's a **play button** next to it.
- Keep it **maroon with white text**.

### 2.4 UI — the input dialog

When the user of this dashboard clicks that button, it first opens a **dialog** containing:

- A **title**: `Description of your own product`
- Under that title, a **text box** with **predefined but editable text**, inferred from the archived code — where it was preset to the definition of what **Altitut** was. I think it was something like: Altitut is an entrepreneurship platform, a platform to teach people entrepreneurship in a structured form, blah blah blah. **You can always infer that from the actual archived code** — take that.
- On the dialog itself there will be a **Submit** button. When the user clicks Submit, **the workflow is triggered**.

### 2.5 UI — the progress dialog

Then a **new dialog** pops up which shows the **different steps of that workflow**, as either:

- a **tick** (completed), or
- **processing** — which is going to be something like a **pulsating yellow dot** (brainstorm whatever you want for the UI).

Essentially, that dialog should show **where the workflow is at** — which step it is on, which step it is currently executing, etc.

### 2.6 Completion

Once all the steps of the workflow complete — which means the competitor is derived — it will **save that competitor to our existing list of Competitor Analysis competitors**.

### 2.7 Output format — the eight sections

If you look at our current competitors — for example, look at **Startup Wars** — for each competitor there's:

1. Identity
2. Product & Website
3. Social Presence
4. Content Strategy
5. Top Performers
6. Paid & Partnerships
7. Audience & Community
8. Synthesis

So what I want you to do is **fine-tune our workflow**. Basically, when you take that worker from the archived code, try to fine-tune it or add some intermediate steps using **whatever tools you think are best** — do your research on whichever APIs, tools, whatever is best — but essentially try to make the workflow **output values for all eight of these sections**.

Look at the competitors we have right now. Look at each and every subsection. Look at how detailed it is. What I want is to make sure that the Competitor Scout workflow will **not only efficiently, but properly, comprehensively, and robustly return these eight subsections with detailed content that is actually accurate.** **That is really important.**

So basically what I'm trying to say is: **the Competitor Scout should return competitors in the exact same format that we have right now** — with the subsections, with the website, with the social media links, and all of that.

### 2.8 On tooling — do NOT be lazy about this

- If you want, you can always bring some LLMs into it. **I've already kept an OpenAI API key in my codebase.**
- But **I don't want you to do something stupid** — like asking OpenAI "hey, this is the company, just tell me the content for subsection 7 or 8." **That's really stupid**, because it's an LLM and an LLM is general.
- **Try to find research tools instead.** Tools that can actually **get** you the content you need. There are so many tools out there. **Do your research.**
- **Break the task down into multiple smaller sub-segments**, then brainstorm on each — research and brainstorm on **each and every single sub-segment** of the task on which tool is best for it — and then go for it.
- **I have absolutely no restrictions on which tools and APIs you end up using.** It's literally freedom for you. You can use whatever tools you want.

### 2.9 The TL;DR

For each competitor, apart from just the eight sections, I want it to **also return a 4–5 line TL;DR**. This would be either one paragraph, or two paragraphs of two to three lines each, which is basically a TL;DR for all of the subsections.

**Placement:** at the very top — under the collapsing bar, but **above** the Identity dropdown / Identity accordion.

**How we go about it:**

1. For the **existing, pre-defined competitors**, create a TL;DR.
2. In the **AI workflow at the Competitor Scout**, make sure it **returns the TL;DR as well**, along with the subsection content.

---

## 3. Task 2 — Competitor Analysis chat interface

### 3.1 What exists now

Right now the way we view competitors is **very deterministically structured**: we see the multiple accordions of the different competitors that we have set right now, we click on each of them to open up the subsection list (Identity, Product & Website, Social Presence, blah blah blah), and we click on each of these subsection titles to get further details.

### 3.2 What to build

**I'm not talking about replacing this — we'll still have this.** In addition, I want you to **create a chat interface** that sits **under the header and subheader** of *Competitor Analysis* / *structured intelligence packs for each tracked competitor*. Create the chat interface below that.

Essentially it's an **AI agent that has context of all of these competitors**, and this is where I want you to think of **RAG — Retrieval Augmented Generation**.

- It should be a **really, really robust RAG pipeline**.
- You can do **hybrid retrieval**.
- This chatbot will mainly be used for asking questions about the competitors — maybe about **multiple competitors at once**, maybe about **how we can use the competitors' insights**.
- So it should have context of **not only the competitors themselves, but also what Altitut is** — which is the main product, the one you're building this social media analysis dashboard for.
- **Make sure that pipeline is there. Make sure the vector database is there. Ingest everything. Make sure everything is ingested.**
- Again, I'm telling you what I told you at the start of this prompt: **you need to be autonomous.**

It should be an AI agent I can talk to and ask questions about maybe just one competitor, maybe multiple competitors, maybe just general stuff — not "general" exactly, but basically a **competitor analysis chatbot**. **Think of all of this very robustly.**

### 3.3 Two things from my experience building chatbots

1. **It should behave like an actual chatbot rather than an answering machine.** What I mean is: usually when I plug in an API and just wire something like this up, whenever I ask it a question it provides this huge response. Instead, I think it would be better if it provided a **TL;DR sort of format for each response**, unless a comprehensive result is asked for.
2. **Markdown formatting.** Since AI chatbots — OpenAI's API, or basically any LLM — output markdown, **include some markdown libraries or markdown stylings** which properly format out the chatbot's response.

### 3.4 UI

- Look at some **external UI libraries** for the chat interface. There are a lot of **AI-native UI libraries** that provide elements of chat boxes, etc. **Be sure to choose something.**
- **Style the chat interface in the same manner / same stylings / same design scheme / same design theme as our current thing.**
- Look at **`design.md`** and **`design_2.md`** inside the **`resources`** folder of this codebase — you will see the appropriate stylings there.
- **It's all up to you.**

---

## 4. Task 3 — Firebase / Firestore

- Currently we **don't have a database**. I think everything is stored in either local storage or somewhere else — I don't know, probably local storage.
- Look at **`@firebase.js`** inside the root of this codebase. These are the credentials for a Firebase app I've just created.
- I've already **enabled Firestore**, and I've enabled the rules to be **allow read: true and allow write: true** — which means anyone can interact with Firestore.

**What to do:**

1. **Ingest what we currently have** for the **competitors** and the **content packs** into Firebase.
2. Make sure that **every workflow that we run gets saved / saves its data inside Firestore.**

---

## 5. Task 4 — Telegram bot for content packs

### 5.1 What I want

I want you to create a **Telegram bot** — one I can message from my phone — where I can **paste in an Instagram reel** and it **extracts a content pack out of it**.

### 5.2 Format reference

If you look at the current content packs, you'll see that each one lists out:

- **Overview**
- **Strategy**
- **Series** (what to make)
- **Recipe**
- **Execution**

### 5.3 Tooling

In the codebase, if you look through it, we're usually using **Apify**. Apify is a great tool for Instagram reels analysis and all of that.

### 5.4 The workflow

- **Think thoroughly and properly through the workflow** of making this possible — where you create a Telegram bot and we have this Telegram bot **active at all times**.
- I'll probably deploy this website on **Vercel**, so I think then it will be up at all times. I don't know how it works — but essentially I need to be able to send the Telegram bot Instagram reel links.
- These reel links are for Instagram reels that I think are **really good templates of content** — content that should be a content pack for us to take inspiration from and then create out of our own product.
- **There should be a whole workflow for that. Make sure the workflow is accurate.**

### 5.5 Persistence and surfacing

- It should save the content pack into **Firebase**, and also into our **dashboard**.
- For the **reference reel**, just keep the **same one post** — and the post is the reel whose link I sent to the Telegram bot.
- **Make sure all of the detailed information is there.** I suggest you look through the content packs we have currently to understand how much detail there is and what the format is, so that you understand the expectations.

---

## 6. Final Instructions

- I think this is a fair set of tasks that I want you to kick off and start.
- **I am not going to be here for around one to two days.** Take as much time as you need.
- You are literally on the best model ever, the best LLM model ever. **I have bypassed all of your permissions so that you don't need my permission for every small thing.**
- **The only and only restriction I have is that I will not accept anything that is either inaccurate, uncomprehensive, or erroneous.**
- I want you to properly make sure **every single task I've mentioned right now is implemented thoroughly**. **No gaps whatsoever.**
- **Don't keep templates anywhere. Don't make it "this is a placeholder, I am waiting only for your instructions to then convert it." No!**
- **You are an AI software engineer right now**, and I want you to properly execute this **end-to-end**.
- As mentioned at the very beginning of this prompt: **if you do need something from me, note it down, compile all of the needs you cannot fulfil into a document, and then serve it to me inside this codebase.**

**Go for it.**