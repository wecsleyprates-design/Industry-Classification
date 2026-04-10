import { useCallback } from "react";
import { toast } from "sonner";
import { getItem, setItem } from "@/lib/localStorage";

import { LOCALSTORAGE } from "@/constants";

/**
 * Hook for managing dismissed persistent toast IDs in localStorage.
 * Provides utilities to check, add, and remove persistent toast IDs from the dismissed list.
 */
export const useDismissedPersistentToasts = () => {
	const getDismissedToasts = useCallback((): string[] => {
		const dismissed = getItem(LOCALSTORAGE.dismissedIntegrationToasts);
		return Array.isArray(dismissed) ? dismissed : [];
	}, []);

	const isPersistentToastDismissed = (toastId: string): boolean =>
		getDismissedToasts().includes(toastId);

	const dismissPersistentToast = (toastId: string): void => {
		const dismissed = getDismissedToasts();
		if (!dismissed.includes(toastId)) {
			toast.dismiss(toastId);
			setItem(LOCALSTORAGE.dismissedIntegrationToasts, [
				...dismissed,
				toastId,
			]);
		}
	};

	const undismissPersistentToast = (toastId: string): void => {
		const dismissed = getDismissedToasts();
		const filtered = dismissed.filter((id) => id !== toastId);
		setItem(LOCALSTORAGE.dismissedIntegrationToasts, filtered);
	};

	return {
		isPersistentToastDismissed,
		dismissPersistentToast,
		undismissPersistentToast,
	};
};
