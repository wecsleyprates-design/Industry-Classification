import type { OpenAPIV3 } from "openapi-types";

export const auditOpenAPI: OpenAPIV3.PathsObject = {
	"/audit/customers/{customerId}/execution-logs": {
		get: {
			tags: ["Audit"],
			summary: "Export workflow execution logs as CSV",
			description:
				"Exports workflow execution logs as CSV. Logs are filtered by customer_id (from path parameter) and optionally by workflow_id and date range. Admin users can access any customer's logs, while customer users can only access their own. Rate limited to 10 requests per minute per user.",
			operationId: "exportExecutionLogs",
			parameters: [
				{
					name: "customerId",
					in: "path",
					description: "Customer ID to export execution logs for",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					example: "550e8400-e29b-41d4-a716-446655440000"
				},
				{
					name: "workflow_id",
					in: "query",
					description: "Optional workflow ID to filter logs",
					required: false,
					schema: {
						type: "string",
						format: "uuid"
					}
				},
				{
					name: "start_date",
					in: "query",
					description: "Optional start date for filtering logs (ISO 8601 format)",
					required: false,
					schema: {
						type: "string",
						format: "date-time"
					}
				},
				{
					name: "end_date",
					in: "query",
					description: "Optional end date for filtering logs (ISO 8601 format)",
					required: false,
					schema: {
						type: "string",
						format: "date-time"
					}
				}
			],
			responses: {
				"200": {
					description: "CSV file containing execution logs",
					content: {
						"text/csv": {
							schema: {
								type: "string",
								format: "binary"
							}
						}
					}
				},
				"400": {
					$ref: "#/components/responses/BadRequest"
				},
				"401": {
					$ref: "#/components/responses/Unauthorized"
				},
				"429": {
					description: "Too Many Requests - Rate limit exceeded"
				},
				"500": {
					$ref: "#/components/responses/InternalServerError"
				}
			},
			security: [
				{
					bearerAuth: []
				}
			]
		}
	},
	"/audit/customers/{customerId}/workflow-changes": {
		get: {
			tags: ["Audit"],
			summary: "Export workflow changes logs as CSV",
			description:
				"Exports workflow changes logs as CSV. Logs are filtered by customer_id (from path parameter) and optionally by workflow_id and date range. Admin users can access any customer's logs, while customer users can only access their own. Rate limited to 10 requests per minute per user.",
			operationId: "exportWorkflowChangesLogs",
			parameters: [
				{
					name: "customerId",
					in: "path",
					description: "Customer ID to export workflow changes logs for",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					example: "550e8400-e29b-41d4-a716-446655440000"
				},
				{
					name: "workflow_id",
					in: "query",
					description: "Optional workflow ID to filter logs",
					required: false,
					schema: {
						type: "string",
						format: "uuid"
					}
				},
				{
					name: "start_date",
					in: "query",
					description: "Optional start date for filtering logs (ISO 8601 format)",
					required: false,
					schema: {
						type: "string",
						format: "date-time"
					}
				},
				{
					name: "end_date",
					in: "query",
					description: "Optional end date for filtering logs (ISO 8601 format)",
					required: false,
					schema: {
						type: "string",
						format: "date-time"
					}
				}
			],
			responses: {
				"200": {
					description: "CSV file containing workflow changes logs",
					content: {
						"text/csv": {
							schema: {
								type: "string",
								format: "binary"
							}
						}
					}
				},
				"400": {
					$ref: "#/components/responses/BadRequest"
				},
				"401": {
					$ref: "#/components/responses/Unauthorized"
				},
				"429": {
					description: "Too Many Requests - Rate limit exceeded"
				},
				"500": {
					$ref: "#/components/responses/InternalServerError"
				}
			},
			security: [
				{
					bearerAuth: []
				}
			]
		}
	},
	"/audit/executions/latest": {
		get: {
			tags: ["Audit"],
			summary: "Get latest workflow execution details for a case",
			description:
				"Retrieves the latest workflow execution details for a given case ID. Returns information about all workflows evaluated during the execution, including their rules, conditions evaluation (passed/failed), decision type, and action applied. For historical logs without workflow_version_id, the version field will be an empty string. Users can only access executions from their own customer unless they are admins.",
			operationId: "getCaseExecutionDetails",
			parameters: [
				{
					name: "case_id",
					in: "query",
					description: "Case ID to get execution details for",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					example: "550e8400-e29b-41d4-a716-446655440000"
				}
			],
			responses: {
				"200": {
					description: "Case execution details retrieved successfully",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["success"],
										example: "success"
									},
									message: {
										type: "string",
										example: "Case execution details retrieved successfully"
									},
									data: {
										type: "object",
										properties: {
											workflows_evaluated: {
												type: "array",
												description: "Array of all workflows that were evaluated during the execution",
												items: {
													type: "object",
													properties: {
														workflow_id: {
															type: "string",
															description: "ID of the workflow",
															example: "550e8400-e29b-41d4-a716-446655440000"
														},
														name: {
															type: "string",
															description: "Name of the workflow",
															example: "Customer Onboarding"
														},
														version: {
															type: "string",
															description:
																"Version number of the workflow. Empty string for historical logs without workflow_version_id",
															example: "1.0"
														},
														matched: {
															type: "boolean",
															description: "Whether this workflow was the one that was executed (matched the case)",
															example: true
														},
														rules: {
															type: "array",
															description: "Array of rules evaluated for this workflow",
															items: {
																type: "object",
																properties: {
																	name: {
																		type: "string",
																		description: "Name of the rule",
																		example: "High Value Customer Rule"
																	},
																	matched: {
																		type: "boolean",
																		description: "Whether this rule matched",
																		example: true
																	},
																	conditions: {
																		type: "object",
																		nullable: true,
																		description:
																			"Conditions evaluation results (only present when conditions were evaluated)",
																		properties: {
																			passed: {
																				type: "array",
																				description: "Array of conditions that passed",
																				items: {
																					type: "object",
																					properties: {
																						name: {
																							type: "string",
																							description: "Human-readable name of the condition",
																							example: "Credit Score"
																						},
																						field: {
																							type: "string",
																							description: "Field path that was evaluated",
																							example: "facts.score"
																						},
																						description: {
																							type: "string",
																							description: "Human-readable description of the condition evaluation",
																							example: "Credit Score >= 700, and it was 750 ✓"
																						}
																					},
																					required: ["name", "field", "description"]
																				}
																			},
																			failed: {
																				type: "array",
																				description: "Array of conditions that failed",
																				items: {
																					type: "object",
																					properties: {
																						name: {
																							type: "string",
																							description: "Human-readable name of the condition",
																							example: "Age"
																						},
																						field: {
																							type: "string",
																							description: "Field path that was evaluated",
																							example: "facts.age"
																						},
																						description: {
																							type: "string",
																							description: "Human-readable description of the condition evaluation",
																							example: "Age >= 18, but it was 16 ✗"
																						}
																					},
																					required: ["name", "field", "description"]
																				}
																			}
																		},
																		required: ["passed", "failed"]
																	}
																},
																required: ["name", "matched"]
															}
														}
													},
													required: ["workflow_id", "name", "version", "matched", "rules"]
												}
											},
											decision_type: {
												type: "string",
												enum: ["RULE_MATCHED", "DEFAULT_ACTION", "NO_ACTION"],
												description:
													"Type of decision made: RULE_MATCHED when a rule matched, DEFAULT_ACTION when default action was applied, NO_ACTION when no rule matched and no default action",
												example: "RULE_MATCHED"
											},
											action_applied: {
												type: "string",
												nullable: true,
												description:
													"Action that was applied (only present when decision_type is RULE_MATCHED or DEFAULT_ACTION)",
												example: "AUTO APPROVED"
											},
											generated_at: {
												type: "string",
												format: "date-time",
												description: "ISO 8601 timestamp when the execution details were generated",
												example: "2024-01-15T10:30:00.000Z"
											}
										},
										required: ["workflows_evaluated", "decision_type", "generated_at"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					$ref: "#/components/responses/BadRequest"
				},
				"401": {
					$ref: "#/components/responses/Unauthorized"
				},
				"403": {
					description: "Forbidden - User is not authorized to access this case execution",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["fail"],
										example: "fail"
									},
									message: {
										type: "string",
										example: "Access denied. You are not authorized to access this case execution."
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"404": {
					description: "Not Found - No workflow execution found for the given case ID",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["fail"],
										example: "fail"
									},
									message: {
										type: "string",
										example: "No workflow execution found for the given case ID"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					$ref: "#/components/responses/InternalServerError"
				}
			},
			security: [
				{
					bearerAuth: []
				}
			]
		}
	}
};
