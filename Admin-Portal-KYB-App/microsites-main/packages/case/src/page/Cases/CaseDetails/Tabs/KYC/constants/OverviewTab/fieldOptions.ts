import { useMemo } from "react";
import { type SuggestionOption } from "@/components/EditableField";
import { useGetOwnerTitles } from "@/services/queries/case.query";
import { type OwnerTitle } from "@/types/case";

/**
 * Hook to fetch and use owner titles from the API.
 * Returns options for dropdown and helper functions for title lookup.
 */
export function useOwnerTitleOptions() {
	const { data: titlesResponse, isLoading } = useGetOwnerTitles();

	const titles = titlesResponse?.data ?? [];

	// Convert API titles to SuggestionOption format
	// Using title string as value for display, then look up ID when saving
	const options: SuggestionOption[] = useMemo(
		() =>
			titles.map((t: OwnerTitle) => ({ label: t.title, value: t.title })),
		[titles],
	);

	// Helper to find a title by id
	const getTitleById = (id: number): OwnerTitle | undefined =>
		titles.find((t: OwnerTitle) => t.id === id);

	// Helper to find a title by name (case-insensitive)
	const getTitleByName = (name: string): OwnerTitle | undefined =>
		titles.find(
			(t: OwnerTitle) => t.title.toLowerCase() === name.toLowerCase(),
		);

	return {
		options,
		titles,
		isLoading,
		getTitleById,
		getTitleByName,
	};
}

/**
 * @deprecated Use useOwnerTitleOptions() hook instead for dynamic API-based titles.
 * This fallback is kept for components that cannot use hooks.
 */
export const JOB_TITLE_OPTIONS: SuggestionOption[] = [];
