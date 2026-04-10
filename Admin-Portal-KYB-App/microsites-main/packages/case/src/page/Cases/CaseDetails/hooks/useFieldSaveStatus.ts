import { useCallback, useState } from "react";
import type { SaveStatus } from "@/components/EditableField";

export const useFieldSaveStatus = () => {
	const [fieldSaveStatuses, setFieldSaveStatuses] = useState<
		Record<string, SaveStatus>
	>({});

	const getSaveStatus = useCallback(
		(fieldKey: string): SaveStatus => {
			return fieldSaveStatuses[fieldKey] ?? "idle";
		},
		[fieldSaveStatuses],
	);

	const setSaveStatus = useCallback(
		(fieldKey: string, status: SaveStatus) => {
			setFieldSaveStatuses((prev) => ({ ...prev, [fieldKey]: status }));
		},
		[],
	);

	/**
	 * Reset all save statuses back to idle.
	 * Call this after re-running integrations to clear "Updated" badges.
	 */
	const resetAllSaveStatuses = useCallback(() => {
		setFieldSaveStatuses({});
	}, []);

	return { getSaveStatus, setSaveStatus, resetAllSaveStatuses };
};

export default useFieldSaveStatus;
