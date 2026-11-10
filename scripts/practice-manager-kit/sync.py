"""Rewrite every marked helper copy from its canonical file and refresh contentHash.

Run from anywhere: `python scripts/practice-manager-kit/sync.py`. Prints the files it changed.
"""
from kit import PLUGINS, component_files, content_hash, load, python_nodes, save, sync_code

changed = []
for plugin in PLUGINS:
    for path in component_files(plugin):
        payload, fmt = load(path)
        before = path.read_text(encoding="utf-8")
        for node in python_nodes(payload):
            node["code"] = sync_code(node["code"])
        save(path, payload, fmt)
        if path.read_text(encoding="utf-8") != before:
            changed.append(str(path))
print("\n".join(changed) or "nothing to change")
