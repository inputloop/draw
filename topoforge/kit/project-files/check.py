# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
"""check.py -- hold bin/*.sh to kit/project-files/SPEC.org.

Run: PYTHONDONTWRITEBYTECODE=1 python3 -I kit/project-files/check.py
Exit 0 all rules hold, 1 a rule is broken, 2 the kit is broken.
Standard library only; writes only in a temporary folder."""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPSTREAM_SHA = "6a76e9ca66e6a2733a35677c11599114b4009529568580526d90427fa08a9e2a"
LINE = re.compile(r"^([0-9a-f]{64})  (.+)$")


def sh(args, cwd):
    p = subprocess.run(["sh"] + args, cwd=cwd, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE)
    return p.returncode, p.stdout.decode("utf-8", "replace")


def tangle_py(org_text):
    """SPEC T1, read independently of bin/tangle.sh. Returns {path: bytes}."""
    out, cur, body = {}, None, None
    for line in org_text.split("\n"):
        low = line.lower()
        if cur is None and body is None and re.match(r"#\+begin_src[ \t]", low):
            m = re.search(r":tangle[ \t]+([^ \t]+)", line)
            s = re.search(r':shebang[ \t]+"([^"]*)"', line)
            path = m.group(1) if m else ""
            body = []
            cur = path if path not in ("", "no") else ""
            if cur and s:
                body.append(s.group(1))
            continue
        if body is not None and re.match(r"#\+end_src", low):
            if cur:
                out[cur] = "".join(x + "\n" for x in body).encode()
            cur, body = None, None
            continue
        if body is not None:
            if line.startswith(",*") or line.startswith(",#+"):
                line = line[1:]
            body.append(line)
    return out


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def tree(tmp, recipe=None, sums=None):
    """A small project tree in tmp: bin/ scripts, a fake upstream, a few files."""
    os.makedirs(os.path.join(tmp, "bin"))
    os.makedirs(os.path.join(tmp, "upstream"))
    for n in ("sums.sh", "verify.sh", "tangle.sh"):
        shutil.copy(os.path.join(ROOT, "bin", n), os.path.join(tmp, "bin", n))
    if sums is not None:
        with open(os.path.join(tmp, "bin", "sums.sh"), "w") as f:
            f.write(sums)
    shutil.copy(os.path.join(ROOT, "upstream", "topoforge-1.5.html"),
                os.path.join(tmp, "upstream", "topoforge-1.5.html"))
    for name, data in (("b file.txt", b"two words\n"), ("a.txt", b"a\n"),
                       ("Z.txt", b"capital\n")):
        with open(os.path.join(tmp, name), "wb") as f:
            f.write(data)
    shutil.copy(recipe or os.path.join(ROOT, "RECIPE.org"), os.path.join(tmp, "RECIPE.org"))


def rules_tangle(tmp):
    bad = []
    with open(os.path.join(tmp, "RECIPE.org"), encoding="utf-8") as f:
        want = tangle_py(f.read())
    if not want:
        bad.append("T2 no tangled blocks found in RECIPE.org")
    out = os.path.join(tmp, "tangled")
    os.makedirs(out)
    rc, _ = sh([os.path.join(tmp, "bin", "tangle.sh"), "-d", out,
                os.path.join(tmp, "RECIPE.org")], tmp)
    if rc != 0:
        bad.append("T2 tangle.sh exit %d" % rc)
    for path, data in sorted(want.items()):
        got = os.path.join(out, path)
        if not os.path.isfile(got) or open(got, "rb").read() != data:
            bad.append("T2 tangle.sh and the second reader differ on " + path)
        committed = os.path.join(ROOT, path)
        if not os.path.isfile(committed) or open(committed, "rb").read() != data:
            bad.append("T3 committed %s differs from RECIPE.org" % path)
    for name, org in (("absolute", "#+begin_src sh :tangle /x\nx\n#+end_src\n"),
                      ("dotdot", "#+begin_src sh :tangle a/../x\nx\n#+end_src\n"),
                      ("twice", "#+begin_src sh :tangle x\n1\n#+end_src\n"
                                "#+begin_src sh :tangle x\n2\n#+end_src\n")):
        p = os.path.join(tmp, "t4-%s.org" % name)
        with open(p, "w") as f:
            f.write(org)
        d = os.path.join(tmp, "t4-" + name)
        os.makedirs(d)
        rc, _ = sh([os.path.join(tmp, "bin", "tangle.sh"), "-d", d, p], tmp)
        if rc != 2:
            bad.append("T4 %s path: exit %d, want 2" % (name, rc))
    return bad


def rules_sums(tmp):
    bad = []
    s = os.path.join(tmp, "bin", "sums.sh")
    files = ["b file.txt", "a.txt", "Z.txt", "a.txt", "SHA256SUMS"]
    rc, _ = sh([s] + files, tmp)
    out = os.path.join(tmp, "SHA256SUMS")
    if rc != 0 or not os.path.isfile(out):
        return ["S1 sums.sh exit %d, no SHA256SUMS" % rc]
    lines = open(out, encoding="utf-8").read().split("\n")
    if lines[-1] == "":
        lines.pop()
    paths = []
    for ln in lines:
        m = LINE.match(ln)
        if not m:
            bad.append("S1 bad line: %r" % ln)
            continue
        if m.group(1) != sha(os.path.join(tmp, m.group(2))):
            bad.append("S1 wrong digest for " + m.group(2))
        paths.append(m.group(2))
    want = sorted(set(f for f in files if f != "SHA256SUMS"), key=lambda x: x.encode())
    if paths != want:
        bad.append("S2 paths %r, want %r" % (paths, want))
    before = open(out, "rb").read()
    rc, _ = sh([s, "a.txt", "no-such-file"], tmp)
    if rc != 1 or open(out, "rb").read() != before:
        bad.append("S3 missing file: exit %d, or SHA256SUMS changed" % rc)
    rc, _ = sh([s, "--check"], tmp)
    if rc != 0:
        bad.append("S4 clean --check exit %d" % rc)
    with open(os.path.join(tmp, "a.txt"), "ab") as f:
        f.write(b"x")
    rc, _ = sh([s, "--check"], tmp)
    if rc != 1:
        bad.append("S4 changed file: --check exit %d, want 1" % rc)
    return bad


def rules_verify(tmp, flip=False):
    up = os.path.join(tmp, "upstream", "topoforge-1.5.html")
    if flip:
        data = bytearray(open(up, "rb").read())
        data[100] ^= 1
        open(up, "wb").write(bytes(data))
    want = 1 if flip else 0
    if not flip and sha(up) != UPSTREAM_SHA:
        return ["V1 upstream in this tree is not v1.5 (%s)" % sha(up)]
    rc, _ = sh([os.path.join(tmp, "bin", "verify.sh")], tmp)
    return [] if rc == want else ["V1 verify.sh exit %d, want %d" % (rc, want)]


def run(fn, **kw):
    with tempfile.TemporaryDirectory() as tmp:
        tree(tmp, kw.pop("recipe", None), kw.pop("sums", None))
        return fn(tmp, **kw)


def main():
    try:
        sums_src = open(os.path.join(ROOT, "bin", "sums.sh")).read()
        recipe_src = open(os.path.join(ROOT, "RECIPE.org")).read()
        bad = run(rules_tangle) + run(rules_sums) + run(rules_verify)
        for b in bad:
            print("RED   " + b)
        # prove red: each planted fault must be seen
        planted = []
        if "sort -u" not in sums_src or "sha256sum --" not in sums_src:
            print("KIT BROKEN: cannot plant faults in sums.sh")
            return 2
        planted.append(("R1 sort removed", run(rules_sums, sums=sums_src.replace("sort -u", "cat"))))
        planted.append(("R2 md5sum", run(rules_sums, sums=sums_src.replace("sha256sum --", "md5sum --"))))
        with tempfile.TemporaryDirectory() as t:
            r = os.path.join(t, "RECIPE.org")
            with open(r, "w") as f:
                f.write(recipe_src.replace("exit $rc\n#+end_src", "exit 0\n#+end_src", 1))
            planted.append(("R3 recipe drift", run(rules_tangle, recipe=r)))
        planted.append(("R4 upstream byte", run(rules_verify, flip=True)))
    except Exception as e:  # the kit could not run
        print("KIT BROKEN: %s: %s" % (type(e).__name__, e))
        return 2
    broken = False
    for name, found in planted:
        if (name.startswith("R4") and found) or (not name.startswith("R4") and not found):
            print("KIT BROKEN: planted fault not seen: " + name)
            broken = True
        else:
            print("ok    prove-red " + name)
    if broken:
        return 2
    if bad:
        print("RED   %d rule(s) broken" % len(bad))
        return 1
    print("GREEN tangle, sums, verify; 4 planted faults all seen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
