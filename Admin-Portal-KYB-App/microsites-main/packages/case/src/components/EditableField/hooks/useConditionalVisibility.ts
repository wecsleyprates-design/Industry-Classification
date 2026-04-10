import { useMemo } from "react";
import type {
	FieldPath,
	FieldValues,
	FormState,
	UseFormGetValues,
} from "react-hook-form";

export interface UseConditionalVisibilityParams<
	TFieldValues extends FieldValues = FieldValues,
> {
	/** Show field only when this field is dirty */
	showWhenDirty?: FieldPath<TFieldValues>;
	/** Show field only when this field has a value */
	showWhenHasValue?: FieldPath<TFieldValues>;
	/** Form state from useFormContext */
	formState: FormState<TFieldValues>;
	/** getValues function from useFormContext */
	getValues: UseFormGetValues<TFieldValues>;
}

/**
 * Hook to determine if field should be visible based on conditions.
 */
export function useConditionalVisibility<
	TFieldValues extends FieldValues = FieldValues,
>({
	showWhenDirty,
	showWhenHasValue,
	formState,
	getValues,
}: UseConditionalVisibilityParams<TFieldValues>): boolean {
	return useMemo(() => {
		if (showWhenDirty) {
			const dirtyFields = formState.dirtyFields as Record<
				string,
				boolean | undefined
			>;
			if (!dirtyFields[showWhenDirty as string]) return false;
		}
		if (showWhenHasValue) {
			const dependentValue = getValues(showWhenHasValue);
			if (!dependentValue || dependentValue === "") return false;
		}
		return true;
	}, [showWhenDirty, showWhenHasValue, formState.dirtyFields, getValues]);
}
