// import { resolve } from "node:path"
// import { ViteDevServer } from "vite"
// import { nodeToWcgRequest, wcgToNodeResponse } from "../../common/middleware.ts"
// import { useDevServerFnHandler } from "../../common/utils.ts"
//
// export const interceptDevServer = (server: ViteDevServer) => {
// 	server.middlewares.use(async (req, res, next) => {
// 		const {url} = req
// 		if(!url) {
// 			return next()
// 		}
//
// 		// Clean Vite's query parameters immediately
// 		const [pathname, queryString] = url.split("?")
// 		if(pathname !== "/fusion/rpc") return next()
//
// 		try {
// 			const webRequest = nodeToWcgRequest(req)
// 			const searchParams = new URLSearchParams(queryString)
// 			const filePath = searchParams.get("file")
// 			const targetMethod = searchParams.get("method")
//
// 			// Resolve absolute paths against Vite's config root
// 			const absolutePath = resolve(server.config.root, filePath)
//
// 			const webResponse = await useDevServerFnHandler(webRequest, absolutePath, targetMethod)
// 			await wcgToNodeResponse(webResponse, res)
// 		}
// 		catch {
// 			next()
// 		}
// 	})
// }
