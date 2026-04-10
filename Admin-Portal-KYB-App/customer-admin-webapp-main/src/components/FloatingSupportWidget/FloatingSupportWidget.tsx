import React, { useEffect, useRef, useState } from "react";
import FloatingFAB from "./FloatingFAB";
import FloatingSessionDetails from "./FloatingSessionDetails";

const FAB_SIZE = 56;
const VERTICAL_THRESHOLD = 160;

const clamp = (v: number, min: number, max: number) =>
	Math.max(min, Math.min(v, max));

const getInitPos = () => ({
	x: 32,
	y: window.innerHeight - FAB_SIZE - 32,
});

interface DataDogRUM {
	getSessionReplayLink?: () => string;
}

const FloatingSupportWidget: React.FC = () => {
	const [openHorizontal, setOpenHorizontal] = useState(false);
	const [openVertical, setOpenVertical] = useState(false);
	const [copied, setCopied] = useState(false);
	const [pos, setPos] = useState(getInitPos());

	const rootRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);
	const offsetRef = useRef<{
		x: number;
		y: number;
		startX?: number;
		startY?: number;
	}>({ x: 0, y: 0 });
	const hasDraggedRef = useRef(false);

	/* ---------------- Click outside ---------------- */
	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
				setOpenHorizontal(false);
				setOpenVertical(false);
			}
		};

		if (openHorizontal || openVertical) {
			document.addEventListener("mousedown", handleClick);
		}

		return () => {
			document.removeEventListener("mousedown", handleClick);
		};
	}, [openHorizontal, openVertical]);

	/* ---------------- Window resize ---------------- */
	useEffect(() => {
		const resize = () => {
			setPos((p) => ({
				x: clamp(p.x, 0, window.innerWidth - FAB_SIZE),
				y: clamp(p.y, 0, window.innerHeight - FAB_SIZE),
			}));
		};

		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, []);

	/* ---------------- Drag handlers ---------------- */
	useEffect(() => {
		const handlePointerMove = (e: PointerEvent) => {
			if (!draggingRef.current) return;

			// Mark that we've dragged if the pointer has moved significantly
			const deltaX = Math.abs(
				e.clientX - (offsetRef.current.startX || e.clientX),
			);
			const deltaY = Math.abs(
				e.clientY - (offsetRef.current.startY || e.clientY),
			);
			if (deltaX > 5 || deltaY > 5) {
				hasDraggedRef.current = true;
			}

			setPos({
				x: clamp(
					e.clientX - offsetRef.current.x,
					0,
					window.innerWidth - FAB_SIZE,
				),
				y: clamp(
					e.clientY - offsetRef.current.y,
					0,
					window.innerHeight - FAB_SIZE,
				),
			});
		};

		const handlePointerUp = () => {
			if (draggingRef.current) {
				draggingRef.current = false;
				// Reset after a short delay to allow onClick to check it
				setTimeout(() => {
					hasDraggedRef.current = false;
				}, 0);
			}
		};

		// Always have listeners ready, they check draggingRef internally
		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", handlePointerUp);

		return () => {
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
		};
	}, []);

	const onPointerDown = (e: React.PointerEvent) => {
		draggingRef.current = true;
		hasDraggedRef.current = false;
		offsetRef.current = {
			x: e.clientX - pos.x,
			y: e.clientY - pos.y,
			startX: e.clientX,
			startY: e.clientY,
		};
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	};

	/* ---------------- Copy logic ---------------- */
	const handleCopy = () => {
		const val = (
			window as unknown as { DD_RUM?: DataDogRUM }
		).DD_RUM?.getSessionReplayLink?.();

		if (!val) {
			console.error("Failed to copy: Session replay link is undefined.");
			return;
		}

		navigator.clipboard
			.writeText(val)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			})
			.catch((err) => console.error("Clipboard error:", err));
	};

	const detailsDirection =
		pos.y > window.innerHeight - FAB_SIZE - VERTICAL_THRESHOLD ? "up" : "down";

	return (
		<div
			ref={rootRef}
			className="fixed z-[1000]"
			style={{
				left: 0,
				top: 0,
				transform: `translate(${pos.x}px, ${pos.y}px)`,
			}}
		>
			<FloatingFAB
				onPointerDown={onPointerDown}
				onClick={(e) => {
					// Prevent click if user was dragging
					if (hasDraggedRef.current) {
						e.preventDefault();
						return;
					}
					if (openHorizontal) setOpenVertical(false);
					setOpenHorizontal((p) => !p);
				}}
			/>

			{openHorizontal && (
				<div className="absolute left-[70px] top-0 min-w-[300px] bg-white rounded-lg py-3 px-4 shadow-lg flex items-center z-20">
					<span className="flex-1 font-medium text-[14px] whitespace-nowrap font-inter">
						Helper Box
					</span>

					<button
						className="ml-2 py-[2px] px-[10px] border border-[#1976d2] rounded bg-white text-[#1976d2] text-[14px] font-medium hover:bg-[#f0f7ff] transition"
						onClick={() => setOpenVertical((v) => !v)}
					>
						{openVertical ? "Hide Details" : "Show Details"}
					</button>

					{openVertical && (
						<FloatingSessionDetails
							copied={copied}
							onCopy={handleCopy}
							direction={detailsDirection}
						/>
					)}
				</div>
			)}
		</div>
	);
};

export default FloatingSupportWidget;
