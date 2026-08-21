#!/usr/bin/env bash
#
# Set this repository's GitHub Actions secrets, interactively.
#
#   ./scripts/setup-secrets.sh            # everything, skipping what is set
#   ./scripts/setup-secrets.sh notion     # just NOTION_TOKEN
#   ./scripts/setup-secrets.sh deploy     # just the Kualo rsync secrets
#   ./scripts/setup-secrets.sh --force    # re-enter values that are already set
#
# Why a script rather than the GitHub UI: the deploy needs an SSH keypair and
# the host's public key, and both are easier to get right here than by pasting.
# Nothing is echoed, nothing is written to disk except the deploy key you choose
# to generate, and no value reaches this repository.
#
# WHAT NOT TO DO INSTEAD: do not create these secrets with placeholder values to
# "reserve the name". Both workflows gate on a secret being PRESENT — that is
# what makes them skip cleanly while you are still setting up. A placeholder
# NOTION_TOKEN turns the hourly sync from "skipped" into "failed" every hour,
# and a placeholder KUALO_HOST points a deploy at a machine that is not there.
set -euo pipefail

REPO="Baasie/collaborative-software-design.com"

usage() {
  sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

WHAT=all
FORCE=0
for a in "$@"; do
  case "$a" in
    --force)          FORCE=1 ;;
    -h|--help|help)   usage 0 ;;
    all|notion|deploy) WHAT="$a" ;;
    # An unrecognised argument used to fall through and quietly do nothing,
    # which looks identical to "everything was already set".
    *) echo "Unknown argument: $a" >&2; usage 1 ;;
  esac
done

command -v gh >/dev/null || { echo "gh is not installed: https://cli.github.com" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in. Run: gh auth login" >&2; exit 1; }

have() { gh secret list --repo "$REPO" 2>/dev/null | cut -f1 | grep -qx "$1"; }

# Ask for one secret and set it. `-s` keeps it off the screen; the value is
# piped to gh rather than passed as an argument, so it never reaches `ps`.
ask() {
  local name="$1" prompt="$2" optional="${3:-}" value=""
  if have "$name" && [ "$FORCE" -eq 0 ]; then
    echo "  · $name is already set (--force to replace)"
    return
  fi
  printf '  %s\n    %s\n    > ' "$name" "$prompt"
  read -rs value; echo
  if [ -z "$value" ]; then
    if [ -n "$optional" ]; then echo "    skipped"; return; fi
    echo "    nothing entered; skipped"; return
  fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  echo "    set"
}

# Same, but not secret — so it can be shown while typing and checked.
ask_visible() {
  local name="$1" prompt="$2" optional="${3:-}" value=""
  if have "$name" && [ "$FORCE" -eq 0 ]; then
    echo "  · $name is already set (--force to replace)"
    return
  fi
  printf '  %s\n    %s\n    > ' "$name" "$prompt"
  read -r value
  if [ -z "$value" ]; then
    if [ -n "$optional" ]; then echo "    skipped"; return; fi
    echo "    nothing entered; skipped"; return
  fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  echo "    set"
}

echo "Setting secrets on $REPO"
echo

if [ "$WHAT" = "all" ] || [ "$WHAT" = "notion" ]; then
  echo "── Notion ─────────────────────────────────────────────────────────────"
  echo "  Create an internal integration at https://www.notion.so/my-integrations"
  echo "  and give it access to the 'Collaborative software design' teamspace."
  echo
  ask NOTION_TOKEN "The integration token (starts ntn_). Input is hidden."
  echo
fi

if [ "$WHAT" = "all" ] || [ "$WHAT" = "deploy" ]; then
  echo "── The host ───────────────────────────────────────────────────────────"
  ask_visible KUALO_HOST "SSH hostname, e.g. ssh.kualo.com"
  ask_visible KUALO_USER "SSH username"
  ask_visible KUALO_PATH "Absolute path to the docroot's PARENT — the deploy writes \$PATH/releases/… and moves \$PATH/current"
  ask_visible KUALO_SSH_PORT "SSH port (blank for 22)" optional
  ask_visible SITE_URL "Public URL for the post-deploy check, e.g. https://collaborative-software-design.com" optional
  echo

  echo "── The deploy key ─────────────────────────────────────────────────────"
  if have KUALO_SSH_KEY && [ "$FORCE" -eq 0 ]; then
    echo "  · KUALO_SSH_KEY is already set (--force to replace)"
  else
    KEY="${HOME}/.ssh/csd-deploy"
    if [ -f "$KEY" ]; then
      echo "  Using the existing key at $KEY"
    else
      echo "  Generating a new deploy key at $KEY (no passphrase — a CI key cannot type one)"
      ssh-keygen -t ed25519 -N '' -C 'collaborative-software-design.com deploy' -f "$KEY" >/dev/null
    fi
    gh secret set KUALO_SSH_KEY --repo "$REPO" < "$KEY"
    echo "    KUALO_SSH_KEY set from the private key"
    echo
    echo "  ▸ Put this PUBLIC key in the host's ~/.ssh/authorized_keys:"
    echo
    sed 's/^/      /' "${KEY}.pub"
    echo
    echo "    On Kualo that is cPanel → SSH Access → Manage SSH Keys → Import,"
    echo "    then Authorize. Or, if you already have shell access:"
    echo "      ssh-copy-id -i ${KEY}.pub <user>@<host>"
    echo
  fi

  echo "── The host's own key ─────────────────────────────────────────────────"
  if have KUALO_KNOWN_HOSTS && [ "$FORCE" -eq 0 ]; then
    echo "  · KUALO_KNOWN_HOSTS is already set (--force to replace)"
  else
    # StrictHostKeyChecking=yes with a pinned key, not `no`. Turning it off to
    # save this step is how a deploy quietly starts trusting whatever answers.
    printf '  Hostname to scan (blank to skip): '
    read -r scan_host
    printf '  Port [22]: '
    read -r scan_port
    scan_port="${scan_port:-22}"
    if [ -n "$scan_host" ]; then
      echo "  Scanning $scan_host:$scan_port …"
      if ssh-keyscan -p "$scan_port" -t rsa,ecdsa,ed25519 "$scan_host" 2>/dev/null | grep -q .; then
        ssh-keyscan -p "$scan_port" -t rsa,ecdsa,ed25519 "$scan_host" 2>/dev/null \
          | gh secret set KUALO_KNOWN_HOSTS --repo "$REPO"
        echo "    set"
        echo
        echo "  ▸ Check this fingerprint against what the host told you:"
        ssh-keyscan -p "$scan_port" -t ed25519 "$scan_host" 2>/dev/null \
          | ssh-keygen -lf - 2>/dev/null | sed 's/^/      /' || true
      else
        echo "    ! $scan_host:$scan_port did not answer; skipped"
      fi
    else
      echo "    skipped"
    fi
  fi
  echo
fi

echo "── Now set ────────────────────────────────────────────────────────────"
gh secret list --repo "$REPO" | sed 's/^/  /'
echo
echo "Next:"
echo "  gh workflow run 'Sync from Notion' --repo $REPO   # pull the content"
echo "  gh run watch \$(gh run list --repo $REPO --limit 1 --json databaseId -q '.[0].databaseId')"
