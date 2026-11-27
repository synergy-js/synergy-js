# Build a single package: `just build verdict`
build pkg:
    cd packages/{{ pkg }} && bun --bun rs lib && pnpm i

# Test a single package: `just test httpx`
test pkg:
    cd packages/{{ pkg }} && bun --bun rs test

# Delete dist in one package (or all): `just clean verdict`
clean-dist pkg:
    rm -rf packages/{{ pkg }}/dist

# Delete node_modules in one package (or all):
clean-node_modules pkg:
    rm -rf packages/{{ pkg }}/node_modules

install:
    pnpm i

install-global-dev-dep-from-catalog pkg:
    pnpm -r add -d {{ pkg }}@catalog:

install-workspace-pkg-from-catalog pkg dep:
    pnpm --filter "./packages/{{ pkg }}" add {{ dep }}@catalog:

clean-all:
    rm -rf packages/*/dist && rm -rf packages/*/node_modules

publish-local pkg registry:
    cd packages/{{ pkg }} pnpm publish --registry {{ registry }}

unpublish-local pkg registry:
    cd packages/{{ pkg }} pnpm unpublish --registry {{ registry }}

publish-npm pkg:
    cd packages/{{ pkg }} pnpm publish

# Build, test, and publish to Nexus without any .npmrc file
pub pkg: (build pkg) (test pkg)
    npm_config_//registry.mpaynesecurity.net/:_authToken=$NEXUS_NPM_TOKEN \
    pnpm --filter ./packages/{{ pkg }} publish --registry https://mpaynesecurity.net --no-git-checks
