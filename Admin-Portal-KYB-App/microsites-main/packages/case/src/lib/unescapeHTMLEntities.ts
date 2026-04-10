const entities = {
	"&amp;": "&",
	"&#38;": "&",
	"&apos;": "'",
	"&#39;": "'",
	"&#x27;": "'",
	"&quot;": '"',
	"&#34;": '"',
	/**
	 * The below entities are commented out by default to prevent XSS vulnerabilities.
	 *
	 * If you need to unescape < and > entities, you can uncomment these lines --
	 * just be sure to handle XSS vulnerabilities, since these characters can be
	 * used to inject <script> tags and whatnot.
	 */
	// "&lt;": "<",
	// "&#60;": "<",
	// "&gt;": ">",
	// "&#62;": ">",
};

const regex = new RegExp(
	Object.keys(entities)
		// Sort by length descending to avoid partial matches. Not a problem for the current set of entities, but good practice.
		// This ensures that longer entities are matched first, preventing issues with shorter entities being matched.
		.sort((a, b) => b.length - a.length)
		// Escape special regex chars
		.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|"),
	"g",
);

export const unescapeHTMLEntities = (subject: string) => {
	return subject.replace(regex, (s) => entities[s as keyof typeof entities]);
};
