import type { OpenAPIV3 } from "openapi-types";

const triggersOpenAPI: OpenAPIV3.PathsObject = {
	"/triggers": {
		get: {
			tags: ["Triggers"],
			summary: "Get all workflow triggers",
			description:
				"Retrieves a list of all available workflow triggers. In the MVP phase, this returns seeded trigger data.",
			operationId: "getTriggers",
			responses: {
				"200": {
					description: "Successfully retrieved triggers",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										example: "success"
									},
									data: {
										type: "object",
										properties: {
											triggers: {
												type: "array",
												items: {
													type: "object",
													properties: {
														id: {
															type: "string",
															format: "uuid",
															description: "Unique identifier for the trigger"
														},
														name: {
															type: "string",
															description: "Human-readable name of the trigger",
															example: "On Boarding"
														},
														conditions: {
															type: "object",
															description: "JSONB logical conditions to activate workflow(s)",
															example: {
																operator: "AND",
																conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
															}
														},
														created_at: {
															type: "string",
															format: "date-time",
															description: "Timestamp when the trigger was created"
														},
														updated_at: {
															type: "string",
															format: "date-time",
															description: "Timestamp when the trigger was last updated"
														}
													},
													required: ["id", "name", "conditions", "created_at", "updated_at"]
												}
											},
											total: {
												type: "integer",
												description: "Total number of triggers returned",
												example: 1
											}
										},
										required: ["triggers", "total"]
									},
									message: {
										type: "string",
										example: "Triggers retrieved successfully"
									}
								},
								required: ["status", "data", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal server error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal Server Error"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		}
	}
};

export default triggersOpenAPI;
