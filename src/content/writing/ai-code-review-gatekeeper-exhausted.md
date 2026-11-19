---
title: "Since we got AI tools, I’ve become the gatekeeper of everyone’s code. Everyone says we got faster, so why am I exhausted?"
section: "dear-como"
status: "Published"
publishDate: 2026-11-19
tags: ["Team Dynamics", "Power Dynamics", "Behavioural Patterns", "Organizational Change"]
featuredImage: "./_assets/ai-code-review-gatekeeper-exhausted-featured.webp"
focusKeyphrase: "AI code review workload"
metaDescription: "Reviewing more code than you write since your team adopted AI? Dear CoMo explains how you became the gatekeeper, and what you can change about it."
---

Oh my, that sounds heavy. You became an engineer because you like building things, and somewhere in the past year your job quietly turned into reading diffs you did not write. Meanwhile everyone around you is celebrating the speed. No wonder you are tired.

And no, it is not just you. Recent research across hundreds of companies shows the same pattern: with AI, engineers write more code and open more pull requests, but the amount of finished work barely moves. What does grow is the review. It takes longer, more changes get sent back, and more people get pulled into reviewing. So that feeling of yours is pretty well founded.

Let's look at what is happening. Your team added a tool that makes writing code much faster. What nobody changed is how the work flows after that. So all the extra output lands in the one place that did not get faster: the review. And because someone has to judge whether the code is actually right, it lands on the most experienced people. On you.

So without anyone deciding it, you became the gatekeeper of AI-generated code. That is a bigger change than it sounds. A gatekeeper holds a veto. Everyone else's work now waits for your approval, and you are the one who says "not yet" while the rest of the team feels fast. That shifts the ranking in your team: you got more power than you asked for, and less of the work you love. Others may start to see you as the brake, and they learn that thinking about quality is your job, not theirs.

It is also a different kind of reviewing. When a colleague writes code, the intent comes with it, and you can ask what they meant. With generated code you have to dig the intent out of the diff. That is tiring work, and it is not the work you signed up for.

So the speed is real, but it is local. The team did not get faster, the bottleneck moved. Here is the important part: this is more a behavioral problem than a tech problem. You cannot solve it by reviewing harder, and your team cannot solve it by asking you to keep up. We cannot change people, we can only change the environment. So what can you do?

1. **Share what you observe.** Not as a complaint, as an observation. "This is what my week looks like now: this much reviewing, this much building. I have become the gatekeeper. Is this what we want?" Chances are nobody decided this. It just happened, and nobody has said it out loud yet. Even better, start measuring the flow from commit to production, and what time is spend on what. And if you don’t measure anything yet we like to do [Team Flow Eventstorming by Paul Rayner](https://virtualgenius.com/blog/eventstorming-team-flow/).

2. **Change the flow, don't just add the tool.** Right now the review is the first moment anyone thinks deliberately about the design, and that is the most expensive place to do it. Move that thinking forward. Model the problem together before anything gets generated, agree on the boundaries and the language, and keep changes small. Then the intent travels with the code, and a review becomes a check instead of an excavation. In our book we talk about Example Mapping, these can be turned into specifications before coding. and those specifications are about the problem NOT the solution!

3. **Look at what gets reinforced.** You get what you reinforce. If the applause goes to whoever ships the most pull requests, you will get more pull requests, and the person guarding quality gets a longer queue as a reward. Ask together what you want to see more of, and whether that is what currently gets the appreciation.

One more thing: you are allowed to want to build. Your tiredness is not resistance to AI. It is a signal about the conditions you are working in, and those conditions can be engineered.

If you want to dig deeper into behavior and how to influence an environment, chapters 6, 7 and 8 of our book are a good place to start.

XoXo,
CoMo
