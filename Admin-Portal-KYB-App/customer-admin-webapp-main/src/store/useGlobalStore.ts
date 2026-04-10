import { create } from "zustand";
import { getItem, setItem } from "@/lib/localStorage";
import { logger } from "./logger";

interface GlobalState {
	isMenuOpen: boolean;
	savedPayload: Record<string, URLSearchParams> | null | undefined;
	savedNormalPayload:
		| Record<string, Record<string, unknown>>
		| null
		| undefined;
}

export interface GlobalStore extends GlobalState {
	toggleMenu: () => void;
	setSavedPayload: (args: { module: string; values: URLSearchParams }) => void;
	setSavedNormalPayload: (args: {
		module: string;
		values: Record<string, unknown>;
	}) => void;
	resetSavedPayload: () => void;
}

const initialState: Pick<GlobalStore, keyof GlobalState> = {
	isMenuOpen: getItem("isMenuOpen") ?? false,
	savedPayload: null,
	savedNormalPayload: null,
};

const useGlobalStore = create<GlobalStore>()(
	logger<GlobalStore>(
		(set) => ({
			...initialState,
			toggleMenu: () => {
				set((state) => {
					setItem("isMenuOpen", !state.isMenuOpen);
					return { isMenuOpen: !state.isMenuOpen };
				});
			},
			setSavedPayload(args) {
				set((state) => {
					return {
						...state,
						savedPayload: { ...state.savedPayload, [args.module]: args.values },
					};
				});
			},
			resetSavedPayload() {
				set((state) => {
					return { ...state, savedPayload: null };
				});
			},
			setSavedNormalPayload(args) {
				set((state) => {
					return {
						...state,
						savedNormalPayload: {
							...state.savedNormalPayload,
							[args.module]: args.values,
						},
					};
				});
			},
		}),
		"globalStore",
	),
);

export default useGlobalStore;
