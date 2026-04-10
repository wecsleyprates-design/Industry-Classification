const hashString = (str: string): string => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}

	let base36Hash = Math.abs(hash).toString(36);

	while (base36Hash.length < 10) {
		base36Hash += base36Hash;
	}

	return base36Hash.substring(0, 10);
};

const generateCustomID = (element: Element): string => {
	if (element) {
		const uniqueKey = `${String(element?.tagName ?? "")}-${String(
			element?.id ?? "",
		)}-${String(element.className ?? "")}-${String(
			element?.getAttribute("name") ?? "",
		)}-${String(element?.getAttribute("type") ?? "")}-${String(
			element?.getAttribute("for") ?? "",
		)}`;
		return hashString(uniqueKey);
	}
	return "";
};

/** Skip adding data-qa to TipTap editor and all nodes inside it. */
const isInsideTipTap = (element: Element): boolean =>
	element.closest('[class*="tiptap"]') !== null;

const addDataQAAttributes = () => {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			mutation.addedNodes.forEach((node) => {
				if (node instanceof HTMLElement && !isInsideTipTap(node)) {
					let customID = generateCustomID(node);
					node.setAttribute("data-qa", customID);
					node.querySelectorAll("*").forEach((child) => {
						if (isInsideTipTap(child)) return;
						customID = generateCustomID(child);
						child.setAttribute("data-qa", customID);
					});
				}
			});
		});
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});

	return () => {
		observer.disconnect();
	};
};

export { addDataQAAttributes };
