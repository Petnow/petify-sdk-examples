#!/usr/bin/env bash
# The "Option B: Xcode Workspace" step of the iOS Getting Started guide
# (https://docs.petnow.io/petify/docs/sdk/ios/getting-started), scripted for
# this example: log in to AWS CodeArtifact from a dummy Package.swift directory,
# then copy the generated registries.json into PrewarmExample.xcworkspace.
#
# Needs the environment variables from the Petify Console (see README.md).
# The token lives in your macOS keychain and expires after 12 hours; run this
# again when Xcode cannot resolve petnow.ui.
set -euo pipefail

missing=()
for var in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION \
           PETNOW_CODEARTIFACT_DOMAIN PETNOW_AWS_ACCOUNT_ID PETNOW_IOS_SDK_REPOSITORY; do
  [[ -n "${!var:-}" ]] || missing+=("$var")
done
if (( ${#missing[@]} )); then
  echo "Set these from the Petify Console first: ${missing[*]}" >&2
  exit 1
fi

here="$(cd "$(dirname "$0")/.." && pwd)"
target="$here/PrewarmExample.xcworkspace/xcshareddata/swiftpm/configuration"

# Step 1: generate the registry configuration in a dummy package.
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
cat > "$scratch/Package.swift" <<'SWIFT'
// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "DummyPackage",
    products: [],
    dependencies: [],
    targets: []
)
SWIFT

(cd "$scratch" && aws codeartifact login --tool swift \
  --domain "$PETNOW_CODEARTIFACT_DOMAIN" \
  --domain-owner "$PETNOW_AWS_ACCOUNT_ID" \
  --repository "$PETNOW_IOS_SDK_REPOSITORY" \
  --namespace petnow)

# Step 2: copy it into the workspace.
mkdir -p "$target"
cp "$scratch/.swiftpm/configuration/registries.json" "$target/"
echo "Copied registries.json to PrewarmExample.xcworkspace (git-ignored). Open PrewarmExample.xcworkspace."
