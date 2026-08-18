# Free-form subject contract v1

C0/C1 output is one plain JavaScript ES module in `/input/subject.mjs`. It exports one default `build(THREE)` function and returns a static exact `Object3D`, `Group`, or `Mesh` tree. The adapter uses Three.js `0.185.1` and emits one `renderable-v0` document.

The subject container has no network, no repository mount, a read-only root filesystem, dropped capabilities, bounded CPU/memory/PIDs, and no inherited host secrets. Only an isolated temporary output mount is writable. The host kills the container at the fixed timeout. The trusted evaluator receives only the serialized renderable document.
