#!/usr/bin/env python3
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = "/home/codex-vps/.config/ai-business-os/owner-bot.env"
MAX_INPUT_BYTES = 16_384


def load_env(path):
    values = {}
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def force_ipv4():
    original = socket.getaddrinfo

    def ipv4(host, port, family=0, socktype=0, proto=0, flags=0):
        return original(host, port, socket.AF_INET, socktype, proto, flags)

    socket.getaddrinfo = ipv4


def fail(code, exit_code):
    print(json.dumps({"ok": False, "errorCode": code}, separators=(",", ":")))
    raise SystemExit(exit_code)


def main():
    if sys.argv[1:] == ["--probe"]:
        env = load_env(ENV_PATH)
        token = env.get("OWNER_TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = env.get("OWNER_TELEGRAM_CHAT_ID", "").strip()
        if not token or not chat_id:
            fail("TELEGRAM_RUNTIME_CONFIG_MISSING", 1)
        force_ipv4()
        try:
            with urllib.request.urlopen(f"https://api.telegram.org/bot{token}/getMe", timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            fail("TELEGRAM_PROBE_FAILED", 1)
        if not result.get("ok"):
            fail("TELEGRAM_PROBE_FAILED", 1)
        print(json.dumps({"ok": True, "chatConfigured": True}, separators=(",", ":")))
        return
    raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        fail("PAYLOAD_TOO_LARGE", 1)
    try:
        envelope = json.loads(raw.decode("utf-8"))
        delivery = envelope.get("delivery") or {}
    except Exception:
        fail("PAYLOAD_INVALID", 1)
    message = str(delivery.get("text") or "")
    href = str(delivery.get("href") or "")
    if not message.startswith("Новая заявка на расход\n") or len(message) > 1500:
        fail("MESSAGE_INVALID", 1)
    if not href.startswith("/admin/expense-requests/") or any(ch in href for ch in "\r\n"):
        fail("HREF_INVALID", 1)

    env = load_env(ENV_PATH)
    token = env.get("OWNER_TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = env.get("OWNER_TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        fail("TELEGRAM_RUNTIME_CONFIG_MISSING", 1)
    base_url = os.environ.get("PORTAL_PUBLIC_BASE_URL", "https://portal.alebazia.xyz").rstrip("/")
    payload = {
        "chat_id": chat_id,
        "text": message,
        "disable_web_page_preview": "true",
        "reply_markup": json.dumps({"inline_keyboard": [[{"text": "Открыть заявку", "url": base_url + href}]]}, ensure_ascii=False),
    }
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=urllib.parse.urlencode(payload).encode(),
        method="POST",
    )
    force_ipv4()
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        fail("TELEGRAM_RETRYABLE" if exc.code == 429 or exc.code >= 500 else "TELEGRAM_REJECTED", 75 if exc.code == 429 or exc.code >= 500 else 1)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        fail("TELEGRAM_DELIVERY_UNCERTAIN", 76)
    if not result.get("ok"):
        fail("TELEGRAM_REJECTED", 1)
    message_id = ((result.get("result") or {}).get("message_id"))
    if message_id is None:
        fail("TELEGRAM_DELIVERY_UNCERTAIN", 76)
    print(json.dumps({"ok": True, "messageId": str(message_id)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
