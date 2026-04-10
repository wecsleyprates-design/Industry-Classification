import { useEffect, useRef, useState } from "react";
import {
	isEmptyArray,
	isNonEmptyArray,
	isNonEmptyString,
	isNotNil,
} from "@austinburns/type-guards";
import cx from "classnames";
import useCustomToast from "@/hooks/useCustomToast";
import { useInsightsChatBotMutation } from "@/services/queries/insights.query";
import { type Nullable } from "@/types/index";
import { type InsightsReportResponse, type Message } from "@/types/insights";
import { ChatInputSection } from "./ChatInputSection";
import ChatMessages from "./ChatMessages";

interface SuggestedQuestion {
	id: number;
	question: string;
}

const initialSuggestedQuestions: SuggestedQuestion[] = [
	{ id: 1, question: "How can I improve my score?" },
	{
		id: 2,
		question: "Create a table summarizing my report.",
	},
	{ id: 3, question: "What's the average score for businesses of my size?" },
	{ id: 4, question: "What are the top three areas impacting my score?" },
];

export const ChatSection = ({
	insightsReport,
}: {
	insightsReport: Nullable<InsightsReportResponse>;
}) => {
	const [showSuggestedQuestions, setShowSuggestedQuestions] = useState(false);
	const [suggestedQuestions, setSuggestedQuestions] = useState<
		SuggestedQuestion[]
	>(initialSuggestedQuestions);

	const [inputValue, setInputValue] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const endOfMessagesRef = useRef<HTMLLIElement>(null);

	const { errorHandler } = useCustomToast();

	const {
		isPending: isPendingResponse,
		error: insightsChatBotError,
		mutateAsync: submitInsightsChatBotQuery,
	} = useInsightsChatBotMutation();

	useEffect(() => {
		if (isNotNil(insightsChatBotError)) {
			errorHandler(insightsChatBotError);
		}
	}, [insightsChatBotError]);

	useEffect(() => {
		if (insightsReport?.data.suggestedQuestions) {
			setSuggestedQuestions(
				insightsReport.data.suggestedQuestions.map((question, index) => ({
					id: index,
					question,
				})),
			);
		}
	}, [insightsReport]);

	const addMessage = (message: Message) => {
		setMessages((prevMessages) => [...prevMessages, message]);
	};

	const handleSubmit = async (suggestedQuestion?: string) => {
		setShowSuggestedQuestions(false);
		const newUserMessage = {
			id: new Date().getTime(),
			role: "user",
			content: isNonEmptyString(suggestedQuestion)
				? suggestedQuestion
				: inputValue,
		} as const;
		addMessage(newUserMessage);
		setInputValue("");

		const { data } = await submitInsightsChatBotQuery({
			messages: [...messages, newUserMessage],
			reportSummary: insightsReport?.data.summary,
			impactOfCompanyProfileScore:
				insightsReport?.data.reportBreakDown.impactOfCompanyProfileScore,
			actionItemsForCompanyProfile:
				insightsReport?.data.reportBreakDown.actionItemsForCompanyProfile,
			impactOfFinancialTrendsScore:
				insightsReport?.data.reportBreakDown.impactOfFinancialTrendsScore,
			actionItemsForFinancialTrends:
				insightsReport?.data.reportBreakDown.actionItemsForFinancialTrends,
			impactOfPublicRecordsScore:
				insightsReport?.data.reportBreakDown.impactOfPublicRecordsScore,
			actionItemsForPublicRecords:
				insightsReport?.data.reportBreakDown.actionItemsForPublicRecords,
			impactOfWorthScore:
				insightsReport?.data.reportBreakDown.impactOfWorthScore,
			actionItemsForWorth:
				insightsReport?.data.reportBreakDown.actionItemsForWorth,
		});
		const newAssistantMessage = {
			id: new Date().getTime(),
			role: "assistant",
			content: data,
		} as const;
		addMessage(newAssistantMessage);
	};

	return (
		<>
			<h2 className="-mb-1 text-2xl font-bold tracking-tight text-gray-900">
				Chat with Finley
			</h2>
			<div className={cx(isNonEmptyArray(messages) && "hidden", "space-y-2")}>
				<p className="leading-5 text-gray-600 text-md">
					Your personalized advisor in helping you to grow your business. Finley
					can help answer any questions about your score and insights - check
					out our suggested questions, or enter a prompt to get started.
				</p>
				<div className="grid grid-cols-2 gap-2 auto-rows-min">
					{suggestedQuestions.map((suggestedQuestion) => (
						<p
							role="button"
							key={suggestedQuestion.id}
							onClick={async () => {
								setShowSuggestedQuestions(false);
								await handleSubmit(suggestedQuestion.question);
							}}
							className="col-span-2 sm:col-span-1 cursor-pointer text-[#333] text-xs p-4 border border-[#CC99FF]/50 rounded h-full w-full sm:flex sm:items-center sm:justify-center"
						>
							{suggestedQuestion.question}
						</p>
					))}
				</div>
				<input
					className="block w-full rounded border border-[#BC42B9] p-2 mt-2 text-sm text-slate-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#CC99FF] leading-6"
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
			<div className={cx(isEmptyArray(messages) && "hidden")}>
				<div
					className={cx(
						"flex flex-col gap-3 justify-between",
						"rounded py-4 px-2.5 border border-slate-300",
						"max-h-[400px] md:min-h-[500px]",
					)}
				>
					<div className="h-full overflow-scroll">
						<ChatMessages
							messages={messages}
							showSuggestedQuestions={showSuggestedQuestions}
							suggestedQuestions={suggestedQuestions}
							handleSubmit={handleSubmit}
							endOfMessagesRef={endOfMessagesRef}
							setShowSuggestedQuestions={setShowSuggestedQuestions}
						/>
					</div>
					<ChatInputSection
						inputValue={inputValue}
						setInputValue={setInputValue}
						isPendingResponse={isPendingResponse}
						showSuggestedQuestions={showSuggestedQuestions}
						setShowSuggestedQuestions={setShowSuggestedQuestions}
						handleSubmit={handleSubmit}
					/>
				</div>
			</div>
		</>
	);
};
