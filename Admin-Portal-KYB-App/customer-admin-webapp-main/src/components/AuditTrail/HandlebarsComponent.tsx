import React, { useEffect, useState } from "react";
import { generatePath } from "react-router";
import Handlebars from "handlebars";
import useCustomToast from "@/hooks/useCustomToast";
import { getSlugReplacedURL } from "@/lib/helper";

import { URL } from "@/constants/URL";

interface HandlebarsComponentProps {
	templateStyle: string;
	templateVariables: Record<string, unknown>;
	hyperLinkVariable: string[];
	attachments?: Array<{
		file_name: string;
		file_details: { signedRequest?: string };
	}>;
}

// Extend the Window interface
declare global {
	interface Window {
		showCustomToast: () => void;
	}
}

// Register a custom Handlebars helper to create a hyperlink
const registerHelpers = (variables: string[]) => {
	variables.forEach((variable) => {
		Handlebars.registerHelper(
			variable,
			function (context: Record<string, unknown>) {
				const {
					[variable]: id,
					link,
					case_id: caseId,
					business_id: businessId,
					invitation_id: invitationId,
				} = context;
				if (id) {
					return new Handlebars.SafeString(
						`<a href="${String(
							variable === "case_id"
								? generatePath(URL.CASE_DETAILS_V2, {
										id: String(caseId ?? ""),
										mainTab: null,
										subTab: null,
									})
								: variable === "invitation_id"
									? getSlugReplacedURL(
											URL.BUSINESS_INVITEE_DETAILS,
											[String(businessId), String(invitationId)],
											[":slug", ":inviteeId"],
										)
									: variable === "invitation_id"
										? getSlugReplacedURL(
												URL.BUSINESS_DETAILS,
												String(businessId),
											)
										: link,
						)}" style="color: #2563eb;" target="_blank">${String(id)}</a>`,
					);
				}
				return "";
			},
		);
	});
};

// Register a custom Handlebars helper for attachments
const registerAttachmentHelper = (
	errorHandler: (message: { message: string }) => void,
) => {
	Handlebars.registerHelper("attachments", function (context) {
		const { attachments } = context.data.root;
		if (attachments?.length) {
			const attachmentLinks = attachments.map((attachment: any) => {
				if (attachment.file_details.signedRequest) {
					return `<a href="${String(
						attachment.file_details.signedRequest,
					)}" style="color: #2563eb;" target="_blank">${String(
						attachment.file_name,
					)}</a>`;
				} else {
					return `<a href="javascript:void(0)" style="color: #2563eb;" onclick="window.showCustomToast()">${String(
						attachment.file_name,
					)}</a>`;
				}
			});
			return new Handlebars.SafeString(attachmentLinks.join(", "));
		}
		return "";
	});

	// Make the toast handler globally accessible
	window.showCustomToast = () => {
		errorHandler({ message: "URL not found" });
	};
};

const HandlebarsComponent: React.FC<HandlebarsComponentProps> = ({
	templateStyle,
	templateVariables,
	hyperLinkVariable,
	attachments,
}) => {
	const [html, setHtml] = useState<string>("");
	const { errorHandler } = useCustomToast();

	useEffect(() => {
		// Register the helpers
		registerHelpers(hyperLinkVariable);
		registerAttachmentHelper(errorHandler);

		const fetchTemplate = async () => {
			// Compile the template string
			const template = Handlebars.compile(templateStyle);

			// Render the template with the provided variables and attachments
			const htmlContent = template({
				...templateVariables,
				attachments,
			});

			// Update the state with the rendered HTML
			setHtml(htmlContent);
		};

		void fetchTemplate();
	}, [
		templateStyle,
		templateVariables,
		hyperLinkVariable,
		attachments,
		errorHandler,
	]);

	return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export default HandlebarsComponent;
