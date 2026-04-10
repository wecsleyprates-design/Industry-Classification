import express, { type Router, Request, Response, NextFunction } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import useragent from "express-useragent";
import swaggerUi from "swagger-ui-express";

import { pinoHttpLogger } from "#helpers";
import { errorMiddleware } from "#middlewares";
import { jsend } from "#utils";
import openapi from "./openapi/index";
import apiRoutes from "./api/index";
import { envConfig } from "#configs";

const corsOptions: CorsOptions = {
	origin: [
		/^https:\/\/[a-zA-Z0-9-]+(?:\.dev|\.staging|\.qa[1-5]?)?\.joinworth\.com$/u,
		...(envConfig.FRONTEND_LOCAL_BASE_URLS ?? "").split(",").filter(Boolean)
	],
	credentials: true
};

const app = express();
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "20MB" }));
app.use(jsend());
app.use(express.urlencoded({ extended: true, limit: "50MB" }));
app.use(cookieParser());
app.use(pinoHttpLogger);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.static(path.join(__dirname, "..", ".data")));
app.use(express.static(path.join(__dirname, "..", "logs")));
app.use(useragent.express());
app.use((req, _res, next) => {
	if (req.useragent !== null && req.useragent !== undefined) {
		(req.useragent as Partial<useragent.Details>) = {
			browser: req.useragent.browser,
			version: req.useragent.version,
			os: req.useragent.os,
			platform: req.useragent.platform,
			source: req.useragent.source
		};
	}
	next();
});

app.get("/favicon.ico", (_req, res) => res.status(204).end());

// Setup OpenAPI documentation
app.use("/api-docs", swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
	const host = req.headers.host as string;
	let serverUrl = "";

	if (host?.includes("dev.joinworth.com")) {
		serverUrl = "https://api.dev.joinworth.com/workflow/api/v1";
	} else if (host?.includes("staging.joinworth.com")) {
		serverUrl = "https://api.staging.joinworth.com/workflow/api/v1";
	} else if (host?.includes("qa.joinworth.com")) {
		serverUrl = "https://api.qa.joinworth.com/workflow/api/v1";
	} else if (host?.includes("joinworth.com")) {
		serverUrl = "https://api.joinworth.com/workflow/api/v1";
	} else {
		serverUrl = `http://localhost:${envConfig.APP_PORT}/api/v1`;
	}
	swaggerUi.setup(openapi(serverUrl), {
		explorer: true,
		customCss: ".swagger-ui .topbar { display: none }",
		customSiteTitle: "Workflow Service API Documentation",
		customfavIcon: "/favicon.ico",
		swaggerOptions: {
			persistAuthorization: true,
			displayRequestDuration: true,
			filter: true,
			showExtensions: true,
			showCommonExtensions: true
		}
	})(req, res, next);
});

app.get("/api-docs.json", (req: Request, res: Response) => {
	const host = req.headers.host as string;
	let serverUrl = "";

	if (host?.includes("dev.joinworth.com")) {
		serverUrl = "https://api.dev.joinworth.com/workflow/api/v1";
	} else if (host?.includes("staging.joinworth.com")) {
		serverUrl = "https://api.staging.joinworth.com/workflow/api/v1";
	} else if (host?.includes("qa.joinworth.com")) {
		serverUrl = "https://api.qa.joinworth.com/workflow/api/v1";
	} else if (host?.includes("joinworth.com")) {
		serverUrl = "https://api.joinworth.com/workflow/api/v1";
	} else {
		serverUrl = `http://localhost:${envConfig.APP_PORT}/api/v1`;
	}
	res.json(openapi(serverUrl));
});

// Redirect root API docs to Swagger UI
app.get("/docs", (req, res) => {
	res.redirect("/api-docs");
});

app.use("/api", apiRoutes as Router);
app.use("/", (_req, res) => {
	res.json({
		info: "Workflow Service API server. Please visit /api-docs for API documentation or /api/health for health check."
	});
});

app.use(((err: Error, req: Request, res: Response, _next: NextFunction) => {
	errorMiddleware(err, req, res);
}) as express.ErrorRequestHandler);

export { app };
