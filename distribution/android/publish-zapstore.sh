#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"

keystore=""
link_certificate=true
publish_args=()
if (($#)) && [[ "$1" != -* ]]; then
  keystore="$1"
  shift
fi
while (($#)); do
  case "$1" in
    --keystore)
      if (($# < 2)) || [[ -z "$2" || "$2" == --* ]]; then
        echo "--keystore requires a file path." >&2
        exit 2
      fi
      keystore="$2"
      shift 2
      ;;
    --keystore=*)
      keystore="${1#*=}"
      if [[ -z "$keystore" ]]; then
        echo "--keystore requires a file path." >&2
        exit 2
      fi
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [KEYSTORE | --keystore PATH] [zsp publish arguments]"
      echo "Links the supplied keystore before publishing; --check and --offline skip linking."
      exit 0
      ;;
    --check|--offline)
      link_certificate=false
      publish_args+=("$1")
      shift
      ;;
    *)
      publish_args+=("$1")
      shift
      ;;
  esac
done

if [[ -n "$keystore" ]]; then
  case "$keystore" in
    '~/'*) keystore="$HOME/${keystore#\~/}" ;;
  esac
  if [[ ! -f "$keystore" || ! -r "$keystore" ]]; then
    echo "Keystore must be a readable file: $keystore" >&2
    exit 2
  fi
  keystore="$(cd -- "$(dirname -- "$keystore")" && pwd)/$(basename -- "$keystore")"
fi

if ! command -v zsp >/dev/null 2>&1; then
  echo "zsp is required. See $script_dir/zapstore.md for installation instructions." >&2
  exit 127
fi

cd -- "$repo_root"
export SIGN_WITH="${SIGN_WITH:-browser}"
if [[ -n "$keystore" && "$link_certificate" == true ]]; then
  zsp identity --link-key "$keystore"
fi
exec zsp publish "$repo_root/zapstore.yaml" --pre-release --channel beta ${publish_args[@]+"${publish_args[@]}"}
