import type { Workflow } from "@/types/workflows";

/**
 * Formats version display from published_version and draft_version fields
 * @param publishedVersion - Published version string or null (e.g., "1.0" or null)
 * @param draftVersion - Draft version string or null (e.g., "2.0" or null)
 * @returns Object with current version and optional editing version
 */
export const formatVersionDisplay = (
	publishedVersion: string | null,
	draftVersion: string | null,
): { current: string; editing?: string } => {
	// If both exist: show "published -> draft"
	if (publishedVersion && draftVersion) {
		return { current: publishedVersion, editing: draftVersion };
	}
	// If only draft exists: show "0.0 -> draft"
	if (!publishedVersion && draftVersion) {
		return { current: "0.0", editing: draftVersion };
	}
	// If only published exists: show "published"
	if (publishedVersion && !draftVersion) {
		return { current: publishedVersion };
	}
	// If neither exists: show "0"
	return { current: "0" };
};

/**
 * Gets display name for workflow creator
 * @param workflow - Workflow object
 * @returns Display name (created_by_name if available, otherwise created_by UUID)
 */
export const getWorkflowCreatorDisplayName = (workflow: Workflow): string => {
	return workflow.created_by_name ?? workflow.created_by;
};
