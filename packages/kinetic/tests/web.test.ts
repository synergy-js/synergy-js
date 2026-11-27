import { describe, expect, it } from "rstack/test"
import {
	createContext,
	createEffect,
	createSignal,
	mergeProps,
	renderToString,
	runWithOwner,
	splitProps,
	useContext,
} from "@synergy-js/kinetic"
import { jsx } from "@synergy-js/kinetic/jsx-runtime"

describe("Kinetic server rendering", () => {
	it("serializes nested markup, escaping text and attribute values", () => {
		const tree = jsx("div", {
			title: `"&<`,
			children: [
				"<text>",
				jsx("span", {children: "A & B"}),
			],
		})

		expect(renderToString(tree)).toBe(
			'<div title="&quot;&amp;&lt;">&lt;text&gt;<span>A &amp; B</span></div>',
		)
	})

	it("serializes boolean attributes, style objects, void elements, and fragments", () => {
		const tree = jsx("section", {
			hidden: true,
			disabled: false,
			style: {backgroundColor: "red", marginTop: "2px"},
			children: [
				jsx("input", {type: "text", value: "ok"}),
				jsx("br", {}),
			],
		})

		expect(renderToString(tree)).toBe(
			'<section hidden style="background-color:red;margin-top:2px;"><input type="text" value="ok"><br></section>',
		)
	})

	it("evaluates dynamic children and disposes their effects after rendering", () => {
		const [value] = createSignal("server")
		const events: string[] = []
		const html = renderToString(() => {
			createEffect(() => {
				events.push("effect")
			})
			return jsx("p", {children: () => value()})
		})

		expect(html).toBe("<p>server</p>")
		expect(events).toEqual(["effect"])
	})
})

describe("Kinetic contexts", () => {
	it("uses defaults and restores the parent value after nested providers", () => {
		const context = createContext("default")
		const values: string[] = []
		const owner = runWithOwner(() => {
			values.push(useContext(context))
			context.Provider({
				value: "outer",
				children: () => {
					values.push(useContext(context))
					context.Provider({
						value: "inner",
						children: () => values.push(useContext(context)),
					})
					values.push(useContext(context))
					return null
				},
			})
			values.push(useContext(context))
		})

		expect(values).toEqual(["default", "outer", "inner", "outer", "default"])
		owner.dispose()
	})
})

describe("Kinetic prop helpers", () => {
	it("merges props with later sources taking precedence and preserves getters", () => {
		let current = "first"
		const merged = mergeProps(
			{label: "one", get dynamic() { return current }},
			{label: "two", enabled: true},
		)

		expect(merged.label).toBe("two")
		expect(merged.enabled).toBe(true)
		expect(merged.dynamic).toBe("first")
		current = "updated"
		expect(merged.dynamic).toBe("updated")
		expect("label" in merged).toBe(true)
		expect(Object.keys(merged).sort()).toEqual(["dynamic", "enabled", "label"])
	})

	it("splits props into live getter groups and a rest object", () => {
		let value = 1
		const source = {
			id: "item",
			get value() { return value },
			disabled: true,
		}
		const [local, forwarded, rest] = splitProps(
			source,
			["id"],
			["value"],
		)

		expect(local.id).toBe("item")
		expect(forwarded.value).toBe(1)
		expect(rest.disabled).toBe(true)
		value = 2
		expect(forwarded.value).toBe(2)
	})
})
