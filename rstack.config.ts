import { define } from "rstack"

define.test({})

define.lint(({js, ts}) => [js.configs.recommended, ts.configs.recommended])

define.fmt({
	sortPackageJson: true,
	ignorePatterns: ["dist/**", "coverage/**"],
	overrides: [
		{
			files: ["*.js", "*.ts"],
			options: {
				semi: false,
				tabWidth: 4,
				singleQuote: false,
			},
		},
		{
			files: ["*.json", ".jsonc"],
			options: {
				tabWidth: 4,
			},
		},
	],
})
