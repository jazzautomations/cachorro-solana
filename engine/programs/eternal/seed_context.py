#!/usr/bin/env python3
"""Import an allowlisted public Eternal evidence set into a campaign vault."""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "runtime"))

from campaign import Campaign  # noqa: E402


SOURCES = (
    Path("/root/evidence/eternal-osint-v3/artifact-sha256.txt"),
    Path("/root/evidence/eternal-osint-v3/http-dns-observations.md"),
    Path("/root/evidence/eternal-osint-v3/hyperpure-route-chronology.tsv"),
    Path("/root/evidence/eternal-osint-v3/mcp-public-issue-evidence.md"),
    Path("/root/evidence/eternal-osint-v3/ct-zomato-v3.json"),
    Path("/root/evidence/eternal-osint-v3/ct-zomans-v3.json"),
    Path("/root/evidence/eternal-osint-v3/ct-runnr-v3.json"),
    Path("/root/evidence/eternal-osint-v3/ct-blinkit-v3.json"),
    Path("/root/evidence/eternal-osint-v3/ct-grofers-v3.json"),
    Path("/root/evidence/eternal-osint-v3/ct-groferio-v3.json"),
    Path("/root/evidence/eternal-osint-v3/ct-hyperpure-v3.json"),
    Path("/root/evidence/zomato-web-public/search-network-contract-snippets.txt"),
    Path("/root/evidence/zomato-web-public/responses.json"),
)
MAX_FILE_BYTES = 3_000_000


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    try:
        campaign = Campaign(args.bundle, args.workspace)
        imported: list[dict[str, object]] = []
        for path in SOURCES:
            resolved = path.resolve(strict=True)
            if path.is_symlink() or not resolved.is_file():
                raise ValueError(f"evidence source must be a regular non-symlink file: {path}")
            campaign.guard.authorize(
                "artifact.import",
                str(resolved),
                side_effect="workspace_write",
            )
            size = resolved.stat().st_size
            if size > MAX_FILE_BYTES:
                raise ValueError(f"evidence source exceeds {MAX_FILE_BYTES} bytes: {resolved}")
            artifact = campaign.evidence.put(
                resolved.read_bytes(),
                media_type=mimetypes.guess_type(resolved.name)[0] or "application/octet-stream",
                source=f"local-public-evidence:{resolved}",
                tool="eternal-seed-context",
                tool_version="0.1.0",
                agent_package_hash=campaign.agent_hash("context-modeler"),
                scope_receipt_id=campaign.config["scope_receipt_id"],
            )
            imported.append(
                {
                    "source": str(resolved),
                    "bytes": size,
                    "artifact_id": artifact["artifact_id"],
                }
            )
        output = campaign.workspace / "context/eternal-seed-index.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8") as handle:
            json.dump({"schema_version": "0.1.0", "artifacts": imported}, handle, indent=2, sort_keys=True)
            handle.write("\n")
        campaign.journal.append(
            "context.seeded",
            {
                "source_set": "eternal-public-osint-v3",
                "artifacts": [item["artifact_id"] for item in imported],
                "index": str(output),
            },
        )
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"index": str(output), "imported": len(imported)}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
