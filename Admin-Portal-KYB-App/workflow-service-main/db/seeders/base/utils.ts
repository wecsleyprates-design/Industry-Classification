/**
 * Utility functions for seeders
 *
 * Common helper functions that can be reused across different seeders.
 */

/**
 * Splits an array into chunks of a specified size
 * Useful for processing large datasets in batches to manage memory
 *
 * @param array - The array to chunk
 * @param size - The size of each chunk
 * @returns Array of chunks
 *
 * @example
 * chunkArray([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}
