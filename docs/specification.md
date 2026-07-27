# Askora Specification

Status: Draft v0.2
Date: 2026-05-30

## Product Summary

This is a modern social Q/A platform scoped around shareable profiles, private inbox intake, and externally shared profile links instead of public discovery.

The core loop is:

1. A user creates a public profile with a stable username URL.
2. The user shares that profile URL on other social platforms.
3. Visitors ask questions, anonymously or with an account identity.
4. The profile owner answers privately received questions.
5. Only answered questions are published publicly on the profile.
6. Published answers can receive likes, follow-ups, and appear in followers' feeds.

The product is not a discovery-first social network. There is no discover page in MVP. Growth comes from users sharing their profile links externally.

## Product Positioning

Primary initial wedge:

- Creator-owned anonymous inbox for people with existing audiences.
- The profile is a public publishing surface.
- Follow/following exists for retention, notifications, and a simple feed, not for public discovery.

Target users:

- Anyone with an existing audience or friend group: creators, students, social media users, internet personalities, streamers, and friend circles.
- The first test group will be friends.

First-session goal:

- Publish a shareable profile quickly.
- Starter answers are useful but must be skippable.
- The ideal setup time is around 3 minutes.

Product tone:

- Calm, direct, social, and lightweight.
- Avoid childish anonymous-app language.
- The product should feel safe enough for personal questions and modern enough for creators.

Product name:

- Use `Askora` in product copy, page titles, emails, and share metadata.
- Use `askora` for package and other lowercase identifiers.

## Launch And Beta Access

First beta:

- Launch as invite-only / link-access for friends.
- Invited testers can create profiles and share them.
- Account creation stays controlled until moderation, rate limits, and admin tools are working.
- Invited beta users may share profile links publicly outside the friend group because external sharing is the product loop.

Beta size:

- Start with 20 to 50 profile owners.
- This is enough to test the loop without creating an unmanageable moderation load.

Waitlist:

- Include a simple waitlist or request-access form.
- Do not build a complex invite marketplace.

Invite codes:

- Use single-use invite codes or manual account approval.
- Do not use reusable invite links for MVP because they can leak and turn the beta public too early.

Domain:

- Use a custom domain before the first serious social sharing test if possible.
- A Vercel URL is acceptable for local/internal testing.
- A real domain improves trust and Open Graph previews.

Homepage:

- `/` shows a minimal product homepage with a login/create-profile CTA and short explanation.
- Do not build a large marketing landing page in MVP.
- Do not include fake example profiles or demo content in MVP.
- Let real profiles carry the product later.

## Legal, Policy, And Age

Age policy:

- Require users to be at least 16 years old for MVP.
- Explicitly prohibit users under 13.
- Anonymous Q/A involving minors has safety risk, so start conservatively.

Legal pages:

- Publish basic Terms and Privacy Policy pages before any external beta.
- Cover accounts, anonymous questions, moderation, safety metadata, data retention, reports, and deletion.

Anonymity language:

- Describe anonymity as anonymous to the recipient and public viewers, not anonymous to the platform.
- The platform may store limited safety metadata to prevent abuse.

Content policy:

- Prohibit explicit sexual content in MVP, especially content involving minors or coercion.
- Prohibit harassment, hate, threats, non-consensual sexual content, doxxing/private information, impersonation, spam, scams, and illegal content.
- Allow supportive self-harm discussion, but prohibit encouragement or instructions for self-harm.
- Route self-harm-related reports to admins in MVP rather than building complex crisis tooling.

## Language And Internationalization

MVP language:

- English first for the product UI.
- User-generated content must support Unicode so users can write in Arabic or any other language.

Arabic/RTL:

- Full Arabic/RTL UI does not ship in MVP.
- Arabic content should render without breaking layout.
- Add full Arabic/RTL UI after the core platform works if the beta audience needs it.

Moderation language support:

- User-controlled muted phrases must support Unicode.
- Add a small global English/Arabic spam and abuse phrase list later, but do not treat it as comprehensive.

## MVP Scope

MVP includes:

- Responsive mobile-first web app.
- Minimal homepage and waitlist/request-access surface.
- Invite-only / link-access friends beta.
- Public profiles with ask box.
- Anonymous guest questions.
- Logged-in anonymous questions.
- Logged-in attributed questions.
- Private inbox.
- Answer drafts.
- Published answer threads.
- Follow-up question threads.
- Likes from logged-in users.
- Follow/following.
- Simple following feed.
- In-app notifications.
- Google auth primary.
- Email magic link fallback.
- Public username/profile system.
- Profile deactivation and account deletion flow.
- Creator-level moderation controls.
- Minimal admin moderation console.
- Minimal internal event logging.
- Noindex beta configuration.
- Basic Terms and Privacy Policy pages before external beta.

MVP excludes:

- Public discovery.
- Comments.
- Full analytics workspace.
- AI-generated questions.
- Private profiles.
- Full-text search.
- Email notifications beyond auth magic links.
- Native mobile apps.
- Generated social story cards.
- Public follower/following lists.
- Password auth.
- Custom avatar uploads.
- Public API.
- Sitemap during noindex beta.

## Technical Stack

Chosen stack:

- Framework: React Router v7 Framework Mode.
- Runtime: Node.js.
- Database: Postgres.
- ORM: Drizzle.
- Auth: Better Auth.
- Styling: Tailwind CSS.
- Validation: Zod or Valibot.
- Email: Resend, only for auth magic links in MVP.
- Hosting for beta: Vercel Hobby.
- Database hosting for beta: Neon Free Postgres.
- Rate limiting: Postgres-backed counters first.
- Redis/rate limiting later if needed: Upstash Free.

Rationale:

- Public profile and ask submission must be server-rendered and progressively enhanced.
- The ask flow should work reliably in hostile in-app browsers.
- JavaScript may enhance the experience, but core asking should not depend on a heavy app shell.
- React Router v7 Framework Mode gives the modern Remix-style model: server-rendered routes, loaders, actions, nested layouts, and progressive forms.
- Postgres fits the relational domain: users, profiles, questions, threads, follows, likes, notifications, blocks, reports, and moderation.
- Drizzle keeps SQL and schema close to TypeScript.
- Better Auth owns auth/session/OAuth/magic-link mechanics, while product identity remains in domain tables.

Design implementation:

- The current visual source artifact is `design/prototype`; production routes
  should port its styling through `app/app.css`, shared UI primitives, app
  shells, and feature-owned components while preserving route URLs and
  loader/action contracts.
- The signed-in app uses top-level product URLs: `/feed`, `/inbox`, `/drafts`,
  `/filtered`, `/notifications`, `/answer/:questionId`,
  `/answers/:threadItemPublicId/actions`, and `/settings/*`.
- Feed, Inbox, Notifications, Profile, and Settings are the primary app areas,
  reached through the floating pill navigation.

## Auth And Identity

Auth methods:

- Google login is primary.
- Email magic link is fallback.
- No passwords in MVP.

Auth flow:

1. User authenticates.
2. If profile setup is incomplete, user must complete profile setup before entering the signed-in app.
3. Required setup fields: username and display name.
4. Optional setup field: bio.
5. After setup, user lands on Feed.
6. Later completed-profile sign-ins also land on Feed, not setup.

Incomplete-profile users:

- May ask anonymously as logged-in users.
- Must complete profile before asking with identity attached.
- Must complete profile before following, liking, or accessing signed-in app routes.

Identity model:

- Each user has auth account/session data managed by Better Auth.
- Each visible product identity is stored in first-party profile tables.
- A profile has a unique username and mutable display name.
- The username is the stable handle and public URL.
- The display name can be changed freely.

Username rules:

- Users can change usernames.
- Username format: lowercase ASCII letters, numbers, and underscores only, matching `^[a-z0-9_]{3,30}$`.
- Username changes have a 30-day cooldown.
- Old usernames redirect to the new username for 90 days.
- Old usernames are reserved for at least 90 days before another user can claim them.
- Usernames that were active, high-risk, or reported may be reserved longer.
- Recently released usernames should not be instantly claimable by others.
- Username redirects preserve externally shared links.
- System route names are reserved and cannot be claimed as usernames, for example `login`, `admin`, `setup`, `api`, `settings`, `reports`, and `logout`.

Profile limits:

- Display name length: 1 to 50 characters.
- Bio length: 160 characters.
- No public search for usernames, display names, or bios in MVP.
- Admins may have internal lookup by username/email for support and moderation.

Avatars:

- Custom avatar upload does not ship in MVP.
- Use the Google profile image if available.
- Fall back to generated initials/avatar if no Google image is available.
- Store the Google avatar URL initially; do not proxy remote Google avatar images in MVP.
- Add avatar uploads later with S3/R2-compatible object storage, image validation, abuse handling, and deletion workflows.

## Public Profile

Profile URL:

- Canonical public profile URL: `/:username`.
- The profile URL is the primary share link.
- Visitors land directly in ask mode, with the ask box immediately visible.

Empty profile state:

- Show profile info plus ask box only.
- Show a subtle no-answers state below the ask box if needed.

Public profile answer ordering:

- Pinned answers first.
- Newest answers after pinned answers.
- Pinned answers appear only once, not again in chronological position.
- Maximum pinned answers in MVP: 3.

Public counts:

- Follower/following counts are visible by default but user-configurable.
- Reaction counts are visible by default but user-configurable.
- Public follower/following lists are hidden in MVP.
- Profile answer count counts individual published Q/A items, not threads.
- Label the count as "answers".

Profile availability:

- Users can deactivate profiles.
- Deactivation hides the public profile and disables interactions.
- Deactivation is reversible.
- Deactivation is separate from account deletion.

## Asking Questions

Question visibility:

- Incoming questions are private by default.
- No question appears publicly until the recipient answers and publishes it.
- Only answered questions appear on the public profile.
- Question text limit: 500 characters.

Question sources:

- Guest anonymous.
- Logged-in anonymous.
- Logged-in attributed.

Anonymous asking:

- Anonymous guest questions are allowed by default.
- The profile owner can disable anonymous questions.
- Anonymous submissions should remain low-friction unless abuse signals appear.
- Abuse friction can include rate limits, blocks, filters, and later CAPTCHA.

Logged-in asking:

- Logged-in users can ask as themselves.
- Logged-in users can ask anonymously if the target profile allows anonymous questions.
- If anonymous is disabled, logged-in users can only ask with identity attached.

Attribution:

- Attributed answered questions show the asker's display name and username link publicly.
- If the asker later deletes or deactivates their account, attribution is anonymized/unlinked.

Ask-page CTA:

- Default share CTA: "Ask me anything".
- If anonymous is enabled, use "Ask me anything anonymously".
- Ask box placeholder should be personalized, for example: "Ask Mahmoud anything..." or "Send Mahmoud an anonymous question...".

Ask permissions:

- Profile owners can choose who can ask top-level questions:
  - Everyone.
  - Logged-in only.
  - Followers only.
  - Off.

Permission behavior:

- Everyone: guest anonymous is allowed only if anonymous is enabled.
- Logged-in only: attributed or logged-in anonymous, depending on anonymous setting.
- Followers only: only logged-in followers, attributed or logged-in anonymous depending on anonymous setting.
- Off: no new questions.

Self-questions:

- A profile owner can ask their own profile a question from their own public profile.
- Self-questions bypass the owner's own intake gates: accepting questions, ask permission (including Off and Followers-only), and the follower requirement do not apply.
- Anonymous self-asking still requires the profile to have anonymous questions enabled.
- Suspension and inactive-profile restrictions still apply to self-questions.
- Self-questions are processed through the normal inbox, draft, and publish workflow. They are ordinary questions once created.
- Do not notify the owner about their own answer or their own follow-up. Suppress any notification where the asker and the acting owner are the same account.

Followers-only behavior:

- Anyone can follow instantly in MVP.
- Followers-only is a light friction setting, not a true privacy boundary.
- There is no follower approval in MVP.

Post-submit guest flow:

- Guest anonymous askers see confirmation after submitting.
- Show a soft prompt: "Create an account to get notified if a question is answered."
- Do not block submission.
- Do not retroactively attach identity if the guest later creates an account.
- Only logged-in askers get answer notifications in MVP.

Asker regret controls:

- Logged-in askers can change an attributed unanswered question to anonymous before it is answered.
- Logged-in askers can delete their own unanswered question before the recipient answers or drafts an answer.
- If a question is deleted before the recipient saw or drafted it, remove it silently.
- If a question is anonymized before answer, update it to anonymous without a noisy event.

## Inbox And Answering

Answer format:

- Answers are text-only in MVP.
- Answer text limit: 3,000 characters.
- Answers are plain text with line breaks.
- Markdown is not supported in MVP.
- HTML must be escaped.
- URLs in answers are not auto-linked in the first MVP; add auto-linking later with spam protection and safe link handling.
- Optional image attachments are the first planned expansion after MVP.
- Voice, video, rich embeds, and other rich post formats are future work.

Inbox:

- The inbox contains private unanswered questions.
- The inbox should represent items needing attention.
- Filtered questions live in a separate Filtered folder.

Drafts:

- Users can save answer drafts.
- Drafts are private.
- Drafts do not notify askers.
- Creating a draft moves the question to a Drafts state/folder.

Publishing:

- The owner can publish an answer.
- The original question text appears publicly by default.
- The owner can edit or hide the question text before publishing.
- If the question text is edited, the UI should not imply the modified text is the asker's exact untouched wording.
- Public surfaces must show a visible "Edited question" badge beside the question text whenever `questionTextMode` is `edited`. This applies to profile answer cards, feed items, and thread entries.
- The badge discloses modified question wording only. It says nothing about edits to the answer.
- The edited-question input is only offered while Edited mode is selected, and its draft value is preserved when the owner switches modes within the same editor session.
- Editing question text should keep an internal copy of the original.
- Hidden question text remains stored internally while the related thread/item exists for context, reports, and audit, but is not exposed publicly.

Answer management:

- Published answers can be edited silently.
- Published answers can be unpublished.
- Published answers can be deleted.
- Silent edits do not notify askers or followers.
- Public edited labels are not required in MVP.

Private answers:

- No private answers in MVP.
- Choices are publish, draft, delete, report/block, or unpublish after publishing.

Soft deletion:

- Deleted inbox questions disappear from the user's normal UI.
- Internally, deleted questions may be retained for a 30-day abuse/audit window by default.
- Report-linked records may be retained longer for moderation history.
- Retain report-linked moderation records for at least 180 days during beta.
- Retained data should be limited to what is needed for safety, reports, and abuse prevention.

## Threads And Follow-Ups

Threads are part of MVP.

Thread model:

- Every published Q/A is represented as a thread with one initial item.
- A follow-up creates another private inbox question linked to the existing thread.
- A follow-up only appears publicly if the profile owner answers and publishes it.
- Threads are flat chronological chains, not nested comment trees.
- No public comments in MVP.
- Cap each thread at 20 published Q/A items in MVP.
- After a thread reaches the cap, disable new follow-ups for that thread and encourage a new question.

Thread permalink:

- Each public thread has one permalink.
- Example: `/:username/a/:threadPublicId`.
- Individual items may use anchors, for example `#item-abc123`.
- Thread IDs in URLs should be short random public IDs, not sequential database IDs.
- Use username in the path for readability, but resolve by immutable public ID so username changes can redirect cleanly.

Thread creation:

- Incoming top-level questions do not create thread records immediately.
- Create a thread when the first answer is drafted or published.
- Follow-up inbox questions link to an existing thread immediately.

Follow-up permissions:

- Profile-wide default plus per-answer override.
- Default follow-up permission for new profiles: logged-in only.
- Options:
  - Anyone.
  - Logged-in only.
  - Original asker only.
  - Off.
- The answer publish screen should allow a compact follow-up permission override.
- The override defaults to the profile setting.
- Thread owners can disable follow-ups after a thread is published.
- Disabling follow-ups stops new follow-up questions but does not remove existing published thread items.
- Follow-up question forms should show enough prior thread context for the asker to know what they are following up on, while keeping the form focused.

Original asker only:

- Available only when the original asker has an account.
- This includes logged-in anonymous questions.
- It is not available for true guest anonymous questions because identity cannot be reliably proven later.

Follow-up notifications:

- Profile owner is notified when a follow-up is asked.
- Logged-in participants are notified when a new follow-up answer is published in a thread they participated in.
- Do not notify all followers as thread participants.

Feed behavior:

- Follow-up answers appear as normal feed items with context.
- Feed items should show a compact "in thread with..." style preview linking to the full chain.

Thread item deletion:

- No reordering.
- If the initial answer is unpublished, unpublish the entire thread.
- If a middle follow-up answer is deleted, show a compact "answer removed" marker and keep later items visible.
- Removed question/answer text is not shown publicly.
- Deleted/unpublished items do not count toward public answer counts.
- Historical links should resolve to an unavailable/removed state instead of confusing 404s where practical.

## Following And Feed

Follow feature purpose:

- In-app notifications.
- Simple following feed.
- Retention for logged-in users.

Following:

- Anyone with a completed profile can follow public profiles.
- Anyone can follow instantly in MVP.
- No follower approval in MVP.
- Profile owners can block followers.

Blocking followers:

- Blocking removes the follow relationship.
- Blocking prevents future following.
- Blocking prevents account-level asking, liking, and other interactions.
- Blocking does not guarantee public content is hidden from logged-out visitors.

Following feed:

- Only published answers from followed profiles.
- Chronological, newest first.
- No algorithmic recommendations.
- No join events.
- No "open to questions" events.
- Follow-up answers appear as feed items with context.
- Use cursor pagination with 20 items per page.
- Use a simple "load more" interaction in MVP; infinite scroll can come later.
- Do not store materialized feed items in MVP.
- Query published answers from followed profiles directly with proper indexes.
- If a user unfollows a profile, that profile's content naturally disappears from the feed on next load.

## Likes

MVP reaction model:

- One generic like.
- Logged-in users only.
- Anonymous visitors cannot like.
- Users cannot like their own answers.
- Likes are toggleable; a logged-in user can like and unlike an answer.
- Like notifications should not fire repeatedly if someone unlikes and likes again.
- Notify only on the first like, or after a long cooldown if implemented later.

Like visibility:

- Public sees like count if counts are enabled.
- Answer owner can see who liked.
- Public does not see the like list.
- If public counts are hidden, owner can still see private like list.

## Notifications

MVP notification channel:

- In-app notifications only.
- Email is only for auth magic links.
- Show notifications through an authenticated notifications page plus an unread indicator in the floating pill nav.

Priority order:

1. New question received.
2. Your question was answered.
3. Follow-up asked.
4. Follow-up answered.
5. Reaction/like.
6. New follower.

Notification rules:

- Logged-in attributed askers are notified when their question is answered.
- Logged-in anonymous askers are notified when their question is answered.
- Guest anonymous askers are not notified.
- Drafts do not trigger notifications.
- First publish triggers answer notification.
- Later edits do not notify.
- Follow-up participants are notified when new follow-up answers are published.
- Mark individual notifications as read when opened or clicked.
- Provide a "mark all as read" action.
- Keep notifications for 180 days, then allow cleanup.
- Group likes lightly only if needed, for example "3 people liked your answer."
- Do not overbuild notification grouping in MVP.

## Moderation And Safety

Core stance:

- The profile is curated by the owner.
- The inbox is private.
- Moderation starts with creator control.
- Platform admin tools are still required from day one.

Recipient-visible metadata:

- Show minimal safety/context hints only.
- Example: anonymous/attributed state, timestamp, and maybe source/referrer if reliable.
- Do not show country, device clues, or identity-like hints in normal UI.
- Internally store security metadata for rate limits, blocking, and admin moderation.

Creator controls:

- Delete question.
- Report question.
- Block sender.
- Mute words/phrases.
- Disable anonymous questions.
- Turn accepting questions on/off.
- Configure who can ask.
- Configure follow-up permissions.

Block types:

- Block account.
- Block anonymous fingerprint/IP-lite.
- Mute phrase.

Blocked anonymous behavior:

- Submission should appear successful to the blocked sender.
- The question is silently dropped or quarantined.
- Do not reveal block status because that helps abusers bypass controls.

Filtered questions:

- Muted-word or toxicity-filtered questions go to a separate Filtered folder.
- Filtered folder is not part of the default inbox view.
- Do not blur toxic content in the main inbox.
- Do not silently drop likely false positives forever.
- From the Filtered folder, a user can view, restore to inbox, delete, report, or block sender.
- Do not include automatic ML toxicity detection in MVP.
- Start with muted phrases, basic spam patterns, rate limits, reports, and admin tools.

Reports:

- Reportable entities:
  - Private inbox questions, by the recipient.
  - Public answers, by logged-in users.
  - Public profiles, by logged-in users.
- Anonymous visitor reports are not allowed in MVP.
- Report form should include reason enum plus optional text.
- Report reasons: harassment/bullying, hate, threats/violence, sexual content, self-harm, private information/doxxing, impersonation, spam/scam, and other.
- Optional report details have a 500 character limit.

Report plus block:

- When reporting a private inbox question, offer "also block sender" as checked by default.
- User can uncheck it.

Reported public content:

- Reported public answers stay visible until admin action.
- Later severe-abuse automation may auto-hide content, but not in MVP.
- Avoid single-report takedowns to reduce brigading risk.

Admin moderation console:

- Include a minimal admin moderation console from day one.
- Admin role lives in database, for example `users.role = user | admin`.
- No role-management UI in MVP.
- Admins can be promoted manually in DB or via seed script.

Admin MVP capabilities:

- View report queue.
- Inspect reported question/answer/profile.
- Inspect recent submissions by account/fingerprint where available.
- Suspend accounts.
- Hide/remove public answers.
- Review filtered/blocked patterns.
- See relevant timestamps and related activity.
- Take account actions: warn, suspend for 7 days, suspend for 30 days, permanently suspend, hide profile, and remove specific public content.
- Require admin notes for suspensions and content removals.
- Admin notes are optional when dismissing reports.

Suspensions:

- Suspended users cannot ask, answer, publish, like, follow, or edit public profile content.
- For severe cases, admins can also hide the profile.

Anonymous investigation:

- Admins should not get a clean "identity reveal" view for anonymous askers.
- Admins may see limited account/fingerprint/security metadata needed to investigate abuse.

## Rate Limits And Abuse Controls

Initial MVP limits:

- Guest anonymous asking: 5 questions per recipient per hour and 20 per recipient per day from the same IP/fingerprint.
- Guest anonymous global cap: 30 submissions per day from the same IP/fingerprint.
- Logged-in asking: 20 questions per account per day.
- Logged-in per-recipient cap: 10 questions per day.
- Follow-up asking: 10 follow-ups per account per day and 3 per thread per day.
- Likes: 100 like/unlike actions per account per day, with burst protection.
- Follows: 50 follows per account per day, with stricter limits for new accounts.
- Reports: 10 reports per account per day.
- Magic links: 5 requests per email per hour and 10 per day.

Abuse friction:

- Do not use CAPTCHA by default in MVP.
- Start with honeypot fields, minimum submit timing, rate limits, and blocking.
- Add CAPTCHA only if abuse requires it.
- Start with Postgres-backed rate limit counters for simplicity.
- Move hot limits to Upstash Redis if needed.

## Privacy, Retention, And Security

IP and safety metadata:

- Avoid storing raw IP addresses long-term.
- Store hashed IP/fingerprint values for abuse prevention with short retention.
- Server/provider logs may temporarily contain raw IPs.
- Retain anonymous safety metadata for 30 days for normal non-reported submissions.
- Retain report-linked or blocked-abuse metadata for 180 days.

Indexing:

- Public profiles and threads are noindex during beta.
- This matches the no-discovery posture and avoids surprising testers.
- Later, make indexing user-configurable.

Unavailable profiles:

- Deleted/deactivated profiles should show a simple unavailable page.
- Use 404 only when the username truly does not exist and has no active reservation/redirect.

Validation and CSRF:

- All mutating actions require server-side validation.
- Client validation is only a convenience.
- Server actions must enforce permissions, rate limits, and content validation.
- Authenticated mutating actions require CSRF protection.
- Use same-site cookies plus framework/auth CSRF protections or explicit session-bound CSRF tokens for custom forms.

Sessions:

- Session duration: 30 days.
- Sessions use secure, HTTP-only cookies.
- Let Better Auth manage refresh/session internals.

## Account Lifecycle And Privacy

Deactivate profile:

- Hides public profile.
- Disables new interactions.
- Keeps data recoverable.
- Reversible.

Delete account:

- Begins a 14-day deletion grace period.
- Profile is deactivated immediately.
- User can cancel deletion during grace period by signing back in or through an explicit recovery flow.
- After 14 days, remove account/profile data where possible.

Deletion effects:

- Already-published answers on other users' profiles are not automatically removed.
- If the deleted user asked an attributed question that was published, anonymize/unlink asker identity.
- Delete or unlink unanswered questions where possible.
- Retain short-lived safety/audit data only where needed for abuse prevention and legal/platform safety.
- Normal anonymous safety metadata retention is 30 days.
- Report-linked or blocked-abuse metadata retention is 180 days.

## Sharing And Open Graph

Sharing target:

- Share the profile URL.
- The owner profile keeps persistent copy/native-share actions.
- The profile URL lands visitors directly in ask mode.
- Separate answer/thread URLs exist for sharing specific answers.

Open Graph:

- MVP should include strong OG metadata for profile URLs and thread URLs.
- Profile OG metadata includes display name, username, avatar/fallback image, short bio if present, and "Ask me anything" CTA text based on anonymous settings.
- Thread OG metadata includes owner display name, a safe snippet of the public answer, and the profile/avatar.
- Thread OG metadata must not include hidden question text.
- Do not generate dynamic OG images in MVP.
- Use simple static/fallback OG images and metadata.
- Generated story/social image cards are future work.

## Internal Event Logging

No creator analytics workspace in MVP.

Still log minimal internal first-party events so the beta is measurable:

- Waitlist submitted.
- Invite accepted.
- Profile created.
- Profile setup completed.
- Share clicked/copied.
- Ask page viewed.
- Question submitted.
- Inbox viewed.
- Answer drafted.
- Answer published.
- Follow-up asked.
- Follow-up answered.
- Like created.
- Follow created.
- Report created.
- Admin action taken.

Privacy:

- Do not use invasive session replay.
- For anonymous visitors, use short-lived anonymous event IDs if needed.
- Do not create long-term anonymous tracking profiles.
- Keep analytics internal until the platform is working.

## Suggested Data Model

This is an implementation guide, not final schema syntax.

Auth-owned or auth-adjacent:

- `users`
  - `id`
  - `role`: `user | admin`
  - `suspensionStatus` nullable
  - `suspendedUntil` nullable
  - Better Auth fields as required
  - `createdAt`
  - `deletedAt`

- `inviteCodes`
  - `id`
  - `codeHash`
  - `usedByUserId` nullable
  - `usedAt` nullable
  - `createdAt`
  - `expiresAt` nullable

- `waitlistEntries`
  - `id`
  - `email`
  - `status`: `pending | invited | dismissed`
  - `createdAt`

Product identity:

- `profiles`
  - `id`
  - `userId`
  - `username`
  - `displayName`
  - `avatarUrl`
  - `bio`
  - `isActive`
  - `acceptingQuestions`
  - `anonymousQuestionsEnabled`
  - `askPermission`: `everyone | logged_in | followers | off`
  - `followUpPermissionDefault`: `anyone | logged_in | original_asker | off`
  - `showFollowerCounts`
  - `showLikeCounts`
  - `createdAt`
  - `updatedAt`

- `usernameReservations`
  - `id`
  - `username`
  - `profileId`
  - `redirectToUsername`
  - `reservedUntil`
  - `redirectUntil`
  - `createdAt`

Questions and answers:

- `questions`
  - `id`
  - `publicId`
  - `recipientProfileId`
  - `askerUserId` nullable
  - `askerProfileId` nullable
  - `identityMode`: `guest_anonymous | account_anonymous | account_attributed`
  - `source`: `public_profile`
  - `kind`: inferred as top-level when `threadId` is null, follow-up otherwise
  - `text`
  - `status`: `inbox | draft | answered | deleted | filtered | reported`
  - `threadId` nullable; set for follow-up questions and for top-level questions once a thread is created
  - `fingerprintHash` nullable
  - `ipHash` nullable
  - `referrer` nullable
  - `createdAt`
  - `deletedAt`

- `threads`
  - `id`
  - `publicId`
  - `ownerProfileId`
  - `initialQuestionId`
  - `status`: `draft | published | unpublished | deleted`
  - `followUpPermissionOverride` nullable
  - `followUpsEnabled`
  - `publishedAt`
  - `createdAt`
  - `updatedAt`

- `threadItems`
  - `id`
  - `publicId`
  - `threadId`
  - `questionId`
  - `answerText`
  - `displayQuestionText`
  - `questionTextMode`: `original | edited | hidden`
  - `status`: `draft | published | unpublished | deleted`
  - `position`
  - `publishedAt`
  - `createdAt`
  - `updatedAt`
  - `deletedAt`

Social:

- `follows`
  - `followerProfileId`
  - `followedProfileId`
  - `createdAt`

- `likes`
  - `profileId`
  - `threadItemId`
  - `createdAt`

- `pinnedAnswers`
  - `profileId`
  - `threadItemId`
  - `position`
  - `createdAt`

Notifications:

- `notifications`
  - `id`
  - `recipientUserId`
  - `type`
  - `actorUserId` nullable
  - `threadId` nullable
  - `threadItemId` nullable
  - `questionId` nullable
  - `readAt`
  - `createdAt`
  - `expiresAt`

Moderation:

- `blocks`
  - `id`
  - `ownerProfileId`
  - `blockedUserId` nullable
  - `fingerprintHash` nullable
  - `ipHash` nullable
  - `reason` nullable
  - `createdAt`

- `mutedPhrases`
  - `id`
  - `profileId`
  - `phrase`
  - `createdAt`

- `reports`
  - `id`
  - `reporterUserId`
  - `targetType`: `question | thread_item | profile`
  - `targetId`
  - `reason`: `harassment | hate | threats | sexual_content | self_harm | private_information | impersonation | spam_scam | other`
  - `details` nullable
  - `status`: `open | reviewed | actioned | dismissed`
  - `createdAt`
  - `reviewedAt`

- `adminActions`
  - `id`
  - `adminUserId`
  - `actionType`
  - `targetType`
  - `targetId`
  - `notes`
  - `createdAt`

- `rateLimitCounters`
  - `id`
  - `scope`
  - `subjectHash`
  - `action`
  - `windowStart`
  - `count`
  - `expiresAt`

Events:

- `events`
  - `id`
  - `userId` nullable
  - `profileId` nullable
  - `anonymousEventId` nullable
  - `type`
  - `metadata`
  - `createdAt`

## Public Routes

Recommended route map:

- `GET /`
  - Minimal product homepage with login/create-profile CTA and short explanation.
  - May include simple waitlist/request-access form.

- `GET /terms`
  - Basic Terms page before external beta.

- `GET /privacy`
  - Basic Privacy Policy page before external beta.

- `GET /:username`
  - Public profile, server-rendered.
  - Ask box visible at top.
  - Published answers below.
  - Noindex during beta.

- `POST /:username/questions`
  - Server action for top-level ask submission.
  - Must work without client JavaScript.

- `GET /:username/a/:threadPublicId`
  - Public thread permalink.
  - Noindex during beta.

- `POST /:username/a/:threadPublicId/follow-ups`
  - Server action for follow-up question submission.
  - Must respect follow-up permissions.

- `POST /reports`
  - Logged-in report submission for public content and recipient-owned private questions.

No public API:

- Do not build a separate public API in MVP.
- Use React Router loaders/actions for web flows.
- Add API routes later for mobile apps or integrations.

Sitemap:

- Do not ship a sitemap during noindex beta.
- Add a sitemap later only if public indexing becomes a deliberate feature.

## Authenticated Routes

Recommended route map:

- `GET /login`
  - Google primary, magic link fallback.

- `GET /setup`
  - Required profile setup after auth.

- `GET /feed`
  - Following feed.

- `GET /inbox`
  - Private incoming questions.

- `GET /drafts`
  - Drafted answers.

- `GET /filtered`
  - Filtered questions.

- `GET /notifications`
  - In-app notifications.

- `GET /answer/:questionId`
  - Private answer editor for an incoming question.

- `POST /answers/:threadItemPublicId/actions`
  - Published answer owner actions such as edit, pin, unpin, unpublish, and delete.

- `POST /likes`
  - Logged-in like/unlike action for published answers.

- `POST /follows`
  - Logged-in follow/unfollow action for profiles.

- `GET /settings/profile`
  - Display name, avatar, bio, username.

- `GET /settings/privacy`
  - Anonymous questions, ask permissions, follow-up defaults, count visibility.

- `GET /settings/safety`
  - Blocks, muted phrases, accepting questions.

- `GET /settings/account`
  - Deactivation, deletion request, and account lifecycle controls.

- `GET /admin`
  - Minimal admin moderation console.
  - Guard every admin loader/action by database role.

## Permission Matrix

Top-level ask:

- If actor is suspended: blocked.
- If profile inactive: blocked.
- If accepting questions is off: blocked.
- If ask permission is off: blocked.
- If ask permission is everyone:
  - Guest anonymous allowed only if anonymous questions are enabled.
  - Logged-in anonymous allowed only if anonymous questions are enabled.
  - Logged-in attributed allowed.
- If ask permission is logged-in only:
  - Guests blocked.
  - Logged-in anonymous allowed only if anonymous questions are enabled.
  - Logged-in attributed allowed.
- If ask permission is followers only:
  - Guests blocked.
  - Logged-in non-followers blocked.
  - Logged-in followers can ask anonymously if anonymous enabled or attributed.

Follow-up ask:

- If actor is suspended: blocked.
- Must reference an existing published thread.
- Must pass thread-level follow-up permission.
- Per-answer/thread override beats profile default.
- Original asker only requires an account-backed original asker.
- Anonymous guest original asker cannot use original-asker-only continuity.
- Thread must be below the 20 published-item cap.

Like:

- Logged-in only.
- Completed profile required.
- Cannot like own answer.
- Blocked users cannot like.
- Suspended users cannot like.

Follow:

- Logged-in only.
- Completed profile required.
- Blocked users cannot follow.
- Suspended users cannot follow.
- Following is instant in MVP.

Report:

- Logged-in only.
- Suspended users cannot create new reports unless admins later decide otherwise.
- Private question reports can be made by recipient.
- Public answer/profile reports can be made by logged-in users.

## Build Phases

Phase 1: Foundation

- React Router app.
- Database setup.
- Drizzle migrations.
- Better Auth integration.
- Profile setup.
- Username validation.
- Public profile route.

Phase 2: Core Q/A loop

- Public ask form without JavaScript.
- Private inbox.
- Answer draft.
- Publish answer.
- Public thread page.
- Answer notification.

Phase 3: Social loop

- Follow-ups.
- Follow/following.
- Following feed.
- Likes.
- Notification page.

Phase 4: Safety layer

- Blocks.
- Muted phrases.
- Filtered folder.
- Reports.
- Admin moderation console.
- Suspension/hide actions.
- Rate limits.

Phase 5: Beta readiness

- Open Graph metadata.
- Noindex beta configuration.
- Deployment.
- Terms and Privacy Policy pages.
- Invite/waitlist flow.

Moderation timing:

- Local development can start with the Q/A loop.
- Friends beta should not launch without report, block, rate-limit, and admin basics.

## Testing And Quality

Required tests before beta:

- Focused integration tests for permissions and data transitions.
- Playwright smoke tests for signup/setup.
- Playwright smoke test for public ask without JavaScript.
- Playwright smoke tests for answer publish, follow-up, like, and report.

No-JavaScript requirement:

- Explicitly test the no-JavaScript ask flow.
- This is a core requirement because shared links may open in hostile in-app browsers.

Seed data:

- Seed one admin.
- Seed a few profiles.
- Seed sample questions, threads, follows, likes, reports, and filtered questions.

Observability:

- Use basic server logs at minimum.
- Add an error tracking service before wider public beta if a free tier is available and setup is low-friction.

Feature flags:

- Use simple environment-based feature flags.
- Flags are enough for prompts, follow-ups if needed, admin tools, and future AI.

## Monetization And Future Direction

Beta monetization:

- Do not monetize during beta.
- Keep beta free.
- The goal is to validate the loop and safety model.

Likely later monetization:

- Paid creator tools.
- Advanced customization.
- Analytics.
- Stronger moderation controls.
- Generated share cards.
- Custom domain/profile branding.
- Higher limits.
- Avoid ads early.

AI monetization:

- AI prompts may become paid later, but not initially.
- First prove that people want to answer and receive real questions.
- AI remains secondary.

## Success Criteria

Minimum beta success signal:

- At least 30 percent of activated profiles receive one real question and publish one answer within 7 days.

Strongest early signal:

- Users voluntarily share their profile link again after receiving and answering questions.
- Repeat sharing is stronger than signup count.

Failure signals:

- Users create profiles but do not share them.
- Visitors view ask pages but do not submit questions.
- These indicate onboarding/share CTA or ask-page trust problems.

First-week beta review:

- Activation.
- Question submission rate.
- Answer publish rate.
- Abuse/report volume.
- Drop-off during signup/setup.
- Qualitative feedback from profile owners.

## Future Features

Postponed until after the platform is working:

- AI-generated question prompts.
- Creator analytics workspace.
- Email notifications beyond auth magic links.
- Comments under answers.
- Public discovery.
- Private profiles.
- Approved followers.
- Full-text profile search.
- Public search for usernames, display names, and bios.
- Generated story cards / share images.
- Dynamic Open Graph image generation.
- Rich answer formats beyond text.
- Image attachments to answers as the first answer-format expansion.
- Custom avatar uploads.
- Avatar/image storage via S3/R2-compatible object storage.
- Voice/video answers.
- Native mobile apps.
- Public API for mobile apps or integrations.
- Push notifications.
- Advanced trust-and-safety automation.
- ML toxicity detection.
- CAPTCHA or proof-of-work for abuse spikes.
- Custom user share text.
- Advanced public profile customization.
- Public follower/following lists.
- Algorithmic feed ranking.
- Full Arabic/RTL translated UI.
- Sitemap and search indexing after noindex beta, if intentionally enabled.

AI feature direction when added:

- Keep AI behind a provider-agnostic service wrapper.
- Start with curated categories first, AI personalization second.
- Cache outputs.
- Rate-limit per user.
- Make the feature disappear gracefully if quota is exhausted.
- Do not make AI the public product identity.

## Remaining Draft Assets

These are not strategic product decisions anymore, but concrete copy/assets that still need to be written before launch:

- Public brand name.
- Homepage copy.
- Terms of Service.
- Privacy Policy.
- Exact content-policy wording shown to users.
- Admin report-review copy and canned warning text.
- Static/fallback Open Graph image assets.
