import React from "react";
import cx from "classnames";
import { motion } from "framer-motion";
import { type Message } from "@/types/insights";

const lineVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.05, // Stagger the animation of children (words)
		},
	},
};

const wordVariants = {
	hidden: {
		opacity: 0,
		color: "#CC99FF", // Start with pink color when hidden
	},
	visible: (i: number) => ({
		opacity: 1,
		color: ["#CC99FF", "#FF6FBC", "#514754"], // End with white color
		transition: {
			delay: i * 0.05, // Delay based on the word index to maintain staggering
			opacity: { duration: 0.5 }, // Duration of the opacity animation
			color: {
				duration: 1, // Extend the duration of the color transition
				times: [0, 0.2, 1], // Stay pink for 20% of the transition duration before changing to white
			}, // Color transition duration and delay
		},
	}),
};

export const RenderMessageContent = ({ msg }: { msg: Message }) => {
	if (msg.role === "assistant") {
		// Check if the message content contains a table
		const isTable = msg.content.includes("|") && msg.content.includes("-");

		if (isTable) {
			// Split the content into lines
			const lines = msg.content.split("\n");
			// Find the index where the table starts and ends
			const tableStartIndex =
				lines.findIndex((line) => line.includes("|") && line.includes("-")) - 1;
			const tableEndIndex =
				lines.slice(tableStartIndex).findIndex((line) => !line.includes("|")) +
				tableStartIndex;

			// Separate the intro, table, and outro content
			const introLines = lines.slice(0, tableStartIndex);
			const tableLines = lines.slice(tableStartIndex, tableEndIndex);
			const outroLines = lines.slice(tableEndIndex);

			// Extract the header row and skip the separator line
			const headerRow = tableLines[0].split("|").filter(Boolean);
			const tableContent = tableLines.slice(2); // Skip the separator line

			return (
				<div>
					{/* Render the intro text */}
					{introLines.map((line, index) => (
						<p key={index}>{line}</p>
					))}
					{/* Render the table */}
					<div className="overflow-x-auto">
						<table className="table-auto border-collapse border border-gray-300">
							<thead>
								<tr className="border border-gray-300">
									{headerRow.map((header, index) => (
										<th key={index} className="border border-gray-300 p-2">
											{header.replace(/\*\*/g, "").trim()}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{tableContent.map((line, lineIndex) => {
									// Split each line into cells
									const cells = line.split("|").filter(Boolean);
									return (
										<tr key={lineIndex} className="border border-gray-300">
											{cells.map((cell, cellIndex) => (
												<td
													key={cellIndex}
													className="border border-gray-300 p-2"
												>
													{cell
														.trim()
														.split(/(<br>)/)
														.filter(Boolean)
														.map((part, partIndex) => {
															// Check if the part should be bold
															const isBold =
																part.startsWith("**") && part.endsWith("**");
															const cleanPart = isBold
																? part.slice(2, -2)
																: part; // Remove markdown bold syntax
															return (
																<React.Fragment key={partIndex}>
																	{part === "<br>" ? (
																		<br />
																	) : (
																		<span className={cx(isBold && "font-bold")}>
																			{cleanPart.trim()}
																		</span>
																	)}
																</React.Fragment>
															);
														})}
												</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					{/* Render the outro text */}
					{outroLines.map((line, index) => (
						<p key={index}>{line}</p>
					))}
				</div>
			);
		} else {
			// Split the message content into lines to preserve line breaks
			const lines = msg.content.split(/(?<=:)\s|\n/);
			return (
				<motion.div
					initial="hidden"
					animate="visible"
					variants={lineVariants}
					style={{ display: "flex", flexDirection: "column", flexWrap: "wrap" }}
				>
					{lines.map((line, lineIndex) => {
						// Check if the line is a header
						const headerMatch = line.match(/^(#{1,5})\s*(.*)/);
						if (headerMatch) {
							const headerLevel = headerMatch[1].length;
							const headerText = headerMatch[2];
							const HeaderTag =
								`h${headerLevel}` as keyof React.JSX.IntrinsicElements;

							return (
								<motion.div
									key={lineIndex}
									variants={wordVariants}
									className="my-2"
								>
									<HeaderTag className="text-lg font-semibold text-[#FF6FBC]">
										{headerText}
									</HeaderTag>
								</motion.div>
							);
						}

						// Split line into words to apply typewriter effect to each word
						// Also, detect and handle bold text
						const words = line
							.split(/(\*\*.*?\*\*)|\s/)
							.filter(Boolean)
							.map((word, wordIndex) => {
								// Check if the word should be bold
								const isBold = word.startsWith("**") && word.endsWith("**");
								const cleanWord = isBold ? word.slice(2, -2) : word; // Remove markdown bold syntax
								return (
									<motion.span
										key={`${lineIndex}-${wordIndex}`}
										variants={wordVariants}
										className={cx(
											"inline-block mr-[5px]",
											isBold && "font-bold",
										)}
									>
										{cleanWord.split("<br>").map((part, partIndex) => (
											<React.Fragment key={partIndex}>
												{part.trim()}
												{partIndex < cleanWord.split("<br>").length - 1 && (
													<br />
												)}
											</React.Fragment>
										))}
									</motion.span>
								);
							});

						// Return the line with preserved formatting and animation
						return (
							<span key={lineIndex} className="flex flex-wrap">
								{words}
							</span>
						);
					})}
				</motion.div>
			);
		}
	} else {
		return <span>{msg.content}</span>;
	}
};
