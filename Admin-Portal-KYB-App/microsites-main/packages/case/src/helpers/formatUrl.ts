export const formatUrl = (url?: string) => {
	if (!url) return "";

	return url.startsWith("http") ? url : `https://${url}`;
};
