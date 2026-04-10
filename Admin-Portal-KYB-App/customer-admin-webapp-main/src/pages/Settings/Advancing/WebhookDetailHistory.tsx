import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import Button from "@/components/Button";
import TableLoader from "@/components/Spinner/TableLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import {
	useGetWebhookEventLogs,
	useResendMessageLog,
} from "@/services/queries/webhook.query";
import { type getWebhookEventLogsResponse } from "@/types/webhooks";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface DateEventObject {
	id: string;
	name: string;
	time: string;
	response: string | Record<string, any>;
	status: number;
	msg_id: string;
	payload: Record<string, unknown>;
}

interface EventDate {
	date: string;
	dateEvents: DateEventObject[];
}
const WebhookDetailHistory = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const slug = useParams().slug;
	const { errorHandler, successHandler } = useCustomToast();
	const [allEvents, setAllEvents] = useState<EventDate[] | null>(null);
	const [activeTab, setActiveTab] = useState<"All" | "Failed" | "Succeeded">(
		"All",
	);
	const [requestResponseTab, setRequestResponseTab] = useState("Response");
	const [selectedEvent, setSelectedEvent] = useState<DateEventObject | null>(
		null,
	);

	const {
		data: webhookEventLogsData,
		isLoading,
		refetch: refetchEventLogs,
	} = useGetWebhookEventLogs(customerId, slug ?? "");

	const {
		data: resendMessageLogData,
		mutateAsync: resendLog,
		error: resendMessageLogError,
		isPending: resendMessageLogLoading,
	} = useResendMessageLog();

	const handleTabClick = (tab: any) => {
		setActiveTab(tab);
	};

	const handleRequestResponseClick = (tab: string) => {
		setRequestResponseTab(tab);
	};

	const handleEventClick = (event: any) => {
		setSelectedEvent(event);
	};

	const getFilteredEvents = () => {
		if (activeTab === "All") {
			return allEvents;
		} else {
			return allEvents
				?.map((day) => {
					const filteredEvents = day?.dateEvents?.filter((event) =>
						activeTab === "Succeeded"
							? event.status === 200
							: event.status !== 200,
					);

					return filteredEvents.length > 0
						? { ...day, dateEvents: filteredEvents }
						: null;
				})
				.filter((day) => day !== null); // Remove any null entries
		}
	};

	const filteredEvents = getFilteredEvents();

	const transformWebhookData = (
		inputData: getWebhookEventLogsResponse | undefined,
	) => {
		const events: Array<{ date: string; dateEvents: DateEventObject[] }> = [];

		const logs = inputData?.data?.logs;
		const groupedLogs = logs?.reduce((acc: Record<string, any[]>, log) => {
			const date = new Date(log.timestamp).toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});

			if (!acc[date]) {
				acc[date] = [];
			}

			acc[date].push({
				id: String(log.id),
				name: log.event,
				time: new Date(log.timestamp).toLocaleTimeString("en-US", {
					hour: "numeric",
					minute: "numeric",
					second: "numeric",
					hour12: true,
				}),
				status: log.status,
				response: log.response,
				msg_id: log.msg_id,
				payload: log.payload,
			});

			return acc;
		}, {});

		for (const [date, dateEvents] of Object.entries(groupedLogs ?? {})) {
			events.push({
				date,
				dateEvents,
			});
		}

		return events;
	};

	useEffect(() => {
		if (webhookEventLogsData) {
			setAllEvents(transformWebhookData(webhookEventLogsData));
			setSelectedEvent(
				transformWebhookData(webhookEventLogsData)?.[0]?.dateEvents?.[0],
			);
			setActiveTab("All");
		}
	}, [webhookEventLogsData]);

	useEffect(() => {
		setSelectedEvent(filteredEvents?.[0]?.dateEvents[0] ?? null);
	}, [activeTab]);

	useEffect(() => {
		if (resendMessageLogError) {
			errorHandler(resendMessageLogError);
		}
	}, [resendMessageLogError]);

	useEffect(() => {
		if (resendMessageLogData) successHandler(resendMessageLogData);
	}, [resendMessageLogData]);

	const renderObject = (
		obj: Record<string, unknown>,
		indent: number = 0,
		lineNumber: { current: number } = { current: 1 },
	): React.JSX.Element => {
		const lines: React.JSX.Element[] = [];

		// Check if the object is actually an array
		const isArray = Array.isArray(obj);
		const openBracket = isArray ? "[" : "{";
		const closeBracket = isArray ? "]" : "}";

		// Add the opening bracket/brace with line number
		const openBraceLineNum = lineNumber.current++;
		lines.push(
			<div className="flex text-sm" key={`line-${openBraceLineNum}-open`}>
				<span style={{ marginRight: "8px", color: "gray" }}>
					{openBraceLineNum}
				</span>
				<div style={{ marginLeft: `${indent}px` }}>{openBracket}</div>
			</div>,
		);

		if (isArray) {
			// Handle arrays: iterate over elements
			(obj as unknown[]).forEach((value, index, array) => {
				const isLastElement = index === array.length - 1;

				if (typeof value === "object" && value !== null) {
					// Recurse for nested objects/arrays
					const nested = renderObject(
						value as Record<string, unknown>,
						indent + 20,
						lineNumber,
					);

					// *** FIX: append comma on the SAME LINE as closing bracket ***
					if (!isLastElement) {
						const last =
							nested.props.children[nested.props.children.length - 1];
						const updatedLast = React.cloneElement(last, {
							children: [
								last.props.children[0],
								React.cloneElement(last.props.children[1], {
									children: (
										<>
											{last.props.children[1].props.children}
											<span>,</span>
										</>
									),
								}),
							],
						});

						lines.push(
							<div key={`nested-${index}`}>
								{nested.props.children.slice(0, -1)}
								{updatedLast}
							</div>,
						);
					} else {
						lines.push(nested);
					}
				} else {
					// Add primitive values
					const primitiveLineNum = lineNumber.current++;
					lines.push(
						<div
							className="flex text-sm"
							key={`line-${primitiveLineNum}-arr-primitive`}
						>
							<span style={{ marginRight: "8px", color: "gray" }}>
								{primitiveLineNum}
							</span>
							<div style={{ marginLeft: `${indent + 20}px` }}>
								<span>
									{typeof value === "string" ? `"${value}"` : String(value)}
									{!isLastElement ? "," : ""}
								</span>
							</div>
						</div>,
					);
				}
			});
		} else {
			// Handle objects: iterate over the keys
			Object.entries(obj).forEach(([key, value], index, array) => {
				const isLastKey = index === array.length - 1;

				if (typeof value === "object" && value !== null) {
					// Add key and recurse for nested objects/arrays
					const keyLineNum = lineNumber.current++;
					lines.push(
						<div className="flex text-sm" key={`line-${keyLineNum}-key-${key}`}>
							<span style={{ marginRight: "8px", color: "gray" }}>
								{keyLineNum}
							</span>
							<div style={{ marginLeft: `${indent + 20}px` }}>
								"<span>{key}</span>":
							</div>
						</div>,
					);

					const nested = renderObject(
						value as Record<string, unknown>,
						indent + 20,
						lineNumber,
					);

					// *** FIX: append comma on SAME LINE ***
					if (!isLastKey) {
						const last =
							nested.props.children[nested.props.children.length - 1];

						const updatedLast = React.cloneElement(last, {
							children: [
								last.props.children[0],
								React.cloneElement(last.props.children[1], {
									children: (
										<>
											{last.props.children[1].props.children}
											<span>,</span>
										</>
									),
								}),
							],
						});

						lines.push(
							<div key={`nested-obj-${index}`}>
								{nested.props.children.slice(0, -1)}
								{updatedLast}
							</div>,
						);
					} else {
						lines.push(nested);
					}
				} else {
					// Add key-value pairs
					const valueLineNum = lineNumber.current++;
					lines.push(
						<div
							className="flex text-sm"
							key={`line-${valueLineNum}-value-${key}`}
						>
							<span style={{ marginRight: "8px", color: "gray" }}>
								{valueLineNum}
							</span>
							<div style={{ marginLeft: `${indent + 20}px` }}>
								<span>
									"{key}":{" "}
									{typeof value === "string" ? `"${value}"` : String(value)}
									{!isLastKey ? "," : ""}
								</span>
							</div>
						</div>,
					);
				}
			});
		}

		// Add the closing bracket/brace with line number
		const closeBraceLineNum = lineNumber.current++;
		lines.push(
			<div className="flex text-sm" key={`line-${closeBraceLineNum}-close`}>
				<span style={{ marginRight: "8px", color: "gray" }}>
					{closeBraceLineNum}
				</span>
				<div style={{ marginLeft: `${indent}px` }}>{closeBracket}</div>
			</div>,
		);

		return <div>{lines}</div>;
	};

	return (
		<>
			<div className="p-6 pt-5 bg-white rounded-b-3xl ">
				{isLoading || resendMessageLogLoading ? (
					<div className="flex justify-center my-2 text-base font-medium text-center text-red-500">
						<TableLoader />
					</div>
				) : (
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-0">
						<div className="overflow-y-auto max-h-[400px] scrollbar-thin">
							<div className="mb-6 space-x-4 border-b-2 ">
								{["All", "Succeeded", "Failed"].map((tab) => (
									<button
										key={tab}
										className={`text-sm py-2 border-b-2 ${
											activeTab === tab
												? "border-blue-600 text-blue-600 font-medium"
												: "border-transparent text-gray-500"
										} hover:border-blue-500 hover:text-blue-500 transition`}
										onClick={() => {
											handleTabClick(tab);
										}}
									>
										{tab}
									</button>
								))}
							</div>
							<div className="col-span-1">
								{filteredEvents && filteredEvents?.length > 0 ? (
									filteredEvents?.map((day, index) => (
										<div key={index} className="mb-6">
											<h4 className="mb-2 text-xs font-normal text-gray-500">
												{day?.date}
											</h4>
											<div className="space-y-2 rounded-lg ">
												{day?.dateEvents?.map((event) => (
													<div
														key={event?.id}
														className={`flex justify-between items-center px-4 py-2 rounded-lg cursor-pointer transition ${
															selectedEvent?.id === event?.id
																? "bg-blue-100"
																: "hover:bg-blue-50"
														}`}
														onClick={() => {
															handleEventClick(event);
														}}
													>
														<div className="flex items-center justify-start">
															{event?.status === 200 ? (
																<CheckCircleIcon className="w-4 h-4 mr-2 font-medium text-green-700" />
															) : (
																<XCircleIcon className="w-4 h-4 mr-2 text-red-600" />
															)}
															<span
																className={`${
																	selectedEvent?.id === event?.id
																		? "text-blue-600"
																		: ""
																} text-sm`}
															>
																{event.name}
															</span>
														</div>
														<span
															className={`${
																selectedEvent?.id === event?.id
																	? "text-blue-600"
																	: ""
															} text-sm`}
														>
															{event?.time}
														</span>
													</div>
												))}
											</div>
										</div>
									))
								) : (
									<div className="flex items-center justify-center h-40 text-gray-500">
										No events found!!
									</div>
								)}
							</div>
						</div>
						<div className="mx-4 p-6 bg-gray-100 rounded-3xl max-h-[400px] min-h-[300px] overflow-x-auto scrollbar-thin">
							{["Request", "Response"].map((tab) => (
								<button
									key={tab}
									className={twMerge(
										`text-sm py-2 border-b-2 mx-2 hover:text-blue-500 transition`,
										requestResponseTab === tab
											? "border-blue-600 text-blue-600 font-semibold"
											: "border-[#f3f4f6]",
									)}
									onClick={() => {
										handleRequestResponseClick(tab);
									}}
								>
									{tab}
								</button>
							))}
							<div className="border-b border-[#e9ebee]"></div>
							{requestResponseTab === "Request" && selectedEvent && (
								<div className="pl-2 mt-2">
									<div className="flex items-center justify-between mb-4">
										<h4 className="pr-3 text-base font-semibold text-gray-900">
											{selectedEvent?.name}
										</h4>

										{selectedEvent?.status !== 200 && (
											<Button
												onClick={async () => {
													await resendLog({
														customerId,
														endpointId: slug ?? "",
														messageId: selectedEvent?.msg_id ?? "",
													}).then(async (e) => {
														setTimeout(() => {
															void refetchEventLogs();
														}, 2000);
													});
												}}
												className="px-3.5 h-[32px] py-1 items-center justify-center text-sm font-medium text-blue-600 bg-white border border-gray-200 rounded-lg hover:bg-blue-50"
											>
												Resend
											</Button>
										)}
									</div>
									{selectedEvent && renderObject(selectedEvent?.payload)}
								</div>
							)}
							{requestResponseTab === "Response" && selectedEvent ? (
								<div className="pl-2 mt-2">
									<div className="flex items-center justify-between mb-4">
										<h4 className="pr-3 text-base font-semibold text-gray-900">
											{selectedEvent?.name}
										</h4>
										{selectedEvent?.status !== 200 && (
											<Button
												onClick={async () => {
													await resendLog({
														customerId,
														endpointId: slug ?? "",
														messageId: selectedEvent?.msg_id,
													}).then(async (e) => {
														setTimeout(() => {
															void refetchEventLogs().then(() => {});
														}, 2000);
													});
												}}
												className="px-3.5 py-1.5 text-sm font-medium text-blue-600 bg-white border border-gray-200 rounded-lg hover:bg-blue-50"
											>
												Resend
											</Button>
										)}
									</div>
									<p className="py-2 pl-10 text-sm text-gray-500">
										HTTP status code{" "}
										<span className="ml-10 font-semibold text-gray-900">
											{selectedEvent?.status} (
											{selectedEvent?.status === 200 ? "OK" : "ERROR"})
										</span>
									</p>
									{/* This should not be indented as displayed inside pre */}
									<pre className="py-4 text-sm text-gray-800 bg-gray-100 rounded-lg">
										<span className="text-gray-500">1</span>
										{` {`}
										{`
`}
										<span className="text-gray-500">2</span>
										{`   "status": "`}
										<span
											className={
												selectedEvent?.status === 200
													? "text-green-500"
													: "text-red-500"
											}
										>
											{selectedEvent?.status === 200 ? "success" : "failed"}
										</span>
										{`",`}
										{`
`}
										<span className="text-gray-500">3</span>
										{`   "message": "${
											typeof selectedEvent.response === "string"
												? String(selectedEvent?.response)
												: typeof selectedEvent?.response?.error?.message ===
													  "string"
													? String(selectedEvent?.response?.error?.message)
													: JSON.stringify(selectedEvent?.response)
										}",
`}
										<span className="text-gray-500">4</span>
										{`   "data": {
`}
										<span className="text-gray-500">5</span>
										{`   }
`}
										<span className="text-gray-500">6</span>
										{` }`}
									</pre>
								</div>
							) : (
								<></>
							)}
						</div>
					</div>
				)}
			</div>
		</>
	);
};

export default WebhookDetailHistory;
