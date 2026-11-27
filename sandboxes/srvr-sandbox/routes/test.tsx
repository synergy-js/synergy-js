import { renderToString } from "@synergy-js/jsxr"
import { Get, Route } from "@synergy-js/srvr"

@Route("test")
export class TestController {
	@Get("/")
	testPage() {
		return (
			<div>
				<button type={"button"} onClick={() => alert("hi")}>Hi</button>
			</div>
		)
	}
}