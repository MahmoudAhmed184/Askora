# Design Notes

Status: current production direction

The product is a social Q/A web app centered on public profiles, private
inbox intake, answer threads, follow-ups, likes, follows, a following feed,
notifications, settings, and admin moderation. It is intentionally not
discovery-led; growth comes from people sharing profile links externally.

`design/prototype` is the visual source artifact. Production should port the
prototype through `app/app.css`, shared primitives in `app/components/ui`,
layout components in `app/components/layout`, shared app utilities in
`app/components/shared`, and feature-owned components under
`app/features/<feature>/components`.

Primary signed-in routes are top-level product URLs:

- `/feed`
- `/inbox`
- `/filtered`
- `/drafts`
- `/prompts`
- `/notifications`
- `/answer/:questionId`
- `/settings/profile`
- `/settings/privacy`
- `/settings/safety`
- `/settings/account`

The primary app navigation is Feed, Inbox, Notifications, Profile, and
Settings. Keep the UI calm, mobile-first, direct, and safe enough for personal
questions while still feeling modern for creators.
