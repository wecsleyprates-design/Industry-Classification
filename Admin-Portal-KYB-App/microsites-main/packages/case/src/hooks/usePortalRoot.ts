import { useEffect } from "react";

export const usePortalRoot = () => {
	useEffect(() => {
		// create the portal root for modals within the microsite
		let portalRoot = document.getElementById("portal-root");
		if (!portalRoot) {
			portalRoot = document.createElement("div");
			portalRoot.id = "portal-root";
			document.body.appendChild(portalRoot);
			portalRoot.classList.add("case");
		}

		return () => {
			// clean up the portal root if it's no longer needed
			if (portalRoot && portalRoot.childNodes.length === 0) {
				portalRoot.remove();
			}
		};
	}, []);
};
