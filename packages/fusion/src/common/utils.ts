import { parseSync, Visitor, type Program } from "oxc-parser"
import { randomBytes } from "node:crypto"
import type { FusionServerFunctionMetadata, ServerModule } from "./types.ts"

/**
 * Generate a unique id (hash) for each rfunction
 * @returns {string}
 * @param length
 */
export const generateHash = (length: number): string => {
	return randomBytes(length)
		.toString("base64")
		.replace("/", "_")
		.replace("+", "-")
}

/**
 * @privateRemarks
 * We intercept files ending with .server.ts, completely strip its server-side execution code,
 * replace it with client-side fetch stubs so the browser doesn't break,
 * and replace them with client-side fetch stubs. Development requests include the source
 * path, while production associates function IDs with their modules in Rspack build metadata.
 * @param fileName
 * @param {string} code
 * @returns {{exportedFns: string[], result: Program}}
 *
 */
export const parseFns = (fileName: string, code: string): {exportedFns: string[], result: Program} => {
	
	const parseResult = parseSync(fileName, code, {
		sourceType: "module",
		lang: "ts", // Tells OXC to parse TypeScript syntax
	})
	
	const programAst = parseResult.program
	const exportedFns: string[] = []
	
	const visitor = new Visitor(({
		ExportNamedDeclaration(node) {
			const decl = node.declaration
			
			if(!decl) {
				return
			}
			// Extract function names from exports (e.g. export function myFn()
			if(decl.type === "FunctionDeclaration" && decl.id) {
				exportedFns.push(decl.id.name)
			}
			// Extract variable names from exports (e.g. export const myFn = ...)
			if(decl.type === "VariableDeclaration") {
				for(const declItem of decl.declarations) {
					if(declItem.id && declItem.id.type === "Identifier") {
						exportedFns.push(declItem.id.name)
					}
				}
			}
		},
	}))
	visitor.visit(programAst)
	
	return {
		exportedFns,
		result: programAst,
	}
	
	
}

export const parseServerFunctionStubs = (
	sourcePath: string,
	code: string,
): FusionServerFunctionMetadata[] => {
	const functions: FusionServerFunctionMetadata[] = []
	const rpcUrlPattern = /\/fusion\/rpc\?id=([^&"\\]+)&method=([^"\\]+)/g

	for(const match of code.matchAll(rpcUrlPattern)) {
		functions.push({id: match[1]!, method: match[2]!, sourcePath})
	}

	return functions
}


/**
 *
 * @param {Request} request
 * @param {string} filePath
 * @param {string} targetMethod
 * @returns {Promise<Response>}
 */
export const useDevServerFnHandler = async (request: Request, filePath: string, targetMethod: string): Promise<Response> => {
	try {
		const args = (await request.json()) as unknown[]
		
		const serverModule = (await import(filePath)) as ServerModule
		
		const targetFunction = serverModule[targetMethod]
		
		if(typeof targetFunction !== "function") {
			return Response.json(
				{
					error: {
						message: `Export '${targetMethod}' in ${filePath} is not an executable function.`,
					},
				},
				{status: 500},
			)
		}
		
		const result = await targetFunction(...args)
		
		// Pure standard Response object mapping
		return Response.json({result})
	}
	catch(err: unknown) {
		const errorInstance = err as Error
		return Response.json(
			{error: {message: errorInstance?.message || String(err)}},
			{status: 500},
		)
	}
}
