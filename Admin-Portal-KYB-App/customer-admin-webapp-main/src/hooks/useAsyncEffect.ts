/**
 * React 19 compatible async effect hook.
 * Handles async functions in useEffect with proper cleanup.
 */
import { useEffect } from "react";

export function useAsyncEffect(
	effect: () => Promise<void | (() => void)>,
	deps?: React.DependencyList,
) {
	useEffect(() => {
		let cancelled = false;
		let cleanup: (() => void) | void;

		const runEffect = async () => {
			try {
				const result = await effect();
				if (!cancelled && typeof result === "function") {
					cleanup = result;
				}
			} catch (error) {
				// Only log errors if the effect wasn't cancelled (component still mounted)
				if (!cancelled) {
					console.error("Error in useAsyncEffect:", error);
				}
			}
		};

		runEffect();

		return () => {
			cancelled = true;
			if (cleanup) {
				cleanup();
			}
		};
	}, deps);
}
