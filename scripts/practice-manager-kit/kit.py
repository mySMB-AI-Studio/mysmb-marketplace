"""Shared helpers for the Cliniko Automations and Healthcare Practice Management extensions.

Both extensions are hand-authored JSON (no generator), so the Python helpers every
practice-aware node needs are kept here once and copied into each node between
`# >>> name` / `# <<< name` markers. `python sync.py` rewrites every copy from the
canonical file and refreshes each component's contentHash; the tests fail when a
copy has drifted.
"""
import hashlib
import json
import pathlib
import re

KIT = pathlib.Path(__file__).resolve().parent
ROOT = KIT.parent.parent
PLUGINS = ("cliniko-automations", "healthcare-practice-management")
BLOCKS = {
    "practice-clock": KIT / "practice_clock.py",
    "practice-reviewer": KIT / "practice_reviewer.py",
}


def block_text(name):
    return BLOCKS[name].read_text(encoding="utf-8").rstrip("\n")


def block_re(name):
    return re.compile(r"# >>> " + re.escape(name) + r"\b.*?# <<< " + re.escape(name), re.S)


def content_hash(payload):
    rest = {k: v for k, v in payload.items() if k != "contentHash"}
    canon = json.dumps(rest, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def component_files(plugin):
    base = ROOT / "plugins" / plugin / "content"
    return sorted(base.glob("automations/*.json")) + sorted(base.glob("forms/*.json"))


def load(path):
    raw = path.read_text(encoding="utf-8")
    indent = 1 if raw.startswith("{\n \"") else 2
    return json.loads(raw), {"indent": indent, "newline": raw.endswith("\n")}


def save(path, payload, fmt):
    payload["contentHash"] = content_hash(payload)
    text = json.dumps(payload, indent=fmt["indent"], ensure_ascii=False)
    path.write_text(text + ("\n" if fmt["newline"] else ""), encoding="utf-8")


def python_nodes(payload):
    return [n for n in (payload.get("flowIr") or {}).get("nodes", []) if n.get("kind") == "python"]


def sync_code(code):
    for name in BLOCKS:
        code = block_re(name).sub(lambda _m, n=name: block_text(n), code)
    return code
