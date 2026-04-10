/**
 * Store for inline editing state
 * Tracks the last auto-save timestamp for displaying in the UI
 * Tracks edited facts per case ID
 *
 * Usage:
 * - Global state: const { isSaving, showAutoSaveToast, setIsSaving, setShowAutoSaveToast } = _useSharedInlineEditStore(); (internal use only)
 * - Case-scoped: const { addEditedFact, hasEdits, editedFacts, clearEditedFacts, lastAutoSavedAt, setLastAutoSavedAt } = useInlineEditStore(caseId);
 */
import { useCallback } from "react";
import { create } from "zustand";

interface InlineEditState {
	/** Map of case IDs to their last successful auto-save timestamp */
	lastAutoSavedAtByCase: Record<string, string>;
	/** Whether a save is currently in progress */
	isSaving: boolean;
	/** Whether to show the auto-save toast notification */
	showAutoSaveToast: boolean;
	/** Map of case IDs to their edited fact keys */
	editedFactsByCase: Record<string, string[]>;
	setLastAutoSavedAt: (caseId: string, timestamp: Date | null) => void;
	getLastAutoSavedAt: (caseId: string) => string | null;
	setIsSaving: (isSaving: boolean) => void;
	setShowAutoSaveToast: (show: boolean) => void;
	/** Add a fact to the edited facts list for a specific case */
	addEditedFact: (caseId: string, factKey: string) => void;
	/** Get edited facts for a specific case */
	getEditedFacts: (caseId: string) => string[];
	/** Check if a specific case has any edits */
	hasEdits: (caseId: string) => boolean;
	/** Clear all edited facts for a specific case */
	clearEditedFacts: (caseId: string) => void;
}

const _useSharedInlineEditStore = create<InlineEditState>()((set, get) => ({
	lastAutoSavedAtByCase: get()?.lastAutoSavedAtByCase ?? {},
	isSaving: get()?.isSaving ?? false,
	showAutoSaveToast: get()?.showAutoSaveToast ?? false,
	editedFactsByCase: get()?.editedFactsByCase ?? {},

	setLastAutoSavedAt: (caseId: string, timestamp: Date | null) => {
		const lastAutoSavedAtByCase = get().lastAutoSavedAtByCase;
		if (timestamp === null) {
			const { [caseId]: _, ...rest } = lastAutoSavedAtByCase;
			set({ lastAutoSavedAtByCase: rest });
		} else {
			set({
				lastAutoSavedAtByCase: {
					...lastAutoSavedAtByCase,
					[caseId]: timestamp.toISOString(),
				},
			});
		}
	},
	getLastAutoSavedAt: (caseId: string) => {
		return get().lastAutoSavedAtByCase[caseId] ?? null;
	},
	setIsSaving: (isSaving: boolean) => {
		set({ isSaving });
	},
	setShowAutoSaveToast: (show: boolean) => {
		set({ showAutoSaveToast: show });
	},
	addEditedFact: (caseId: string, factKey: string) => {
		const editedFactsByCase = get().editedFactsByCase;
		const currentFacts = editedFactsByCase[caseId] ?? [];
		if (!currentFacts.includes(factKey)) {
			set({
				editedFactsByCase: {
					...editedFactsByCase,
					[caseId]: [...currentFacts, factKey],
				},
			});
		}
	},
	getEditedFacts: (caseId: string) => {
		return get().editedFactsByCase[caseId] ?? [];
	},
	hasEdits: (caseId: string) => {
		const facts = get().editedFactsByCase[caseId] ?? [];
		return facts.length > 0;
	},
	clearEditedFacts: (caseId: string) => {
		const editedFactsByCase = get().editedFactsByCase;
		const { [caseId]: _, ...rest } = editedFactsByCase;
		set({ editedFactsByCase: rest });
	},
}));

/**
 * Hook to get case-scoped inline edit functions
 * Pass the case ID once and get functions that already know which case they're operating on
 *
 * @param caseId - The ID of the case to scope operations to
 * @returns Case-scoped functions and state for inline editing
 *
 * @example
 * const { addEditedFact, editedFacts, hasEdits, clearEditedFacts, lastAutoSavedAt, setLastAutoSavedAt } = useInlineEditStore(caseId);
 * addEditedFact('business_name'); // automatically scoped to this case
 * setLastAutoSavedAt(new Date()); // automatically scoped to this case
 */
export const useInlineEditStore = (caseId: string) => {
	const {
		hasEdits: _hasEdits,
		getEditedFacts: _getEditedFacts,
		getLastAutoSavedAt: _getLastAutoSavedAt,
		showAutoSaveToast,

		addEditedFact: _addEditedFact,
		clearEditedFacts: _clearEditedFacts,
		setLastAutoSavedAt: _setLastAutoSavedAt,
		setShowAutoSaveToast,
	} = _useSharedInlineEditStore();

	const addEditedFact = useCallback(
		(factKey: string) => {
			_addEditedFact(caseId, factKey);
		},
		[caseId, _addEditedFact],
	);

	const clearEditedFacts = useCallback(() => {
		_clearEditedFacts(caseId);
	}, [caseId, _clearEditedFacts]);

	const setLastAutoSavedAt = useCallback(
		(timestamp: Date | null) => {
			_setLastAutoSavedAt(caseId, timestamp);
		},
		[caseId, _setLastAutoSavedAt],
	);

	return {
		/** Check if this case has any edits */
		hasEdits: _hasEdits(caseId),
		/** Get edited facts for this case */
		editedFacts: _getEditedFacts(caseId),
		/** Get last auto-saved timestamp for this case */
		lastAutoSavedAt: _getLastAutoSavedAt(caseId),
		/** Get whether to show the auto-save toast notification for this case */
		showAutoSaveToast,
		/** Add a fact to the edited facts list for this case */
		addEditedFact,
		/** Clear all edited facts for this case */
		clearEditedFacts,
		/** Set last auto-saved timestamp for this case */
		setLastAutoSavedAt,
		/** Set whether to show the auto-save toast notification for this case */
		setShowAutoSaveToast,
	};
};
