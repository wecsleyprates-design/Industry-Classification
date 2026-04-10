import "express";

declare module "express-serve-static-core" {
	interface Response {
		jsend: {
			success: (data: unknown, message?: string, statusCode?: number) => void;
			fail: (message: string, data: unknown, errorCode?: number | null, statusCode?: number) => void;
			error: (message: string, statusCode?: number, errorCode?: number | null, data?: unknown) => void;
		};
	}
}
