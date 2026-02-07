# Keep this Mac awake (for OpenClaw + Home Assistant)

We run a user LaunchAgent that keeps the machine awake using macOS `caffeinate`.

## Installed
- LaunchAgent: `~/Library/LaunchAgents/ai.keepawake.plist`
- Command: `/usr/bin/caffeinate -dimsu`
- Logs: `/tmp/keepawake.out.log`, `/tmp/keepawake.err.log`

## Manage
- Stop:
  - `launchctl stop ai.keepawake`
  - `launchctl unload ~/Library/LaunchAgents/ai.keepawake.plist`

- Start:
  - `launchctl load ~/Library/LaunchAgents/ai.keepawake.plist`
  - `launchctl start ai.keepawake`

Notes:
- This does not require sudo.
- Display may still sleep depending on settings; `-d` requests display stay awake too.
