/**
 * Types for middleware functions
 */

export interface ThrottleOptions {
	maxRequests: number;
	windowMs: number;
	endpointKey?: string;
}

export interface ThrottleStores {
	[endpointKey: string]: {
		[userId: string]: number[];
	};
}
