import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const ANIMATION_DURATION_MS = 250;

/** Wraps a toast with slide-in-from-bottom / slide-out-to-bottom animations. */
export const AnimatedEntry: React.FC<{
	visible: boolean;
	children: React.ReactNode;
}> = ({ visible, children }) => {
	const [mounted, setMounted] = useState(visible);
	const [shown, setShown] = useState(false);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (visible) {
			setMounted(true);
			/** Double rAF: first frame mounts in the hidden state, second triggers the transition */
			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = requestAnimationFrame(() => {
					setShown(true);
				});
			});
			return () => {
				if (rafRef.current !== null)
					cancelAnimationFrame(rafRef.current);
			};
		} else {
			setShown(false);
			const t = setTimeout(() => {
				setMounted(false);
			}, ANIMATION_DURATION_MS);
			return () => {
				clearTimeout(t);
			};
		}
	}, [visible]);

	if (!mounted) return null;

	return (
		<div
			className={cn(
				"transition-all duration-200 ease-in-out",
				shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
			)}
		>
			{children}
		</div>
	);
};
