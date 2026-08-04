import re, os, sys, json

# Comments are NOT user-facing. This codebase is heavily commented and a prior
# pass had a test match its own explanatory prose, so strip comments FIRST.
def strip_comments(src):
    out, i, n = [], 0, len(src)
    while i < n:
        if src.startswith("//", i):
            j = src.find("\n", i); i = n if j < 0 else j
        elif src.startswith("/*", i):
            j = src.find("*/", i+2); i = n if j < 0 else j+2
        else:
            out.append(src[i]); i += 1
    return "".join(out)

BANNED = ["delve","foster","leverage","utilize","facilitate","empower","streamline",
 "robust","cutting-edge","paradigm shift","game changer","this is huge","tapestry",
 "realm","beacon","multifaceted","meticulous","intricate","paramount","transformative",
 "elevate","embark","supercharge","harness","ever-evolving","unlock","unleash","seamless",
 "journey","dive in","navigate the","holistic","curated","empowering","effortless"]
PHRASES = ["it's worth noting","it is worth noting","important to note","at the end of the day",
 "when it comes to","at its core","in today's world","in the age of","in the world of",
 "the reality is","the truth is","in terms of","going forward","let's dive"]
FAUX = [r"\bhere'?s the thing\b", r"\blet me be clear\b", r"\bi'?ll be honest\b",
 r"what most people get wrong", r"nobody tells you", r"everyone misses",
 r"the part most people", r"what if i told you", r"think about it:"]
BINARY = [r"\bit'?s not (just )?[a-z].{0,40}?[,.] it'?s\b", r"\bthe question isn'?t\b",
 r"\bnot (just )?about .{0,30}[,.] (it'?s|but) \b"]
PUFF = [r"stands as a testament", r"pivotal moment", r"plays a vital role",
 r"solidifies its", r"underscores? (its|the)", r"a testament to"]
ING = [r", (highlighting|underscoring|reflecting|showcasing|emphasizing|signaling) "]
WEASEL = [r"\bexperts agree\b", r"\bstudies show\b", r"\bwidely regarded\b", r"\bmany argue\b",
 r"\bresearch suggests\b"]

CHECKS = [("banned-word", [re.escape(w) for w in BANNED]),
          ("empty-phrase", [re.escape(p) for p in PHRASES]),
          ("faux-insight", FAUX), ("binary-contrast", BINARY),
          ("importance-puffery", PUFF), ("superficial-analysis", ING),
          ("weasel-attribution", WEASEL)]

# String literals + JSX text nodes.
LIT = re.compile(r'"([^"\\\n]{8,200})"|\'([^\'\\\n]{8,200})\'|`([^`\\]{8,300})`')
JSXTEXT = re.compile(r'>\s*([A-Za-z][^<>{}\n]{10,200}?)\s*<')

def looks_like_copy(s):
    s = s.strip()
    if not s or len(s) < 8: return False
    if re.match(r'^[\w.@/-]+$', s): return False            # ids, paths, imports
    if re.search(r'^(https?:|\.\/|@\/|[a-z-]+\/[a-z-]+$)', s): return False
    if re.search(r'[{};<>]|=>|px |rgba?\(|var\(--|#[0-9a-fA-F]{3,8}\b', s): return False
    if not re.search(r'[a-z]{3}\s+[a-z]{2}', s): return False  # needs real prose
    return True

findings = []
for root, dirs, files in os.walk("artifacts/tides/src"):
    dirs[:] = [d for d in dirs if d != "node_modules"]
    for f in files:
        if not f.endswith((".ts",".tsx")): continue
        path = os.path.join(root,f)
        src = strip_comments(open(path, encoding="utf8").read())
        lines = src.split("\n")
        for ln, line in enumerate(lines, 1):
            cands = []
            for m in LIT.finditer(line):
                cands.append(next(g for g in m.groups() if g is not None))
            for m in JSXTEXT.finditer(line):
                cands.append(m.group(1))
            for c in cands:
                if not looks_like_copy(c): continue
                low = c.lower()
                for name, pats in CHECKS:
                    for p in pats:
                        if re.search(r'\b'+p+r'\b' if name=="banned-word" else p, low):
                            findings.append((name, path, ln, c.strip()))
                            break
                    else: continue
                    break

seen=set(); uniq=[]
for x in findings:
    k=(x[0],x[3])
    if k in seen: continue
    seen.add(k); uniq.append(x)
from collections import Counter
print("TOTAL:", len(uniq))
print(Counter(x[0] for x in uniq).most_common())
print()
for name,path,ln,txt in sorted(uniq):
    print(f"[{name}] {path}:{ln}\n    {txt}\n")
