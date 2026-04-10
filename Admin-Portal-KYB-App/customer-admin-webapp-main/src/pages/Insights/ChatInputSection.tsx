import React from "react";
import { isNonEmptyString } from "@austinburns/type-guards";
import { motion } from "framer-motion";
import { BarLoader } from "@/components/BarLoader";

interface ChatInputSectionProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	isPendingResponse: boolean;
	showSuggestedQuestions: boolean;
	setShowSuggestedQuestions: (value: boolean) => void;
	handleSubmit: (suggestedQuestion?: string) => Promise<void>;
}

export const ChatInputSection: React.FC<ChatInputSectionProps> = ({
	inputValue,
	setInputValue,
	isPendingResponse,
	showSuggestedQuestions,
	setShowSuggestedQuestions,
	handleSubmit,
}) => {
	return (
		<div>
			<div className="flex flex-row-reverse justify-between">
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: isPendingResponse ? 1 : 0 }}
					transition={{ duration: 0.5 }}
				>
					<BarLoader />
				</motion.div>
				<motion.div
					initial={false}
					animate={showSuggestedQuestions ? "open" : "closed"}
					className="z-10 -mb-[8px]"
				>
					<motion.button
						whileTap={{ scale: 0.97 }}
						className="group bg-slate-50 text-slate-700 border border-slate-300 rounded-t-md py-0.5 px-2 w-[190px] inline-flex items-center justify-between ring-slate-300 focus:ring-1 focus:ring-slate-400 focus:outline-none"
						onClick={() => {
							setShowSuggestedQuestions(!showSuggestedQuestions);
						}}
					>
						<span className="text-[#a5a4a4c0] text-sm group-hover:text-slate-400">
							Suggested questions
						</span>
						<motion.div
							variants={{
								open: { rotate: 0 },
								closed: { rotate: 180 },
							}}
							transition={{ duration: 0.2 }}
							style={{ originY: 0.55 }}
							className="text-[#a5a4a4c0] group-hover:text-slate-400"
						>
							<svg
								width="15"
								height="15"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path d="M0 7 L 20 7 L 10 16" />
							</svg>
						</motion.div>
					</motion.button>
				</motion.div>
			</div>
			<input
				className="z-0 w-full mt-2 px-2 py-4 border-0 bg-slate-50 rounded rounded-tl-none text-slate-700 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-slate-400 focus:outline-none"
				value={inputValue}
				placeholder="Ask Finley for help..."
				onChange={(e) => {
					setInputValue(e.target.value);
				}}
				onKeyDown={async (e) => {
					if (e.key === "Enter" && isNonEmptyString(inputValue)) {
						await handleSubmit();
					}
				}}
			/>
		</div>
	);
};
