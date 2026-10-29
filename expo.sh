#!/bin/zsh
# Runs Expo CLI for Luna Rosa with the tools installed on this Mac (Node, CocoaPods, Android SDK, Xcode),
# for this run only: it doesn't change your shell configuration.
#   ./expo.sh               → expo start --go   (QR for Expo Go; keys: i = iPhone, a = Android, r = reload)
#   ./expo.sh login         → expo login
#   ./expo.sh <args>        → any other expo command, e.g. ./expo.sh start --dev-client
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export LANG="${LANG:-en_US.UTF-8}"
cd "${0:A:h}" || exit 1
[ $# -eq 0 ] && set -- start --go
exec npx expo "$@"
