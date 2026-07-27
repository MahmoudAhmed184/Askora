# Askora — Product

Status: current production direction. Read this before changing product rules;
`docs/specification.md` remains the detailed contract.

## What Askora is

Askora is a place to ask someone a real question and get a considered answer in
public. A profile owner receives questions privately, decides what deserves an
answer, and publishes the pair as a thread that anyone can read and follow up on.

Three commitments shape every decision:

**Thoughtful.** The unit of value is a well-formed answer, not a stream of
reactions. Composing is deliberate — prompts, a character budget, and a draft
step exist so people write something worth keeping. There is no infinite feed,
no algorithmic ranking, and no engagement pressure.

**Private by default.** Incoming questions are private until the owner publishes
them. Anonymity is real: an anonymous asker is hidden from the recipient and
from public viewers, and safety metadata is never exposed in product surfaces.
Owners control who may ask, whether anonymity is allowed, and which aggregate
counts are visible.

**Editorial.** Askora reads like a considered publication, not a chat app.
Questions are set in a serif italic voice; answers get generous measure and
line height. The purple identity, the mono metadata, and the paper-like card
surfaces are the product's signature and are not up for negotiation when we
borrow structural patterns from mainstream social products.

## Who it is for

People who are asked things — creators, researchers, teachers, founders — and
the people who want to ask them. Growth comes from owners sharing their profile
link externally, not from in-product discovery. Askora is intentionally not
discovery-led.

## Core surfaces

- **Public profile** — identity, counts, the ask composer, and the answers feed.
  Owners see the composer too and can ask themselves questions, which flow
  through the normal inbox, draft, and publish workflow.
- **Inbox / Filtered** — private questions awaiting attention. Attributed
  senders show their public profile; anonymous senders show nothing beyond
  "Anonymous".
- **Answer editor** — choose how the question appears publicly (original,
  edited, or hidden), write the answer, set follow-up permissions, save or
  publish.
- **Thread** — the published question-and-answer conversation, plus follow-ups.
  Available as a popup over the current page and as a full page for direct links
  and no-JavaScript visitors.
- **Feed** — chronological published answers from profiles you follow. No
  ranking.
- **Notifications, Settings, Admin moderation.**

## Product rules worth restating

- The original question text is preserved privately even when the public wording
  is edited or hidden. Edited public wording carries a visible "Edited question"
  badge so nobody mistakes it for the asker's exact words.
- Silent edits to a published _answer_ are allowed and are not labelled. The
  edited badge is about question wording only.
- Owners bypass their own intake gates when asking themselves — accepting
  questions, ask permission, and follower requirements do not apply. Anonymous
  self-asks still require anonymous questions to be enabled, and suspension and
  inactive-profile restrictions always apply.
- Notifications are never sent to someone for their own action.

## Accessibility and motion

Askora targets **WCAG 2.2 AA**. See `DESIGN.md` for the implementation rules
that follow from this, including reduced-motion behavior.
