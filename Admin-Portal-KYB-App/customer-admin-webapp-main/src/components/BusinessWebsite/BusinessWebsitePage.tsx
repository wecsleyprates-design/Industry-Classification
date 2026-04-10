import React, { type FC, useEffect, useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import PhotoSlashIcon from "@/assets/svg/PhotoSlashIcon";
import { capitalize } from "@/lib/helper";
import { useGetBusinessWebsiteScreenshotUrl } from "@/services/queries/integration.query";
import { type Page } from "@/types/integrations";
import TableLoader from "../Spinner/TableLoader";

interface Props {
	businessWebsitePageData?: Page;
}

const BusinessWebsitePage: FC<Props> = ({ businessWebsitePageData }) => {
	const [imageUrl, setImageUrl] = useState<string>(
		businessWebsitePageData?.screenshot_url ?? "",
	);
	const extractS3Key = (s3Url: string): string => {
		try {
			const url = new URL(s3Url);
			// Remove leading slash from pathname
			return url.pathname.substring(1);
		} catch (error) {
			console.error("Failed to parse S3 URL:", error);
			return "";
		}
	};

	const isS3 =
		imageUrl &&
		(imageUrl.includes(".s3.") || imageUrl.includes(".amazonaws.com"));
	const s3Key = isS3 ? extractS3Key(imageUrl) : "";

	const {
		data: signedUrlResponse,
		isLoading: loadingSignedUrl,
		isError,
	} = useGetBusinessWebsiteScreenshotUrl(s3Key);

	useEffect(() => {
		if (isError) {
			setImageUrl("");
			return;
		}
		if (isS3 && signedUrlResponse) {
			setImageUrl(signedUrlResponse.data.url);
		} else if (businessWebsitePageData?.screenshot_url) {
			setImageUrl(businessWebsitePageData.screenshot_url);
		} else {
			setImageUrl("");
		}
	}, [loadingSignedUrl]);

	if (!businessWebsitePageData) {
		return null;
	}

	const RenderScreenshot = () => {
		if (isS3 && loadingSignedUrl) {
			return (
				<div className="flex items-center justify-center bg-gray-100 h-[200px]">
					<TableLoader />
				</div>
			);
		}

		return imageUrl ? (
			<img
				src={imageUrl}
				alt="Website screenshot"
				className="object-cover w-full h-[200px]"
			/>
		) : (
			<div className="flex items-center justify-center bg-gray-200 h-[200px]">
				<PhotoSlashIcon />
			</div>
		);
	};

	return (
		<div
			className="container mb-6 border rounded-xl overflow-clip"
			key={businessWebsitePageData.url}
		>
			<div className="h-[200px] border-b">
				<RenderScreenshot />
			</div>
			<div className="px-6 py-6">
				<div className="text-base font-medium text-gray-800">
					{capitalize(businessWebsitePageData.category)}
				</div>
				{businessWebsitePageData.text && (
					<p className="pr-3 mt-2 text-sm font-normal text-gray-500 truncate">
						{businessWebsitePageData.text}
					</p>
				)}
				<a
					target="_blank"
					href={
						businessWebsitePageData.url?.startsWith("http")
							? businessWebsitePageData.url
							: `http://${businessWebsitePageData.url}`
					}
					rel="noopener noreferrer"
					className="flex items-center justify-center w-full p-2 mt-6 text-sm font-medium text-blue-600 border border-gray-200 rounded-lg"
				>
					<div className="break-words truncate w-fit overflow-wrap">
						{businessWebsitePageData.url}
					</div>
					<ArrowTopRightOnSquareIcon className="h-4 ml-2 text-blue-600 min-w-4" />
				</a>
			</div>
		</div>
	);
};

export default BusinessWebsitePage;
