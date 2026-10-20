#!/bin/sh
set -eu
cd "$(dirname "$0")"
bundle="build/OTTO Timer.app"
mkdir -p "$bundle/Contents/MacOS" build/module-cache
swiftc -module-cache-path "$PWD/build/module-cache" -O -target "$(uname -m)-apple-macos13.0" -framework AppKit -framework WebKit \
  Sources/TimerCore.swift Sources/TimerApp.swift Sources/main.swift \
  -o "$bundle/Contents/MacOS/OTTOTimer"
cp Info.plist "$bundle/Contents/Info.plist"
codesign --force --sign - "$bundle"
printf '%s\n' "Built: $(pwd)/$bundle"
