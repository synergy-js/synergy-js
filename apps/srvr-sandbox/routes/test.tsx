import { Get, Route } from "@synergy-js/srvr"

@Route("test")
export class TestController {
	@Get("/")
	testPage() {
		return (
			<div>
				<p data-id="test">HI!</p>
				<button
					onClick={() => alert("hi")}
					type={"button"}
					className="bg-indigo-600 px-2 py-3"
				>
					Increment
				</button>
			</div>
		)
	}
}
