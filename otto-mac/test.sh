#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build/tests build/module-cache
swiftc -module-cache-path "$PWD/build/module-cache" Sources/TimerCore.swift Tests/main.swift -o build/tests/TimerCoreTests
build/tests/TimerCoreTests
