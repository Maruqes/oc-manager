# OpenCode Agent Manager

Desktop app for managing OpenCode agents.

## Build The Executable

```bash
make executable
```

This builds the app and creates:

```bash
./bin/opencode-agent-manager
```

Run the app with:

```bash
./bin/opencode-agent-manager
```

## Install The OpenCode Loader

```bash
make install-oc
```

This installs a global OpenCode plugin that loads every JSON workflow in:

```bash
~/.config/opencode/workflows/*.json
```

Restart OpenCode after running this command so the agents appear.
