import React from "react";
import cx from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { type Message } from "@/types/insights";
import { RenderMessageContent } from "./RenderMessageContent";

interface ChatMessagesProps {
	messages: Message[];
	showSuggestedQuestions: boolean;
	suggestedQuestions: Array<{ id: number; question: string }>;
	handleSubmit: (suggestedQuestion?: string) => Promise<void>;
	endOfMessagesRef: React.RefObject<HTMLLIElement | null>;
	setShowSuggestedQuestions: (value: boolean) => void;
}

const suggestedQuestionVariants = {
	open: {
		opacity: 1,
		y: 0,
		transition: { type: "spring" as const, stiffness: 300, damping: 24 },
	},
	closed: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

const ChatMessages: React.FC<ChatMessagesProps> = ({
	messages,
	showSuggestedQuestions,
	suggestedQuestions,
	handleSubmit,
	endOfMessagesRef,
	setShowSuggestedQuestions,
}) => {
	return (
		<>
			<motion.div
				initial={false}
				animate={{
					y: showSuggestedQuestions ? 0 : 240,
					transition: { type: "spring", stiffness: 300, damping: 24 },
				}}
			>
				<ul role="list" className="flex flex-col gap-4">
					<AnimatePresence>
						{messages.map((message, index) => (
							<motion.li
								key={message.id}
								initial={{ opacity: 0, y: 50 }} // Start below the view
								animate={{ opacity: 1, y: 0 }} // End at its final position
								exit={{ opacity: 0, y: 50 }} // Exit to the bottom
								transition={{ duration: 0.5 }}
								className={cx(
									"rounded-md bg-white border text-[#333] text-sm border-[#c6c3c336] px-2 py-3 shadow",
									message.role === "assistant" &&
										"border-[#fe6fbbe4] shadow-violet-600/30 border-2",
								)}
								ref={index === messages.length - 1 ? endOfMessagesRef : null}
							>
								<RenderMessageContent msg={message} />
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			</motion.div>
			<motion.div
				initial={false}
				animate={showSuggestedQuestions ? "open" : "closed"}
			>
				<motion.ul
					variants={{
						open: {
							clipPath: "inset(0% 0% 0% 0% round 10px)",
							transition: {
								type: "spring",
								bounce: 0,
								duration: 0.7,
								delayChildren: 0.3,
								staggerChildren: 0.05,
							},
						},
						closed: {
							clipPath: "inset(10% 50% 90% 50% round 10px)",
							transition: {
								type: "spring",
								bounce: 0,
								duration: 0.3,
							},
						},
					}}
					role="list"
					className="rounded-md p-0.5 mt-5 space-y-3"
				>
					{suggestedQuestions.map((item) => (
						<motion.li
							key={item.id}
							onClick={async () => {
								setShowSuggestedQuestions(false);
								await handleSubmit(item.question);
							}}
							variants={suggestedQuestionVariants}
							className="overflow-hidden rounded-md bg-slate-50 border text-slate-500 text-sm border-[#c6c3c336] px-2 py-3 shadow cursor-pointer hover:bg-slate-200 hover:text-black ring-slate-300 focus:ring-2 focus:ring-slate-400 focus:outline-none slate-400"
							tabIndex={showSuggestedQuestions ? 0 : undefined}
						>
							{item.question}
						</motion.li>
					))}
				</motion.ul>
			</motion.div>
		</>
	);
};

export default ChatMessages;
