# Meau — Spec Pack

College carpool app for Amity University Mumbai. This folder is the complete build spec for Claude Code.

## How to use with Claude Code
1. Put this whole `specs/` folder at the root of your project.
2. Also copy `CLAUDE.md` to your project root (Claude Code reads it automatically).
3. Tell Claude Code: *"Read CLAUDE.md and all files in specs/ in order, then start Phase 0 from 12-BUILD-PLAN.md. Build one phase at a time and give me a device test checklist after each."*

## Files
- `CLAUDE.md` — entry point + hard rules (copy to project root)
- `00-PROJECT-OVERVIEW.md`
- `01-TECH-STACK.md`
- `02-DATABASE-SCHEMA.md`
- `03-AUTH-AMIZONE.md`
- `04-APP-STRUCTURE.md`
- `05-DRIVER-FLOW.md`
- `06-PASSENGER-FLOW.md`
- `07-AUTO-POOL.md`
- `08-MATCHING-SERVER.md`
- `09-NOTIFICATIONS.md`
- `10-CHAT.md`
- `11-UI-DESIGN.md`
- `12-BUILD-PLAN.md`

## Before you start (accounts/keys you'll need)
- Supabase project (URL + anon key + service role key)
- Google Cloud project with Maps SDK (Android/iOS), Directions, Places enabled → API key
- Expo account (EAS) for push notifications + builds
- Railway or Render account (free) for the two services
- go-amizone (self-host or wrap) for real Amity verification

Put keys in `.env` files per `01-TECH-STACK.md`. Never commit them.
