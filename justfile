set shell := ["zsh", "-cu"]

# Build a single packag
build pkg:
    cd packages/{{ pkg }} && pnpm --filter {{ pkg }} build && pnpm i

build-sandbox pkg:
    cd sandboxes/{{ pkg }} && pnpm --filter {{ pkg }} build

# Run the kinetic build pipeline
#build-kinetic:
#    pnpm --filter signals build && pnpm --filter kinetic build && pnpm --filter rsbuild-plugin-kinetic build

# Delete the folder and node_modules folders in all packages
clean-all:
    rm -rf packages/*/dist && rm -rf packages/*/node_modules

# Delete the dist folder in one package
clean-dist pkg:
    rm -rf packages/{{ pkg }}/dist

# Delete node_modules in one package
clean-node_modules pkg:
    rm -rf packages/{{ pkg }}/node_modules

install-global-dev-dep-from-catalog pkg:
    pnpm -r add -d {{ pkg }}@catalog:

install-workspace-pkg-from-catalog pkg dep:
    pnpm --filter "./packages/{{ pkg }}" add {{ dep }}@catalog:

# Publish to local NPM registry
publish-local pkg registry:
    cd packages/{{ pkg }} pnpm publish --registry {{ registry }}

# Pre-seed NPM trusted publishing for one package
setup-trusted-publishing pkg:
    pnpm login && cd packages/{{ pkg }} && pnpm dlx setup-npm-trusted-publish @synergy-js/{{ pkg }}

# Run a single sandbox
sandbox pkg:
    pnpm --filter {{ pkg }} dev

# Test a single package
test pkg:
    cd packages/{{ pkg }} && bun --bun rs test

# Unpublish from local NPM registry
unpublish-local pkg registry:
    cd packages/{{ pkg }} pnpm unpublish --registry {{ registry }}

kinetic-build:
    cd packages/kinetic && pnpm build && pnpm i

kinetic-plugin-build:
    cd packages/rsbuild-plugin-kinetic && pnpm build && pnpm i

kinetic-test:
    cd packages/kinetic && bun --bun rs test
