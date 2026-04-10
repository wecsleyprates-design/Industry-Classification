/**
 * Determines if a URL is a direct business link based on common entity identifiers
 * or numeric IDs in query string or path.
 */
export const isDirectBusinessLink = ({ url }: { url: string }): boolean => {
	// Match common entity identifiers OR numeric IDs in query string or path
	const entityPattern =
		/(org=|corp=|businessID=|businessId=|p_corpid=|ID=|acct-number=|entityId=|CharterID=|filingGuid=|eFNum=|fileNumber=)/i;
	if (entityPattern.test(url)) return true;

	// Fallback: Check if URL ends with or contains a long numeric/alphanumeric ID (not just a page number)
	const idLikePattern = /[?&/=][A-Za-z0-9]*\d{4,}[A-Za-z0-9]*/;
	return idLikePattern.test(url);
};
