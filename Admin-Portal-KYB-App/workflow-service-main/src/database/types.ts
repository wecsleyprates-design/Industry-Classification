import { type QueryArrayResult, type QueryResultRow } from "pg";

export interface SqlQueryResult<T = unknown> {
	rows: T[];
	rowCount: number;
	command: string;
	oid: number;
	fields: QueryResultRow[];
}

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseError";
	}
}

export interface TransactionClient {
	query: (text: string, params?: unknown[]) => Promise<QueryArrayResult<unknown[]>>;
	release: () => void;
}

export interface DatabaseConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	maxConnections: number;
	idleTimeoutMillis: number;
	connectionTimeoutMillis: number;
	ssl?: boolean | { rejectUnauthorized: boolean };
}
