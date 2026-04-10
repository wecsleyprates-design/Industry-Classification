import { envConfig } from "#configs/index";
import { logger } from "#helpers";
import { CognitoJwtVerifier } from "aws-jwt-verify";

interface VerifierConfig {
	userPoolId: string;
	clientId: string;
	tokenUse: "access" | "id";
}

class Cognito {
	private userIdVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null;
	private userAccessVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null;
	private isUserVerifierInitialized: boolean;

	constructor() {
		this.userIdVerifier = null;
		this.userAccessVerifier = null;
		this.isUserVerifierInitialized = false;
	}

	initializeUserVerifiers(): void {
		if (!envConfig.APPLICANT_USER_POOL_ID || !envConfig.WORTH_ADMIN_USER_POOL_ID || !envConfig.CUSTOMER_USER_POOL_ID) {
			logger.warn("Cognito verifier environment variables not found, skipping verifier initialization");
			return;
		}

		try {
			// Create verifiers for each user pool
			const verifiers: VerifierConfig[] = [];

			if (envConfig.APPLICANT_USER_POOL_ID && envConfig.APPLICANT_CLIENT_ID) {
				verifiers.push({
					userPoolId: envConfig.APPLICANT_USER_POOL_ID,
					clientId: envConfig.APPLICANT_CLIENT_ID,
					tokenUse: "access"
				});
			}

			if (envConfig.WORTH_ADMIN_USER_POOL_ID && envConfig.WORTH_ADMIN_CLIENT_ID) {
				verifiers.push({
					userPoolId: envConfig.WORTH_ADMIN_USER_POOL_ID,
					clientId: envConfig.WORTH_ADMIN_CLIENT_ID,
					tokenUse: "access"
				});
			}

			if (envConfig.CUSTOMER_USER_POOL_ID && envConfig.CUSTOMER_CLIENT_ID) {
				verifiers.push({
					userPoolId: envConfig.CUSTOMER_USER_POOL_ID,
					clientId: envConfig.CUSTOMER_CLIENT_ID,
					tokenUse: "access"
				});
			}

			this.userAccessVerifier = CognitoJwtVerifier.create(verifiers);

			// Create ID token verifiers
			const idVerifiers: VerifierConfig[] = [];

			if (envConfig.APPLICANT_USER_POOL_ID && envConfig.APPLICANT_CLIENT_ID) {
				idVerifiers.push({
					userPoolId: envConfig.APPLICANT_USER_POOL_ID,
					clientId: envConfig.APPLICANT_CLIENT_ID,
					tokenUse: "id"
				});
			}

			if (envConfig.WORTH_ADMIN_USER_POOL_ID && envConfig.WORTH_ADMIN_CLIENT_ID) {
				idVerifiers.push({
					userPoolId: envConfig.WORTH_ADMIN_USER_POOL_ID,
					clientId: envConfig.WORTH_ADMIN_CLIENT_ID,
					tokenUse: "id"
				});
			}

			if (envConfig.CUSTOMER_USER_POOL_ID && envConfig.CUSTOMER_CLIENT_ID) {
				idVerifiers.push({
					userPoolId: envConfig.CUSTOMER_USER_POOL_ID,
					clientId: envConfig.CUSTOMER_CLIENT_ID,
					tokenUse: "id"
				});
			}

			this.userIdVerifier = CognitoJwtVerifier.create(idVerifiers);

			this.isUserVerifierInitialized = true;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			logger.error("Failed to initialize Cognito verifiers:", errorMessage);
		}
	}

	async verifyCognitoToken(token: string, tokenUse: string): Promise<unknown> {
		if (!this.userIdVerifier) {
			this.initializeUserVerifiers();
		}
		if (!this.isUserVerifierInitialized) {
			throw new Error("Cognito verifiers not initialized - check environment variables");
		}

		const verifier = tokenUse === "access" ? this.userAccessVerifier : this.userIdVerifier;
		if (!verifier) {
			throw new Error(`No verifier available for token use: ${tokenUse}`);
		}

		return await verifier.verify(token);
	}
}

export const cognito = new Cognito();
