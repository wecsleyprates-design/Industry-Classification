import React, { useEffect, useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useGetBusinessWebsiteScreenshotUrl } from "@/services/queries/integration.query";

import { formatUrl } from "@/helpers";

interface WebsitePageInfo {
	title: string;
	url: string;
	status: "online" | "offline" | "unknown";
	screenshot: string;
	description: string;
	isS3?: boolean;
}

const extractS3Key = (s3Url: string): string => {
	try {
		const url = new URL(s3Url);
		return url.pathname.substring(1); // remove leading slash
	} catch (error) {
		console.error("Invalid S3 URL", error);
		return "";
	}
};

export const WebsitePageItem: React.FC<{ page: WebsitePageInfo }> = ({
	page,
}) => {
	const [signedUrl, setSignedUrl] = useState<string>(page.screenshot);
	const [imageError, setImageError] = useState(false);

	const { data: signedUrlResponse, isLoading: loadingSignedUrl } =
		useGetBusinessWebsiteScreenshotUrl(page.isS3 ? page.screenshot : "");

	useEffect(() => {
		if (page.isS3 && signedUrlResponse?.data?.url) {
			if (signedUrl !== signedUrlResponse.data.url) {
				setSignedUrl(signedUrlResponse.data.url);
			}
		} else {
			if (signedUrl !== page.screenshot) {
				setSignedUrl(page.screenshot);
			}
		}
	}, [signedUrlResponse, page.isS3, page.screenshot, signedUrl]);

	return (
		<div className="mb-6 border border-gray-100 rounded-2xl">
			{!imageError && !loadingSignedUrl ? (
				<img
					src={signedUrl}
					alt={`Screenshot of ${page.title}`}
					onError={() => {
						setImageError(true);
					}}
					style={{
						borderTopLeftRadius: ".95rem",
						borderTopRightRadius: ".95rem",
					}}
					className="object-cover object-top w-full h-64 border border-gray-100"
				/>
			) : (
				<div className="flex items-center justify-center w-full h-64 bg-gray-100 border border-gray-200">
					<div className="text-center text-gray-400">
						<svg
							className="w-12 h-12 mx-auto"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						<p className="mt-2">Screenshot not available</p>
					</div>
				</div>
			)}

			<div
				className="flex flex-col gap-4 p-4 border border-gray-100 border-t-1"
				style={{
					borderBottomLeftRadius: ".95rem",
					borderBottomRightRadius: ".95rem",
				}}
			>
				<div className="flex items-center space-x-2">
					<h4 className="text-xl font-semibold">{page.title}</h4>
				</div>
				<p className="m-0 text-sm text-gray-600 line-clamp-1">
					{page.description}
				</p>
				<div className="border border-gray-200 rounded-md">
					{page.url !== "url not available" ? (
						<a
							href={page.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-center p-4 text-sm text-blue-600 hover:underline"
						>
							<span>
								{page.url?.length > 80
									? `${page.url.slice(0, 80)}...`
									: page.url}
							</span>
							<ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
						</a>
					) : (
						<div className="flex items-center justify-center p-4 text-sm text-gray-400">
							URL not available
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

/**
 * Helper function to transform API page data into WebsitePageInfo format
 */
export const transformWebsitePage = (page: any): WebsitePageInfo => {
	const originalUrl = page.screenshot_url ?? "";
	const isS3 =
		originalUrl.includes(".s3.") || originalUrl.includes(".amazonaws.com");
	const s3Key = isS3 ? extractS3Key(originalUrl) : originalUrl;
	const pageUrl = formatUrl(page.url);

	return {
		title: page.category ?? "title not available",
		url: pageUrl ?? "url not available",
		status: (page.category?.toLowerCase() === "online"
			? "online"
			: "offline") as "online" | "offline" | "unknown",
		screenshot: s3Key,
		description: page.text ?? "description not available",
		isS3,
	};
};
