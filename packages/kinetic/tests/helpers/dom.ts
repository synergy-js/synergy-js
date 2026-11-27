import { mount } from "@synergy-js/kinetic"

type MountedApp = Parameters<typeof mount>[0]

export interface MountedTestApp {
	root: HTMLDivElement
	dispose: () => void
}

export const mountTestApp = (app: MountedApp): MountedTestApp => {
	const root = document.createElement("div")
	document.body.appendChild(root)
	const dispose = mount(app, root)

	return {
		root,
		dispose: () => {
			dispose()
			root.remove()
		},
	}
}
