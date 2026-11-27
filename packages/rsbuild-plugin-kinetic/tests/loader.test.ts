import { describe, expect, it } from "rstack/test"
import { parseSync } from "oxc-parser"
import kineticLoader from "../src/loader.ts"

const resourcePath = "/src/example.tsx"

interface TransformResult {
	code: string
	sourceMap: string | undefined
}

const transform = (source: string): TransformResult => {
	let result: TransformResult | undefined
	let loaderError: Error | null | undefined

	kineticLoader.call(
		{
			resourcePath,
			callback(error, code, sourceMap) {
				loaderError = error
				result = {
					code: String(code),
					sourceMap: typeof sourceMap === "string" ? sourceMap : undefined,
				}
			},
		} as never,
		source,
	)

	if(loaderError) {
		throw loaderError
	}
	if(!result) {
		throw new Error("Kinetic loader did not return transformed source")
	}

	return result
}

const expectValidTsx = (code: string): void => {
	const {errors} = parseSync(resourcePath, code, {
		sourceType: "module",
		lang: "tsx",
	})
	expect(errors).toHaveLength(0)
}

describe("Kinetic loader: native elements", () => {
	it("wraps dynamic text expressions but preserves static expressions and comments", () => {
		const {code} = transform(`
			const view = <div>{count()}{message}{42}{"literal"}{/* note */}</div>
		`)

		expectValidTsx(code)
		expect(code).toContain("{() => (count())}")
		expect(code).toContain("{() => (message)}")
		expect(code).toContain("{42}")
		expect(code).toContain('{"literal"}')
		expect(code).toContain("{/* note */}")
	})

	it("wraps dynamic attributes and leaves refs, keys, and event callbacks intact", () => {
		const {code} = transform(`
			const view = (
				<button
					ref={buttonRef}
					key={item.id}
					title={label()}
					onClick={handleClick}
					onInput={() => update(value())}
					onChange={handleChange()}
				/>
			)
		`)

		expectValidTsx(code)
		expect(code).toContain("ref={buttonRef}")
		expect(code).toContain("key={item.id}")
		expect(code).toContain("title={() => (label())}")
		expect(code).toContain("onClick={handleClick}")
		expect(code).toContain("onInput={() => update(value())}")
		expect(code).toContain("onChange={() => (handleChange())}")
	})

	it("passes accessor identifiers through for native attributes to resolve reactively", () => {
		const {code} = transform(`
			const view = <button disabled={isDisabled} value={inputValue} />
		`)

		expectValidTsx(code)
		expect(code).toContain("disabled={isDisabled}")
		expect(code).toContain("value={inputValue}")
		expect(code).not.toContain("disabled={() => (isDisabled)}")
		expect(code).not.toContain("value={() => (inputValue)}")
	})

	it("wraps dynamic expressions in fragments", () => {
		const {code} = transform(`
			const view = <>{count()}{42}{/* fragment comment */}</>
		`)

		expectValidTsx(code)
		expect(code).toContain("{() => (count())}")
		expect(code).toContain("{42}")
		expect(code).toContain("{/* fragment comment */}")
	})
})

describe("Kinetic loader: component props", () => {
	it("groups dynamic component props into getters", () => {
		const {code} = transform(`
			const view = (
				<Panel
					value={count()}
					enabled={isEnabled}
					label="static"
					callback={() => save()}
					ref={panelRef}
					key={item.id}
				/>
			)
		`)

		expectValidTsx(code)
		expect(code).toContain("__getters={{ value: () => (count()), enabled: () => (isEnabled) }}")
		expect(code).not.toContain("value={count()}")
		expect(code).not.toContain("enabled={isEnabled}")
		expect(code).toContain('label="static"')
		expect(code).toContain("callback={() => save()}")
		expect(code).toContain("ref={panelRef}")
		expect(code).toContain("key={item.id}")
	})

	it("supports member-expression component names and dynamic template props", () => {
		const {code} = transform(`
			const view = <UI.Button label={\`Count: \${count()}\`} />
		`)

		expectValidTsx(code)
		expect(code).toContain(
			"__getters={{ label: () => (`Count: ${count()}`) }}",
		)
	})
})

describe("Kinetic loader: component children", () => {
	it("wraps children lazily and keeps nested native expressions reactive", () => {
		const {code} = transform(`
			const view = (
				<Show when={value}>
					<pre>{value()}</pre>
				</Show>
			)
		`)

		expectValidTsx(code)
		expect(code).toContain("__children={() => (<>")
		expect(code).toContain("<pre>{() => (value())}</pre>")
		expect(code).toContain("</>)")
	})

	it("preserves nested lazy children", () => {
		const {code} = transform(`
			const view = (
				<Panel>
					<Show when={value}>
						<span>{value()}</span>
					</Show>
				</Panel>
			)
		`)

		expectValidTsx(code)
		expect(code.match(/__children=\{\(\) => \(<>/g)).toHaveLength(2)
		expect(code).toContain("<span>{() => (value())}</span>")
	})

	it("leaves render-prop callbacks unwrapped", () => {
		const {code} = transform(`
			const view = (
				<For each={items}>
					{(item) => <span>{item.name}</span>}
				</For>
			)
		`)

		expectValidTsx(code)
		expect(code).toContain("{(item) => <span>{() => (item.name)}</span>}")
		expect(code).not.toContain("__children=")
	})

	it("does not add lazy children for whitespace-only component bodies", () => {
		const {code} = transform(`
			const view = (
				<Panel>
				</Panel>
			)
		`)

		expectValidTsx(code)
		expect(code).not.toContain("__children=")
	})

	it("preserves multiple children and surrounding whitespace", () => {
		const {code} = transform(`
			const view = (
				<Panel>
					<span>{first()}</span>
					<span>{second()}</span>
				</Panel>
			)
		`)

		expectValidTsx(code)
		expect(code).toContain("<span>{() => (first())}</span>")
		expect(code).toContain("<span>{() => (second())}</span>")
		expect(code).toContain("__children={() => (<>")
	})
})

describe("Kinetic loader: output", () => {
	it("emits a source map with the original source", () => {
		const source = "const view = <div>{value()}</div>"
		const {code, sourceMap} = transform(source)

		expectValidTsx(code)
		expect(sourceMap).toBeTruthy()
		expect(JSON.parse(sourceMap ?? "{}").sources).toEqual(["example.tsx"])
		expect(JSON.parse(sourceMap ?? "{}").sourcesContent).toEqual([source])
	})

	it("preserves ordinary TypeScript and non-JSX code", () => {
		const source = `
			type Item = {name: string}
			const getName = (item: Item): string => item.name
		`
		const {code} = transform(source)

		expect(code).toBe(source)
	})
})
