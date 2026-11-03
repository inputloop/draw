# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
#
# topology paint -- build with build.bat (Windows) or build.sh (Linux, macOS);
# they call this.  By hand:
#   cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
#   cmake --build build --config Release
# The program lands in build/out/ with its brushes/, palettes/ and mods/.
cmake_minimum_required(VERSION 3.16)
project(topology_paint VERSION 1.0.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release)
endif()
# one .exe that needs no runtime DLLs beside it
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

option(TPAINT_SYSTEM_SDL "Use an SDL3 that is already installed instead of fetching it" OFF)
set(TPAINT_SDL_SOURCE "" CACHE PATH "An unpacked SDL3 source tree to use instead of downloading one")

# ---- SDL3: the window, the GPU, and above all the pen
if(TPAINT_SYSTEM_SDL)
  find_package(SDL3 3.2 REQUIRED CONFIG)
  set(TPAINT_SDL SDL3::SDL3)
else()
  include(FetchContent)
  set(SDL_SHARED OFF CACHE BOOL "" FORCE)
  set(SDL_STATIC ON CACHE BOOL "" FORCE)
  set(SDL_TEST_LIBRARY OFF CACHE BOOL "" FORCE)
  set(SDL_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(SDL_TESTS OFF CACHE BOOL "" FORCE)
  set(SDL_INSTALL OFF CACHE BOOL "" FORCE)
  if(TPAINT_SDL_SOURCE)
    set(FETCHCONTENT_SOURCE_DIR_SDL3 "${TPAINT_SDL_SOURCE}" CACHE PATH "" FORCE)
  endif()
  FetchContent_Declare(SDL3
    URL https://github.com/libsdl-org/SDL/releases/download/release-3.2.26/SDL3-3.2.26.tar.gz
    URL_HASH SHA256=dad488474a51a0b01d547cd2834893d6299328d2e30f479a3564088b5476bae2)
  FetchContent_MakeAvailable(SDL3)
  set(TPAINT_SDL SDL3::SDL3-static)
endif()

set(OUT "${CMAKE_BINARY_DIR}/out")
set(WARN "")
if(CMAKE_C_COMPILER_ID MATCHES "GNU|Clang")
  set(WARN -Wall -Wno-misleading-indentation -Wno-format-truncation -Wno-unknown-warning-option)
  if(CMAKE_C_COMPILER_ID STREQUAL "GNU")
    list(REMOVE_ITEM WARN -Wno-unknown-warning-option)
  endif()
endif()

# ---- the core: no SDL, so tests and other front ends can use it
file(GLOB CORE_SRC CONFIGURE_DEPENDS src/core/*.c)
add_library(tpaint_core STATIC ${CORE_SRC})
target_include_directories(tpaint_core PUBLIC include src/core)
target_compile_options(tpaint_core PRIVATE ${WARN})
if(MSVC)
  target_compile_definitions(tpaint_core PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()
if(UNIX)
  target_link_libraries(tpaint_core PUBLIC m ${CMAKE_DL_LIBS})
endif()

# ---- the program
file(GLOB APP_SRC CONFIGURE_DEPENDS src/app/*.c)
add_executable(topology-paint WIN32 MACOSX_BUNDLE ${APP_SRC})
target_link_libraries(topology-paint PRIVATE tpaint_core ${TPAINT_SDL})
target_compile_options(topology-paint PRIVATE ${WARN})
if(MSVC)
  target_compile_definitions(topology-paint PRIVATE _CRT_SECURE_NO_WARNINGS)
elseif(WIN32)
  target_link_options(topology-paint PRIVATE -static -static-libgcc)
endif()
set_target_properties(topology-paint PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "$<1:${OUT}>"
  MACOSX_BUNDLE_BUNDLE_NAME "topology paint"
  MACOSX_BUNDLE_GUI_IDENTIFIER "st.bru.inputloop.topology-paint"
  MACOSX_BUNDLE_SHORT_VERSION_STRING "${PROJECT_VERSION}")

# brushes and palettes sit beside the program (inside the .app on macOS)
if(APPLE)
  set(DATA_DIR "$<TARGET_BUNDLE_CONTENT_DIR:topology-paint>/Resources")
else()
  set(DATA_DIR "${OUT}")
endif()
add_custom_command(TARGET topology-paint POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_SOURCE_DIR}/brushes" "${DATA_DIR}/brushes"
  COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_SOURCE_DIR}/palettes" "${DATA_DIR}/palettes")

# ---- the example mods, each a shared library in mods/
set(MODS posterize:posterize pgm-export:pgm_export star-tip:star_tip)
foreach(m ${MODS})
  string(REPLACE ":" ";" parts ${m})
  list(GET parts 0 dir)
  list(GET parts 1 src)
  add_library(${dir} MODULE mods/${dir}/${src}.c)
  target_include_directories(${dir} PRIVATE include)
  if(UNIX)
    target_link_libraries(${dir} PRIVATE m)
  endif()
  set_target_properties(${dir} PROPERTIES PREFIX ""
    LIBRARY_OUTPUT_DIRECTORY "$<1:${OUT}/mods>" RUNTIME_OUTPUT_DIRECTORY "$<1:${OUT}/mods>"
    C_VISIBILITY_PRESET hidden)
  if(APPLE)
    set_target_properties(${dir} PROPERTIES SUFFIX ".dylib")
    add_custom_command(TARGET ${dir} POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E make_directory "${DATA_DIR}/mods"
      COMMAND ${CMAKE_COMMAND} -E copy "$<TARGET_FILE:${dir}>" "${DATA_DIR}/mods/")
    add_dependencies(${dir} topology-paint)
  endif()
  if(MINGW)
    target_link_options(${dir} PRIVATE -static-libgcc)
  endif()
endforeach()

# ---- the tests (also run without CMake by tests/run.sh)
enable_testing()
add_executable(tpaint_tests tests/test_core.c)
target_link_libraries(tpaint_tests PRIVATE tpaint_core)
if(WIN32)
  target_link_libraries(tpaint_tests PRIVATE shell32)
endif()
add_test(NAME core COMMAND tpaint_tests "${CMAKE_BINARY_DIR}" "${OUT}/mods")

# ---- install: everything into one folder (build.bat / build.sh pick it)
install(TARGETS topology-paint RUNTIME DESTINATION . BUNDLE DESTINATION .)
if(NOT APPLE)
  install(DIRECTORY brushes palettes DESTINATION .)
  foreach(m ${MODS})
    string(REPLACE ":" ";" parts ${m})
    list(GET parts 0 dir)
    install(TARGETS ${dir} LIBRARY DESTINATION mods RUNTIME DESTINATION mods)
  endforeach()
endif()
install(FILES README.md docs/MODDING.md docs/LESSONS-LEARNED.md DESTINATION docs)
install(FILES include/tpaint_mod.h DESTINATION sdk)
