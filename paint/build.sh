#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
#
# build.sh -- build, install and update topology paint on Linux and macOS.
# (On Windows, run build.bat; it does the same.)
#
#   ./build.sh            build into build/out/            (the default)
#   ./build.sh run        build, then start it
#   ./build.sh install    build, then install for this user (no sudo)
#   ./build.sh update     git pull, build, install again
#   ./build.sh test       the core's tests (no SDL needed) and ctest
#   ./build.sh package    a .tar.gz of build/out in dist/
#   ./build.sh uninstall  remove what install put in place
#   ./build.sh clean      remove build/
#
# Needs: a C compiler, CMake 3.16+, and (the first time) network access to
# fetch SDL 3.2.26, which is checked against its SHA-256.  Ninja is used
# when present.  Where it installs:
#   Linux:  ~/.local/opt/topology-paint, a link in ~/.local/bin, a menu entry
#   macOS:  ~/Applications/topology-paint.app
set -eu
cd "$(dirname "$0")"
here=$(pwd)
action=${1:-build}
os=$(uname -s)

say() { printf '%s\n' "topology paint: $*"; }
die() { say "$*"; exit 1; }

check_tools() {
  command -v cmake >/dev/null 2>&1 || {
    case $os in
      Darwin) die "CMake is missing.  Install it:  brew install cmake  (and run: xcode-select --install)" ;;
      *) die "CMake is missing.  Debian/Ubuntu: sudo apt install build-essential cmake ninja-build git
       Fedora: sudo dnf install gcc cmake ninja-build git    Arch: sudo pacman -S base-devel cmake ninja git" ;;
    esac
  }
  command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1 || command -v clang >/dev/null 2>&1 ||
    die "No C compiler.  Linux: install build-essential (or gcc).  macOS: xcode-select --install"
  [ "$os" = Linux ] && linux_headers
  return 0
}

# SDL builds without what it cannot find, silently; say what each missing part costs.
linux_headers() {
  command -v pkg-config >/dev/null 2>&1 || { say "pkg-config not found: cannot check the optional headers"; return 0; }
  missing=""
  pkg-config --exists x11 xext || missing="$missing x11"
  pkg-config --exists xi || { say "warning: no XInput2 headers (libxi-dev): pen PRESSURE will not work on X11"; missing="$missing xi"; }
  pkg-config --exists wayland-client xkbcommon wayland-protocols egl || { say "note: no Wayland headers: on a Wayland desktop it will run through XWayland"; missing="$missing wayland"; }
  pkg-config --exists dbus-1 || { say "note: no D-Bus headers: file dialogs will need 'zenity' installed"; missing="$missing dbus"; }
  if [ -n "$missing" ]; then
    say "for everything, install (Debian/Ubuntu):"
    say "  sudo apt install libx11-dev libxext-dev libxi-dev libxrandr-dev libxcursor-dev libxfixes-dev libxss-dev \\"
    say "       libwayland-dev libxkbcommon-dev wayland-protocols libegl-dev libdbus-1-dev"
    say "  (Fedora: libX11-devel libXext-devel libXi-devel libXrandr-devel libXcursor-devel libXfixes-devel"
    say "   libXScrnSaver-devel wayland-devel libxkbcommon-devel wayland-protocols-devel mesa-libEGL-devel dbus-devel)"
    say "then: ./build.sh clean && ./build.sh"
  fi
}

build() {
  check_tools
  gen=""
  [ -f build/CMakeCache.txt ] || { command -v ninja >/dev/null 2>&1 && gen="-G Ninja"; }
  # shellcheck disable=SC2086
  cmake -S . -B build $gen -DCMAKE_BUILD_TYPE=Release ${TPAINT_CMAKE_ARGS:-}
  cmake --build build --config Release --parallel
  if [ "$os" = Darwin ]; then say "built: build/out/topology-paint.app"; else say "built: build/out/topology-paint"; fi
}

install_linux() {
  prefix=$HOME/.local/opt/topology-paint
  rm -rf "$prefix.new"
  cmake --install build --prefix "$prefix.new" >/dev/null
  rm -rf "$prefix" && mv "$prefix.new" "$prefix"
  mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications"
  ln -sf "$prefix/topology-paint" "$HOME/.local/bin/topology-paint"
  cat > "$HOME/.local/share/applications/topology-paint.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=topology paint
GenericName=Drawing and painting
Comment=Paint with brushes, layers and pen pressure
Exec=$prefix/topology-paint %f
Icon=applications-graphics
Terminal=false
Categories=Graphics;2DGraphics;RasterGraphics;
MimeType=image/openraster;image/vnd.adobe.photoshop;image/png;image/jpeg;image/bmp;image/tiff;image/x-tga;image/qoi;
EOF
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
  say "installed in $prefix; run it as: topology-paint (from ~/.local/bin) or from the menu"
  case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) say "note: ~/.local/bin is not on your PATH" ;; esac
}
install_mac() {
  mkdir -p "$HOME/Applications"
  rm -rf "$HOME/Applications/topology-paint.app"
  cp -R build/out/topology-paint.app "$HOME/Applications/"
  say "installed: ~/Applications/topology-paint.app (first start: right-click > Open, as it is not notarized)"
}
do_install() { if [ "$os" = Darwin ]; then install_mac; else install_linux; fi; }

case $action in
  build) build ;;
  run) build; if [ "$os" = Darwin ]; then open build/out/topology-paint.app; else build/out/topology-paint; fi ;;
  install) build; do_install ;;
  update)
    if [ -d "$here/../.git" ] || git -C "$here" rev-parse --git-dir >/dev/null 2>&1; then
      say "fetching the latest version"; git -C "$here" pull --ff-only
    else say "not a git checkout: rebuilding what is here"; fi
    build; do_install ;;
  test)
    sh tests/run.sh
    if [ -f build/CMakeCache.txt ]; then (cd build && ctest --output-on-failure -C Release); fi ;;
  package)
    build; mkdir -p dist
    name=topology-paint-$(sed -n 's/^#define TPAINT_VERSION "\(.*\)"/\1/p' src/core/tpaint.h)-$(echo "$os" | tr 'A-Z' 'a-z')-$(uname -m)
    tar -C build/out -czf "dist/$name.tar.gz" .
    say "dist/$name.tar.gz" ;;
  uninstall)
    rm -rf "$HOME/.local/opt/topology-paint" "$HOME/.local/bin/topology-paint" "$HOME/.local/share/applications/topology-paint.desktop" "$HOME/Applications/topology-paint.app"
    say "removed (your settings, brushes and mods in the user folder are kept)" ;;
  clean) rm -rf build; say "removed build/" ;;
  -h|--help|help) sed -n '4,22p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown action '$action' (try: ./build.sh help)" ;;
esac
