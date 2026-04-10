import { useEffect } from "react";

const useAddClassName = (attributes: string[]) => {
	const addClassName = (attributes: string[]) => {
		const observer = new MutationObserver((mutations: MutationRecord[]) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node as HTMLElement;
						attributes.forEach((attr) => {
							if (element.hasAttribute(attr)) {
								element.classList.add("dashboard");
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
	};

	useEffect(() => {
		addClassName(attributes);
	}, []);
};
export default useAddClassName;
