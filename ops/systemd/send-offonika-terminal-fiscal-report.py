#!/usr/bin/env python3
import json
import socket
import sys
import urllib.parse
import urllib.request

ENV_PATH = "/home/codex-vps/.config/ai-business-os/owner-bot.env"


def env_file():
    result = {}
    with open(ENV_PATH, encoding="utf-8") as handle:
        for raw in handle:
            if "=" in raw and not raw.lstrip().startswith("#"):
                key, value = raw.split("=", 1)
                result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def main():
    envelope = json.load(sys.stdin)
    message = str(envelope.get("text") or "")
    if not (message.startswith("✅ Контроль оплат по терминалу") or message.startswith("⚠️ Контроль оплат по терминалу")) or len(message) > 1800:
        raise SystemExit("MESSAGE_INVALID")
    env = env_file()
    token = env.get("OWNER_TELEGRAM_BOT_TOKEN", "")
    chat_id = env.get("OWNER_TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        raise SystemExit("TELEGRAM_RUNTIME_CONFIG_MISSING")
    original = socket.getaddrinfo
    socket.getaddrinfo = lambda host, port, family=0, socktype=0, proto=0, flags=0: original(host, port, socket.AF_INET, socktype, proto, flags)
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=urllib.parse.urlencode({"chat_id": chat_id, "text": message}).encode(),
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        result = json.loads(response.read().decode())
    if not result.get("ok") or str(((result.get("result") or {}).get("chat") or {}).get("id")) != str(chat_id):
        raise SystemExit("TELEGRAM_DELIVERY_NOT_CONFIRMED")
    print(json.dumps({"ok": True, "messageId": (result.get("result") or {}).get("message_id")}, separators=(",", ":")))


if __name__ == "__main__":
    main()
