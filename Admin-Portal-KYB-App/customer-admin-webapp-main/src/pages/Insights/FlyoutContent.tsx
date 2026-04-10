import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const FlyoutContent = ({
	children,
	title,
	definition,
	subCopy1,
	subCopy2,
	subCopyHeader1,
	subCopyHeader2,
	forceOpen,
}: {
	children: React.ReactNode;
	title: string;
	definition: string;
	subCopyHeader1: string;
	subCopy1: string;
	subCopyHeader2: string;
	subCopy2: string;
	forceOpen: boolean;
}) => {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		setOpen(forceOpen);
	}, [forceOpen]);

	return (
		<div
			onMouseEnter={() => {
				setOpen(true);
			}}
			onMouseLeave={() => {
				setOpen(false);
			}}
			className="relative h-fit w-fit"
		>
			<div className="relative">
				{children}
				<span
					style={{
						transform: open ? "scaleX(1)" : "scaleX(0)",
					}}
					className="absolute -bottom-1 -left-2 -right-2 h-1 origin-left scale-x-0 rounded-full bg-indigo-500 transition-transform duration-300 ease-out"
				/>
			</div>
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, x: 15 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 15 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
						className="absolute left-full top-0 ml-4 w-64 bg-white text-black shadow-lg z-20"
					>
						<div className="absolute -top-6 left-0 right-0 h-6 bg-transparent" />
						<div className="absolute left-0 top-[18px] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-neutral-950" />
						<div className="flex flex-col h-fit w-fit shadow-xl">
							<div className="bg-neutral-950 p-4">
								<h2 className="mb-2 text-xl font-semibold text-white">
									{title}
								</h2>
								<p className="mb-2 max-w-xs text-sm text-neutral-400">
									{definition}
								</p>
							</div>
							<div className="border-b-none border-2 border-neutral-950 bg-white p-3 transition-colors">
								<h3 className="mb-1 font-semibold">{subCopyHeader1}</h3>
								<p className="text-xs">{subCopy1}</p>
							</div>
							<div className="border-t-none border-2 border-neutral-950 bg-white p-3 transition-colors">
								<h3 className="mb-1 font-semibold">{subCopyHeader2}</h3>
								<p className="text-xs">{subCopy2}</p>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};
