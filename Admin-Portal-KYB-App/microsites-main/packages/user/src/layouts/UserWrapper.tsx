import type { ReactNode } from "react";
import { useAddClassName, usePortalRoot } from "@/hooks";

import { ToastProvider } from "@/providers/ToastProvider";

export const UserWrapper: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	usePortalRoot();
	useAddClassName(["data-radix-popper-content-wrapper"]);
	return (
		<div className="user">
			<ToastProvider />
			{children}
		</div>
	);
};
