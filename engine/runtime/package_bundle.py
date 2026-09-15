#!/usr/bin/env python3
"""Create a deterministic, self-verifying Pentest-Agent v3 ZIP."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath

from validate_bundle import validate_bundle


FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
ALWAYS_EXCLUDED = {".git", "__pycache__", ".pytest_cache"}


def _excluded(relative: Path, configured: list[str]) -> bool:
    parts = set(relative.parts)
    if parts & ALWAYS_EXCLUDED:
        return True
    normalized = relative.as_posix()
    return any(normalized == item or normalized.startswith(f"{item.rstrip('/')}/") for item in configured)


def _files(root: Path, configured: list[str], destination: Path) -> list[Path]:
    output: list[Path] = []
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"symlink cannot be packaged: {path}")
        if not path.is_file() or path.resolve() == destination.resolve():
            continue
        relative = path.relative_to(root)
        if not _excluded(relative, configured):
            output.append(path)
    return sorted(output, key=lambda item: item.relative_to(root).as_posix())


def _zip_info(archive_name: str, executable: bool = False) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(archive_name, FIXED_TIMESTAMP)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    mode = 0o755 if executable else 0o644
    info.external_attr = (mode & 0xFFFF) << 16
    return info


def _spdx_document(root: Path, payloads: list[tuple[Path, str, bytes, bool]]) -> bytes:
    files = []
    verification = hashlib.sha1()
    for _, archive_name, data, _ in payloads:
        sha1 = hashlib.sha1(data).hexdigest()
        verification.update(bytes.fromhex(sha1))
        identifier = "SPDXRef-File-" + hashlib.sha256(archive_name.encode()).hexdigest()[:20]
        files.append(
            {
                "SPDXID": identifier,
                "fileName": archive_name,
                "checksums": [
                    {"algorithm": "SHA256", "checksumValue": hashlib.sha256(data).hexdigest()}
                ],
                "licenseConcluded": "NOASSERTION",
                "copyrightText": "NOASSERTION",
            }
        )
    namespace_hash = hashlib.sha256("\n".join(item[1] for item in payloads).encode()).hexdigest()
    document = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": root.name,
        "documentNamespace": f"https://pentest-agent.local/spdx/{namespace_hash}",
        "creationInfo": {
            "created": "1980-01-01T00:00:00Z",
            "creators": ["Tool: pentest-agent-v3-package-bundle-0.1.0"],
        },
        "packages": [
            {
                "name": root.name,
                "SPDXID": "SPDXRef-Package",
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": True,
                "packageVerificationCode": {"packageVerificationCodeValue": verification.hexdigest()},
                "licenseConcluded": "NOASSERTION",
                "licenseDeclared": "NOASSERTION",
                "copyrightText": "NOASSERTION",
            }
        ],
        "files": files,
        "relationships": [
            {
                "spdxElementId": "SPDXRef-DOCUMENT",
                "relationshipType": "DESCRIBES",
                "relatedSpdxElement": "SPDXRef-Package",
            },
            *[
                {
                    "spdxElementId": "SPDXRef-Package",
                    "relationshipType": "CONTAINS",
                    "relatedSpdxElement": item["SPDXID"],
                }
                for item in files
            ],
        ],
    }
    return (json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def package_bundle(root: Path, destination: Path) -> str:
    root = root.resolve()
    destination = destination.resolve()
    if destination.exists():
        raise FileExistsError(f"refusing to overwrite existing archive: {destination}")
    if root == Path("/") or not root.is_dir():
        raise ValueError(f"unsafe or missing bundle root: {root}")

    report = validate_bundle(root)
    if not report.ok:
        raise ValueError("bundle validation failed:\n" + "\n".join(report.errors))

    import yaml

    framework = yaml.safe_load((root / "framework.yaml").read_text(encoding="utf-8"))
    configured = list(framework.get("packaging", {}).get("exclude", []))
    files = _files(root, configured, destination)
    prefix = root.name
    checksums: list[str] = []
    payloads: list[tuple[Path, str, bytes, bool]] = []
    for path in files:
        relative = path.relative_to(root).as_posix()
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        checksums.append(f"{digest}  {relative}")
        executable = bool(path.stat().st_mode & 0o111)
        payloads.append((path, f"{prefix}/{relative}", data, executable))

    sbom = _spdx_document(root, payloads)
    sbom_relative = "SBOM.spdx.json"
    checksums.append(f"{hashlib.sha256(sbom).hexdigest()}  {sbom_relative}")

    manifest = ("\n".join(checksums) + "\n").encode("utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w") as archive:
        for _, archive_name, data, executable in payloads:
            archive.writestr(_zip_info(archive_name, executable), data)
        archive.writestr(_zip_info(f"{prefix}/{sbom_relative}"), sbom)
        manifest_name = str(PurePosixPath(prefix) / "MANIFEST.sha256")
        archive.writestr(_zip_info(manifest_name), manifest)
    return hashlib.sha256(destination.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    try:
        digest = package_bundle(args.root, args.destination)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"created: {args.destination.resolve()}")
    print(f"sha256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
