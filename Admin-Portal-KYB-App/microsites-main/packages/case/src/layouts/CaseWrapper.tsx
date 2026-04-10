import type { ReactNode } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useAddClassName, usePortalRoot } from "@/hooks";

import { envConfig } from "@/config/envConfig";

const CaseWrapper = ({ children }: { children: ReactNode }) => {
	usePortalRoot();
	useAddClassName(["data-radix-popper-content-wrapper"]);
	return (
		<APIProvider
			apiKey={envConfig.VITE_GOOGLE_MAPS_API_KEY}
			libraries={["marker"]}
		>
			{children}
		</APIProvider>
	);
};

export default CaseWrapper;
