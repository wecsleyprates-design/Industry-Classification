import type { ReactNode } from "react";
import { useAddClassName, usePortalRoot } from "@/hooks";

import { ToastProvider } from "@/providers/ToastProvider";

export const CustomerWrapper: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	usePortalRoot();
	useAddClassName(["data-radix-popper-content-wrapper"]);
	return (
		<div className="customer">
			<ToastProvider />
			{children}
		</div>
	);
};
