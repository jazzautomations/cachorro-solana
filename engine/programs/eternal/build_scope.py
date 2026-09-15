#!/usr/bin/env python3
"""Build a short-lived, unsigned Eternal scope receipt for explicit signing."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


HANDLE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
WEB_ACTIONS = ["http.observe", "http.sqli.differential"]

ALLOWED_HOSTS = [
    "*.zomato.com",
    "*.zomans.com",
    "*.runnr.in",
    "blinkit.com",
    "*.blinkit.com",
    "*.hyperpure.com",
    "*.grofer.io",
    "*.grofers.com",
    "www.district.in",
    "*.district.in",
    "*.insider.in",
    "*.edition.in",
    "*.ticketnew.com",
    "*.eternal.com",
    "*.zdev.net",
    "*.tktnew.com",
]

DENIED_HOSTS = [
    "www.zomatobook.com",
    "success.zomato.com",
    "send.zomato.com",
    "*.blinkit.support",
    "devpod.hyperpure.com",
    "devapi.hyperpure.com",
    "dev.hyperpure.com",
    "community.zomato.com",
    "business-blog.zomato.com",
    "blog.zomato.com",
    "*.zomatoportugal.com",
    "*.bstro.io",
    "*.ali.zomans.com",
]


def build_receipt(username: str, ttl_hours: int, now: datetime | None = None) -> dict[str, object]:
    if not HANDLE.fullmatch(username):
        raise ValueError("invalid HackerOne username")
    if ttl_hours < 1 or ttl_hours > 24:
        raise ValueError("TTL must be between 1 and 24 hours")
    issued = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    expires = issued + timedelta(hours=ttl_hours)
    stamp = issued.strftime("%Y%m%dT%H%M%SZ")
    assets = [
        {"kind": "host", "value": value, "actions": WEB_ACTIONS}
        for value in ALLOWED_HOSTS
    ]
    assets.append(
        {
            "kind": "url-prefix",
            "value": "https://mcp-server.zomato.com/mcp",
            "actions": WEB_ACTIONS,
        }
    )
    assets.extend(
        [
            {
                "kind": "filesystem",
                "value": "/root/evidence/eternal-osint-v3",
                "actions": ["artifact.import"],
            },
            {
                "kind": "filesystem",
                "value": "/root/evidence/zomato-web-public",
                "actions": ["artifact.import"],
            },
        ]
    )
    denied = [
        {"kind": "host", "value": value, "actions": WEB_ACTIONS}
        for value in DENIED_HOSTS
    ]
    denied.append(
        {
            "kind": "host-glob",
            "value": "staging*.runnr.in",
            "actions": WEB_ACTIONS,
        }
    )
    return {
        "schema_version": "0.1.0",
        "receipt_id": f"eternal-{username}-{stamp}",
        "authorization_reference": "HackerOne public program: eternal",
        "issued_at": issued.isoformat().replace("+00:00", "Z"),
        "expires_at": expires.isoformat().replace("+00:00", "Z"),
        "assets": assets,
        "denied_assets": denied,
        "allowed_side_effects": ["none", "workspace_write", "network_read"],
        "required_headers": {"X-Hackerone": username},
        "notes": (
            "Short-lived web observation receipt generated from the Eternal policy "
            "snapshot dated 2026-09-07; explicit denies take precedence."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True)
    parser.add_argument("--ttl-hours", type=int, default=12)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        document = build_receipt(args.username, args.ttl_hours)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as handle:
            json.dump(document, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
    except Exception as exc:
        parser.error(str(exc))
    print(json.dumps({"receipt": str(args.output), "receipt_id": document["receipt_id"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
