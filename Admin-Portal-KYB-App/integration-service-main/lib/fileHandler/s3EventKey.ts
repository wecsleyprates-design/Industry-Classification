/**
 * Normalize object keys from S3-style notifications (Kafka / HTTP relay).
 * Spaces are often serialized as "+" (application/x-www-form-urlencoded). Literal "+"
 * in the actual S3 key is represented as "%2B" in encoded payloads — that sequence
 * contains no ASCII "+", so replacing "+" with space before decodeURIComponent does
 * not turn a real plus into a space.
 */
export function normalizeS3EventFileKey(fileKey: string): string {
	if (!fileKey) {
		return fileKey;
	}
	const normalizedKey = fileKey.replace(/\+/g, " ");
	try {
		return decodeURIComponent(normalizedKey);
	} catch {
		return normalizedKey;
	}
}
