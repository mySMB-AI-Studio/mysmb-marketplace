"""A small fake of the automation `api` object, enough to run these extensions' nodes in CPython.

Unknown calls return an empty result and are recorded, so a node can run end to end and a
test can assert on what it tried to do. This is not the Pyodide sandbox: it proves the
practice-time and reviewer logic, not the connectors.
"""
import json
import pathlib
import sys

KIT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KIT))

from kit import PLUGINS, ROOT, component_files, load  # noqa: E402


class _Namespace:
    def __init__(self, api, ns):
        self._api, self._ns = api, ns

    def __getattr__(self, method):
        def call(*args, **kwargs):
            if args:
                raise TypeError("api methods are keyword-only: api.%s.%s" % (self._ns, method))
            self._api.calls.append((self._ns + "." + method, kwargs))
            handler = self._api.handlers.get(self._ns + "." + method)
            return handler(**kwargs) if handler else self._api.default(self._ns + "." + method)
        return call


class FakeApi:
    def __init__(self, files=None, users=None, groups=None):
        self.files_store = dict(files or {})
        self.users_list = list(users or [])
        self.groups_list = list(groups or [])
        self.calls = []
        self.handlers = {
            "files.read": self._read,
            "files.get": self._read,
            "files.list": self._list,
            "files.put": self._put,
            "users.list": lambda **_: list(self.users_list),
            "groups.list": lambda **_: list(self.groups_list),
            "workq.create": self._create,
        }

    def __getattr__(self, ns):
        if ns.startswith("_"):
            raise AttributeError(ns)
        return _Namespace(self, ns)

    def default(self, name):
        if name.endswith(".list"):
            return []
        if name == "ai.generate":
            return "{}"
        return {}

    def _read(self, file, **_):
        if file not in self.files_store:
            raise FileNotFoundError(file)
        value = self.files_store[file]
        return value if isinstance(value, str) else json.dumps(value)

    def _list(self, path, **_):
        prefix = path.rstrip("/") + "/"
        return [{"name": k[len(prefix):]} for k in sorted(self.files_store) if k.startswith(prefix) and "/" not in k[len(prefix):]]

    def _put(self, file, content, **_):
        self.files_store[file] = content
        return {}

    def _create(self, **kwargs):
        return {"id": "todo-%d" % len([c for c in self.calls if c[0] == "workq.create"])}

    def calls_to(self, name):
        return [kw for (n, kw) in self.calls if n == name]


def automation(plugin, prefix):
    for path in component_files(plugin):
        if path.name.startswith(prefix) and "/automations/" in str(path).replace("\\", "/"):
            return load(path)[0]
    raise KeyError(prefix)


def node(payload, node_id):
    return next(n for n in payload["flowIr"]["nodes"] if n["id"] == node_id)


def run_node(code, api, params=None, trigger=None):
    ns = {"api": api, "params": dict(params or {}), "trigger": dict(trigger or {}), "__name__": "__node__"}
    exec(compile(code, "<node>", "exec"), ns)  # noqa: S102 — test harness only
    return ns


def eval_cond(cond, steps):
    return eval(cond, {"steps": steps, "trigger": {}, "params": {}})  # noqa: S307 — test harness only


def tick(iso):
    return {"kind": "schedule", "fired_at": iso}
