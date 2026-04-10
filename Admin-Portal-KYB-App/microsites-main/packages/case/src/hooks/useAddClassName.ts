import { useEffect } from "react";

export const useAddClassName = (attributes: string[]) => {
	useEffect(() => {
		const observer = new MutationObserver((mutations: MutationRecord[]) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node as HTMLElement;
						attributes.forEach((attr) => {
							if (element.hasAttribute(attr)) {
								element.classList.add("case");
							}
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
	}, [attributes]);
};
