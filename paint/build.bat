@echo off
rem SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
rem
rem build.bat -- build, install and update topology paint on Windows.
rem Double-click it, or run it from a command prompt:
rem
rem   build.bat            build into build\out\  (the default)
rem   build.bat run        build, then start it
rem   build.bat install    build, then install for this user, with Start menu and desktop shortcuts
rem   build.bat update     git pull, build, install again
rem   build.bat test       build, then run the tests
rem   build.bat package    a .zip of build\out in dist\
rem   build.bat uninstall  remove the installed copy and its shortcuts
rem   build.bat clean      remove build\
rem
rem Needs CMake and a C compiler: Visual Studio (or its free Build Tools) with
rem "Desktop development with C++", or MinGW-w64 gcc with Ninja.  If neither is
rem found it offers to install them with winget.  The first build downloads
rem SDL 3.2.26 (checked against its SHA-256); the result is one .exe.
rem
rem Paths are used through !delayed! expansion because Visual Studio Build
rem Tools live under "Program Files (x86)", and those brackets end an if-block.
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=build"
set "PREFIX=%LOCALAPPDATA%\Programs\topology-paint"
set "PAUSE_AT_END="
echo %CMDCMDLINE% | find /i "/c" >nul && set "PAUSE_AT_END=1"
if defined CI set "PAUSE_AT_END="

if /i "%ACTION%"=="help" goto help
if /i "%ACTION%"=="-h" goto help
if /i "%ACTION%"=="clean" goto clean
if /i "%ACTION%"=="uninstall" goto uninstall

call :find_tools
if errorlevel 1 goto fail
if /i "%ACTION%"=="update" call :update
if errorlevel 1 goto fail
call :build
if errorlevel 1 goto fail
if /i "%ACTION%"=="build" goto done
if /i "%ACTION%"=="run" goto run
if /i "%ACTION%"=="test" goto test
if /i "%ACTION%"=="package" goto package
if /i "%ACTION%"=="install" goto install
if /i "%ACTION%"=="update" goto install
echo topology paint: unknown action "%ACTION%" (try: build.bat help)
goto fail

rem ------------------------------------------------------------ tools
:find_tools
set "CMAKE="
set "GEN="
set "VSPATH="
for %%C in (cmake.exe) do set "CMAKE=%%~$PATH:C"
if not defined CMAKE if exist "%ProgramFiles%\CMake\bin\cmake.exe" set "CMAKE=%ProgramFiles%\CMake\bin\cmake.exe"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "!VSWHERE!" for /f "usebackq tokens=*" %%I in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSPATH=%%I"
if not defined CMAKE if defined VSPATH (
  set "VSCMAKE=!VSPATH!\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
  if exist "!VSCMAKE!" set "CMAKE=!VSCMAKE!"
)
if defined VSPATH (
  echo topology paint: compiler: Visual Studio in !VSPATH!
  goto have_compiler
)
where gcc >nul 2>nul
if errorlevel 1 goto no_compiler
where ninja >nul 2>nul
if not errorlevel 1 (
  set "GEN=Ninja"
  goto gcc_ok
)
where mingw32-make >nul 2>nul
if not errorlevel 1 (
  set "GEN=MinGW Makefiles"
  goto gcc_ok
)
echo topology paint: gcc was found but neither ninja nor mingw32-make; install one of them
exit /b 1
:gcc_ok
echo topology paint: compiler: gcc (MinGW), generator !GEN!
:have_compiler
if not defined CMAKE goto no_cmake
echo topology paint: cmake: !CMAKE!
exit /b 0

:no_cmake
echo topology paint: CMake was not found.
echo   Install it from https://cmake.org/download/ or with:  winget install -e --id Kitware.CMake
call :offer_winget
exit /b 1

:no_compiler
echo topology paint: no C compiler was found.  Either of these will do:
echo   Visual Studio 2022 Build Tools (free), workload "Desktop development with C++"
echo   MSYS2 or w64devkit (gcc and ninja on PATH)
call :offer_winget
exit /b 1

:offer_winget
where winget >nul 2>nul
if errorlevel 1 exit /b 0
choice /c YN /m "Install CMake and the Visual Studio Build Tools now with winget"
if errorlevel 2 exit /b 0
winget install -e --id Kitware.CMake --accept-package-agreements --accept-source-agreements
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
echo.
echo topology paint: done.  Open a NEW command prompt (so PATH is fresh) and run build.bat again.
exit /b 0

rem ------------------------------------------------------------ build
:build
if defined VSPATH (
  "!CMAKE!" -S . -B build -A x64
) else (
  "!CMAKE!" -S . -B build -G "!GEN!" -DCMAKE_BUILD_TYPE=Release
)
if errorlevel 1 (
  echo topology paint: CMake could not configure.  If build\ came from another compiler, run: build.bat clean
  exit /b 1
)
"!CMAKE!" --build build --config Release --parallel
if errorlevel 1 exit /b 1
echo topology paint: built build\out\topology-paint.exe
exit /b 0

:update
where git >nul 2>nul
if errorlevel 1 (
  echo topology paint: git not found; rebuilding what is here.  ^(winget install -e --id Git.Git^)
  exit /b 0
)
echo topology paint: fetching the latest version
git pull --ff-only
exit /b %errorlevel%

rem ------------------------------------------------------------ after the build
:run
start "" "build\out\topology-paint.exe"
goto done

:test
for %%C in ("!CMAKE!") do set "CTEST=%%~dpCctest.exe"
pushd build
"!CTEST!" --output-on-failure -C Release
set "RC=!errorlevel!"
popd
if not "!RC!"=="0" goto fail
goto done

:package
if not exist dist mkdir dist
set "ZIP=dist\topology-paint-windows-x64.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'build\out\*' -DestinationPath '!ZIP!' -Force"
if errorlevel 1 goto fail
echo topology paint: !ZIP!
goto done

:install
tasklist /fi "imagename eq topology-paint.exe" 2>nul | find /i "topology-paint.exe" >nul
if not errorlevel 1 (
  echo topology paint: it is running; close it first, then run this again
  goto fail
)
if exist "!PREFIX!.new" rmdir /s /q "!PREFIX!.new"
"!CMAKE!" --install build --config Release --prefix "!PREFIX!.new" >nul
if errorlevel 1 goto fail
if exist "!PREFIX!" rmdir /s /q "!PREFIX!"
move "!PREFIX!.new" "!PREFIX!" >nul
if errorlevel 1 goto fail
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "foreach ($d in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {" ^
  "  $s = $w.CreateShortcut((Join-Path $d 'topology paint.lnk'));" ^
  "  $s.TargetPath = '!PREFIX!\topology-paint.exe'; $s.WorkingDirectory = '!PREFIX!';" ^
  "  $s.Description = 'Paint with brushes, layers and pen pressure'; $s.Save() }"
echo topology paint: installed in !PREFIX!
echo topology paint: Start menu and desktop shortcuts made.  To update later: build.bat update
goto done

:uninstall
if exist "%PREFIX%" rmdir /s /q "%PREFIX%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "foreach ($d in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) { Remove-Item -ErrorAction SilentlyContinue (Join-Path $d 'topology paint.lnk') }"
echo topology paint: removed (settings, brushes and mods in %%APPDATA%%\inputloop\topology-paint are kept)
goto done

:clean
if exist build rmdir /s /q build
echo topology paint: removed build\
goto done

:help
echo Usage: build.bat [build ^| run ^| install ^| update ^| test ^| package ^| uninstall ^| clean]
echo.
echo   build      build into build\out\  (the default)
echo   run        build, then start it
echo   install    build, then install for this user, with Start menu and desktop shortcuts
echo   update     git pull, build, install again
echo   test       build, then run the tests
echo   package    a .zip of build\out in dist\
echo   uninstall  remove the installed copy and its shortcuts
echo   clean      remove build\
goto done

:fail
echo topology paint: FAILED
if defined PAUSE_AT_END pause
exit /b 1

:done
if defined PAUSE_AT_END pause
exit /b 0
