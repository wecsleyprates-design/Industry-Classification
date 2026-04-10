export const trimAndTitleCase = (str?: string | null) =>
	str
		?.trim()
		.toLowerCase()
		.replace(/\b\w/g, (char) => char.toUpperCase())
		.replace(/undefined/gi, "") || null;
