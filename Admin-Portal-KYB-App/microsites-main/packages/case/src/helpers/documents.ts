import axios from "axios";
import { api } from "@/lib/api";

import MICROSERVICE from "@/constants/Microservices";

/**
 * Downloads a file from a given URL using axios to fetch the content as a blob.
 *
 * @param file - The URL of the file to download.
 * @param fileName - The name of the downloaded file.
 */
export const downloadFile = async (
	file: string,
	fileName: string,
	filePath?: string,
): Promise<void> => {
	try {
		let response;

		// Try downloading file with signed URL
		response = await axios
			.get(file, {
				responseType: "blob",
			})
			.catch(() => null);

		if (filePath && !response) {
			response = await api.get(
				`${MICROSERVICE.INTEGRATION}/documents/download/`,
				{
					responseType: "blob",
					params: {
						file_name: fileName,
						file_path: filePath,
					},
				},
			);
		}

		if (!response) {
			throw new Error("Unable to download file with signed URL or path");
		}

		const blob = new Blob([response.data], {
			type: response.headers["content-type"],
		});
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.setAttribute("download", fileName);
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.URL.revokeObjectURL(url);
	} catch (error) {
		// If the download fails, open the file in a new tab as a fallback.
		window.open(file, "_blank");
		console.error("File download failed:", error);
	}
};

/**
 *
 * @param url - The URL from which to extract the file name.
 * @returns - The extracted file name from the URL, or null if it cannot be determined.
 *
 * Example:
 * Input: getFileNameFromUrl("https://example.com/path/to/file.pdf?query=123")
 * Output: "file.pdf"
 */
export const getFileNameFromUrl = (url: string): string | null => {
	return url.split("/")?.pop()?.split("?")?.shift() ?? null;
};
