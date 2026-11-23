import { inject } from "@synergy-js/infusion"
import { Get, Route } from "@synergy-js/srvr"
import { UserService } from "../services"
import { TEST_CONFIG } from "../services/UserService.ts"


@Route("users", {interceptors: [], providers: [UserService]})
export class UsersController {
	@Get("/")
	findAll() {
		const userService = inject(TEST_CONFIG)
		const users = userService.users
		
		return Response.json({
			id: users[0].id,
			name: users[0].name,
		})
	}
	
	@Get("/:id")
	byId(id: string) {
		const userService = inject(UserService)
		const users = userService.getUsers()
		const userId = id
		
		return users.find((u) => String(u.id) === String(userId))
	}
	
	@Get("/search")
	search(request: Request): Response {
		const params = new URL(request.url).searchParams
		return Response.json({
			q: params.get("q"),
			tags: params.getAll("tag"),
		})
	}
}
