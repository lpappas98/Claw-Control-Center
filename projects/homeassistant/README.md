# Home Assistant Core (hosted on this Mac)

Install location
- venv: `/Users/openclaw/homeassistant/venv`
- config: `/Users/openclaw/.homeassistant`

LaunchAgent
- plist: `~/Library/LaunchAgents/ai.homeassistant.core.plist`
- logs: `/tmp/homeassistant-core.out.log`, `/tmp/homeassistant-core.err.log`

Access
- Local: http://127.0.0.1:8123
- LAN: http://<this-mac-lan-ip>:8123 (once macOS firewall allows inbound)

Notes
- This is Home Assistant **Core** (no Supervisor / Add-on store) because Docker Desktop/Podman aren’t supported on macOS 12.
