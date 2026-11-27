import { classToSlot } from "./sheet.js"

export const cx = (...inputs: (string | false | null | undefined)[]): string => {
	const resolvedSlots = new Map<string, string>()
	const passthrough: string[] = []
	
	for(let i = 0; i < inputs.length; i++) {
		const chunk = inputs[i]
		if(!chunk) continue
		
		const tokens = chunk.split(" ")
		for(let j = 0; j < tokens.length; j++) {
			const cls = tokens[j]
			if(!cls) continue
			
			const slot = classToSlot.get(cls)
			if(slot) {
				resolvedSlots.set(slot, cls)
			}
			else {
				passthrough.push(cls)
			}
		}
	}
	
	return [...passthrough, ...resolvedSlots.values()].join(" ")
}
