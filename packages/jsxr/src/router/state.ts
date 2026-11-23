import { createSignal } from "@synergy-js/signals"
import type { JSXRenderNode } from "../web"
import type { RouteData, RouteParams } from "./types"

// export const [currentPath, setCurrentPath] = createSignal(window.location.pathname)
// export const [params, setParams] = createSignal<RouteParams>({})
//
// export const outletStack: Array<() => JSXRenderNode> = []
// export const dataStack: Array<RouteData | null> = []

const pathSignal = createSignal<string>(window.location.pathname)
export const currentPath: () => string = pathSignal[0]
export const setCurrentPath: (value: string) => void = pathSignal[1]

const paramsSignal = createSignal<RouteParams>({})
export const params: () => RouteParams = paramsSignal[0]
export const setParams: (value: RouteParams) => void = paramsSignal[1]

export const outletStack: Array<() => JSXRenderNode> = []
export const dataStack: Array<RouteData | null> = []