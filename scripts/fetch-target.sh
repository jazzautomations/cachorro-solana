#!/bin/bash
# Fetch a Solana target. Deterministic, no AI.
# Uso:
#   bash scripts/fetch-target.sh --repo <git_url> <dest_dir>
#   bash scripts/fetch-target.sh --program-id <PUBKEY> <cluster> <dest_dir>   (cluster: mainnet|devnet|<rpc-url>)
set -euo pipefail
export HOME="${HOME:-/root}"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
MODE="${1:-}"
case "$MODE" in
  --repo)
    REPO="${2:?repo url}"; DEST="${3:?dest dir}"; mkdir -p "$DEST"
    echo "[*] Clonando $REPO ..."
    # OAuth session token → private repos. Via http.extraheader so the
    # token never lands in .git/config.
    if [[ -n "${CACHORRO_GH_TOKEN:-}" && "$REPO" == https://github.com/* ]]; then
      B64=$(printf 'x:%s' "$CACHORRO_GH_TOKEN" | base64 -w0)
      if ! git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $B64" clone --depth 1 "$REPO" "$DEST/repo" 2>/dev/null; then
        rm -rf "$DEST/repo"; git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $B64" clone "$REPO" "$DEST/repo"
      fi
      echo "[+] private repo — github session token used (never stored)"
    elif ! git clone --depth 1 "$REPO" "$DEST/repo" 2>/dev/null; then
      rm -rf "$DEST/repo"; git clone "$REPO" "$DEST/repo"
    fi
    echo "[+] Codigo em: $DEST/repo"
    echo "[+] Programs (Rust crates):"
    find "$DEST/repo" -name Cargo.toml -path '*programs*' 2>/dev/null | sed 's#/Cargo.toml##'
    echo "[+] declare_id! found:"
    grep -rInE 'declare_id!' "$DEST/repo" --include=*.rs 2>/dev/null | head
    ;;
  --program-id)
    PID="${2:?program pubkey}"; CLUSTER="${3:-mainnet}"; DEST="${4:?dest dir}"
    mkdir -p "$DEST/onchain"
    case "$CLUSTER" in
      mainnet|mainnet-beta) URL="https://api.mainnet-beta.solana.com";;
      devnet) URL="https://api.devnet.solana.com";;
      *) URL="$CLUSTER";;
    esac
    echo "[*] Dumping on-chain program $PID from $URL ..."
    solana program dump -u "$URL" "$PID" "$DEST/onchain/program.so" 2>&1 || echo "[!] program dump failed (may be non-upgradeable or RPC-limited)"
    echo "[*] Program account info:"
    solana account -u "$URL" "$PID" --output json 2>/dev/null | tee "$DEST/onchain/program_account.json" | head -20 || true
    echo "[*] Trying to fetch Anchor IDL on-chain..."
    if command -v anchor >/dev/null 2>&1; then
      anchor idl fetch -u "$URL" "$PID" > "$DEST/onchain/idl.json" 2>/dev/null && echo "[+] IDL -> $DEST/onchain/idl.json" || echo "[~] no on-chain IDL (private/absent)"
    fi
    echo "[+] On-chain material in: $DEST/onchain"
    echo "[!] NOTE: bytecode is not source. Find the source repo (github, verified build) for a real audit."
    ;;
  --site)
    # Black-box web target: GET-only recon. SSRF-guarded — refuses private IPs.
    SITE="${2:?site url}"; DEST="${3:?dest dir}"; mkdir -p "$DEST/site"
    case "$SITE" in http://*|https://*) ;; *) echo "[!] site must be http(s) url"; exit 1;; esac
    HOST=$(python3 -c "from urllib.parse import urlsplit;print(urlsplit('$SITE').hostname or '')")
    [ -z "$HOST" ] && { echo "[!] unparseable site"; exit 1; }
    # resolve + refuse private/loopback/link-local
    python3 - "$HOST" <<'EOF' || { echo "[!] refused: private/loopback host"; exit 1; }
import socket, sys, ipaddress
host = sys.argv[1]
try:
    for info in socket.getaddrinfo(host, 443):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            sys.exit(1)
except socket.gaierror:
    sys.exit(2)
EOF
    echo "[*] Black-box recon on $SITE ..."
    UA="cachorro-recon/1.0 (+authorized-test)"
    curl -skL --max-time 20 -A "$UA" -D "$DEST/site/root.headers" -o "$DEST/site/index.html" "$SITE" || true
    # well-known surfaces — GET only
    for p in robots.txt sitemap.xml .well-known/security.txt openapi.json api/health manifest.json .env .git/HEAD package.json; do
      code=$(curl -skL -o "$DEST/site/$(echo "$p" | tr '/.' '__').body" -w "%{http_code}" --max-time 10 -A "$UA" "$SITE/$p" 2>/dev/null)
      echo "$code /$p" >> "$DEST/site/probe_paths.txt"
    done
    # harvest js bundle urls from index, fetch the top ones (app code is where secrets live)
    grep -oE '(src|href)="[^"]+\.(js|mjs)[^"]*"' "$DEST/site/index.html" 2>/dev/null | sed -E 's/^(src|href)="//; s/"$//' | head -20 > "$DEST/site/js_urls.txt"
    mkdir -p "$DEST/site/js"
    while read -r u; do
      case "$u" in http*|//*) :;; *) u="${SITE%/}/$u";; esac
      u="${u#//}"; case "$u" in http*) ;; *) u="https://$u";; esac
      fn=$(echo "$u" | md5sum | cut -c1-10).js
      curl -skL --max-time 15 -A "$UA" -o "$DEST/site/js/$fn" "$u" 2>/dev/null && echo "$u" >> "$DEST/site/js/fetched.txt"
    done < "$DEST/site/js_urls.txt"
    echo "[+] site recon in: $DEST/site ($(du -sh "$DEST/site" | cut -f1))"
    ;;
  *)
    echo "Uso:"
    echo "  bash scripts/fetch-target.sh --repo <git_url> <dest_dir>"
    echo "  bash scripts/fetch-target.sh --program-id <PUBKEY> <cluster> <dest_dir>"
    echo "  bash scripts/fetch-target.sh --site <https://host> <dest_dir>   (black-box GET recon)"
    exit 1
    ;;
esac
