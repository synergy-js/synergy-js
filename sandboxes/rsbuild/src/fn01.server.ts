import { homedir } from "node:os"
import { readFile } from "node:fs/promises"
import { tryAsync, ResultAsync } from "@synergy-js/verdict"

export const getHomeDir = () => homedir()

export const readLocalFile = async (fileName: string) => {
	return tryAsync(async () => await readFile(fileName, "utf-8")).unwrapOr(`Could not find file ${fileName}`)
}