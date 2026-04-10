import type { OpenAPIV3 } from "openapi-types";

const sharedRuleConditionExample = {
	operator: "AND",
	conditions: [
		{
			field: "facts.amount",
			operator: ">",
			value: 1000
		},
		{
			operator: "OR",
			conditions: [
				{
					field: "facts.country",
					operator: "=",
					value: "US"
				},
				{
					field: "facts.country",
					operator: "=",
					value: "CA"
				}
			]
		}
	]
};

const sharedRuleSimpleConditionSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	required: ["field", "operator"],
	properties: {
		field: {
			type: "string",
			minLength: 1,
			description: "Field path to evaluate"
		},
		operator: {
			type: "string",
			description: "Comparison or variation operator supported by the shared rule DSL",
			example: ">"
		},
		value: {
			description: "Comparison value. Optional only for null-check operators."
		}
	},
	additionalProperties: false
};

const sharedRuleOrGroupSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	required: ["operator", "conditions"],
	properties: {
		operator: {
			type: "string",
			enum: ["OR"]
		},
		conditions: {
			type: "array",
			minItems: 1,
			items: sharedRuleSimpleConditionSchema
		}
	},
	additionalProperties: false
};

const sharedRuleConditionsSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	required: ["operator", "conditions"],
	properties: {
		operator: {
			type: "string",
			enum: ["AND"]
		},
		conditions: {
			type: "array",
			minItems: 1,
			items: {
				oneOf: [sharedRuleSimpleConditionSchema, sharedRuleOrGroupSchema]
			}
		}
	},
	additionalProperties: false,
	description: "Shared rule conditions DSL. The root group must use AND, and nested groups may only use OR.",
	example: sharedRuleConditionExample
};

export const sharedOpenAPI: OpenAPIV3.PathsObject = {
	"/shared/internal/rules/details": {
		post: {
			tags: ["Shared Rules"],
			summary: "Get shared rule details (batch)",
			description:
				"Returns metadata and latest-version conditions for each requested rule ID. IDs that do not exist or have no version appear in `missing_rule_ids`. Internal use only; not authenticated.",
			operationId: "getSharedRuleDetailsBatch",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["rule_ids"],
							additionalProperties: false,
							properties: {
								rule_ids: {
									type: "array",
									minItems: 1,
									items: { type: "string", format: "uuid" },
									description: "Non-empty list of shared rule UUIDs"
								}
							}
						}
					}
				}
			},
			responses: {
				"200": {
					description: "Partial or full results",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", enum: ["success"] },
									message: { type: "string" },
									data: {
										type: "object",
										required: ["rules", "missing_rule_ids"],
										additionalProperties: false,
										properties: {
											rules: {
												type: "array",
												items: {
													type: "object",
													required: [
														"rule_id",
														"name",
														"description",
														"latest_version_number",
														"conditions",
														"rule_created_at",
														"version_created_at"
													],
													additionalProperties: false,
													properties: {
														rule_id: { type: "string", format: "uuid" },
														name: { type: "string", nullable: true },
														description: { type: "string", nullable: true },
														latest_version_number: { type: "integer", minimum: 1 },
														conditions: sharedRuleConditionsSchema,
														rule_created_at: {
															type: "string",
															format: "date-time",
															description: "Rule row creation time (ISO 8601)"
														},
														version_created_at: {
															type: "string",
															format: "date-time",
															description: "Latest version row creation time (ISO 8601)"
														}
													}
												}
											},
											missing_rule_ids: {
												type: "array",
												items: { type: "string", format: "uuid" },
												description: "Requested IDs with no rule row or no version row"
											}
										}
									}
								}
							}
						}
					}
				},
				"400": { $ref: "#/components/responses/BadRequest" },
				"500": { $ref: "#/components/responses/InternalServerError" }
			}
		}
	},
	"/shared/internal/rules": {
		post: {
			tags: ["Shared Rules"],
			summary: "Create a shared rule",
			description:
				"Creates a new shared rule with the given context, name, description and conditions. Returns the rule_id and the initial version_id.",
			operationId: "createSharedRule",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["context_type", "context_id", "name", "conditions", "initiated_by_user_id"],
							properties: {
								context_type: {
									type: "string",
									enum: ["monitoring"],
									example: "monitoring",
									description: "Shared rule context type. Currently only monitoring is supported."
								},
								context_id: { type: "string", format: "uuid" },
								name: { type: "string", minLength: 1, maxLength: 255 },
								description: { type: "string", maxLength: 1000, nullable: true },
								conditions: sharedRuleConditionsSchema,
								initiated_by_user_id: {
									type: "string",
									format: "uuid",
									description:
										"User UUID initiating the change (audit); identity is asserted by the trusted internal caller."
								}
							},
							additionalProperties: false
						}
					}
				}
			},
			responses: {
				"201": {
					description: "Shared rule created successfully",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", enum: ["success"] },
									message: { type: "string" },
									data: {
										type: "object",
										properties: {
											rule_id: { type: "string", format: "uuid" },
											version_id: { type: "string", format: "uuid" }
										},
										required: ["rule_id", "version_id"]
									}
								}
							}
						}
					}
				},
				"400": { $ref: "#/components/responses/BadRequest" },
				"500": { $ref: "#/components/responses/InternalServerError" }
			}
		}
	},
	"/shared/internal/rules/{id}": {
		put: {
			tags: ["Shared Rules"],
			summary: "Update a shared rule",
			description:
				"Updates an existing shared rule. At least one of name, description, or conditions must be provided.",
			operationId: "updateSharedRule",
			parameters: [
				{
					name: "id",
					in: "path",
					description: "Rule ID (UUID)",
					required: true,
					schema: { type: "string", format: "uuid" }
				}
			],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["initiated_by_user_id"],
							properties: {
								name: { type: "string", minLength: 1, maxLength: 255 },
								description: { type: "string", maxLength: 1000, nullable: true },
								conditions: sharedRuleConditionsSchema,
								initiated_by_user_id: {
									type: "string",
									format: "uuid",
									description:
										"User UUID initiating the change (audit); identity is asserted by the trusted internal caller."
								}
							},
							description:
								"`initiated_by_user_id` is required. At least one of name, description, or conditions must also be provided.",
							additionalProperties: false
						}
					}
				}
			},
			responses: {
				"200": {
					description: "Shared rule updated successfully",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", enum: ["success"] },
									message: { type: "string" },
									data: {
										type: "object",
										properties: {
											rule_id: { type: "string", format: "uuid" },
											version_id: { type: "string", format: "uuid" },
											version_number: { type: "integer", minimum: 1 }
										},
										required: ["rule_id"]
									}
								}
							}
						}
					}
				},
				"400": { $ref: "#/components/responses/BadRequest" },
				"404": {
					description: "Rule not found",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", enum: ["fail"] },
									message: { type: "string", example: "Rule not found" }
								}
							}
						}
					}
				},
				"500": { $ref: "#/components/responses/InternalServerError" }
			}
		}
	},
	"/shared/rules/evaluate": {
		post: {
			tags: ["Shared Rules"],
			summary: "Evaluate shared rules",
			description:
				"Evaluates shared (monitoring) rules against the current state. The request may include additional top-level properties beyond those listed below. If `previousState` is sent, evaluation compares previous and current (variation); otherwise only the current state is used (static). Rules that need both states for variation checks return 400 if `previousState` is omitted.",
			operationId: "evaluateSharedRules",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							additionalProperties: true,
							required: ["currentState", "ruleIds"],
							properties: {
								currentState: {
									type: "object",
									description: "Current state payload (e.g. facts)",
									additionalProperties: true
								},
								previousState: {
									type: "object",
									description: "Optional previous state for variation evaluation",
									additionalProperties: true
								},
								ruleIds: {
									type: "array",
									items: { type: "string", minLength: 1 },
									minItems: 1,
									description: "Non-empty list of shared rule UUIDs to evaluate"
								},
								customerId: {
									type: "string",
									format: "uuid",
									nullable: true,
									description: "Optional customer context; null is treated as omitted"
								},
								businessId: {
									type: "string",
									format: "uuid",
									description: "Optional business context"
								},
								evaluationId: {
									type: "string",
									format: "uuid",
									description: "Optional correlation id; echoed as evaluation_id in data when provided"
								}
							}
						}
					}
				}
			},
			responses: {
				"200": {
					description: "Evaluation completed",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string", example: "success" },
									data: {
										type: "object",
										properties: {
											evaluation_id: {
												type: "string",
												format: "uuid",
												description: "Echo of request evaluationId when provided"
											},
											results: {
												type: "array",
												items: {
													type: "object",
													properties: {
														rule_id: { type: "string", format: "uuid" },
														rule_name: { type: "string", description: "Human-readable name of the rule" },
														matched: { type: "boolean" },
														conditions: { type: "object", additionalProperties: true },
														true_conditions: {
															type: "array",
															description: "Condition-level outcomes that evaluated to true",
															items: {
																type: "object",
																required: ["field", "operator", "expected_value", "actual_value", "result"],
																properties: {
																	field: { type: "string" },
																	operator: { type: "string" },
																	expected_value: {},
																	actual_value: {},
																	result: { type: "boolean" }
																}
															}
														},
														false_conditions: {
															type: "array",
															description: "Condition-level outcomes that evaluated to false",
															items: {
																type: "object",
																required: ["field", "operator", "expected_value", "actual_value", "result"],
																properties: {
																	field: { type: "string" },
																	operator: { type: "string" },
																	expected_value: {},
																	actual_value: {},
																	result: { type: "boolean" }
																}
															}
														}
													},
													required: [
														"rule_id",
														"rule_name",
														"matched",
														"conditions",
														"true_conditions",
														"false_conditions"
													]
												}
											}
										},
										required: ["results"]
									},
									message: { type: "string" }
								},
								required: ["status", "data", "message"]
							}
						}
					}
				},
				"400": {
					description:
						"Bad request: malformed or invalid body, empty `ruleIds`, invalid UUID fields, or a rule requires `previousState` for variation evaluation but it was not sent. " +
						"**Validation:** `status` is `fail`, `message` describes the issue, optional `data` holds structured field errors — typically **no** `errorCode`. " +
						"**ApiError (business rule):** `status` is `fail`, `message` is the error text, `errorCode` is a **string** application code (e.g. `INVALID`), not the HTTP status number.",
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["status", "message"],
								properties: {
									status: { type: "string", enum: ["fail", "error"] },
									message: { type: "string" },
									errorCode: {
										type: "string",
										description:
											"Workflow/application error code when the failure is an ApiError (e.g. INVALID). Omitted for body validation failures.",
										example: "INVALID"
									},
									data: {
										type: "object",
										additionalProperties: true,
										description: "Optional validation details. Omitted for many ApiError responses."
									}
								}
							}
						}
					}
				},
				"404": {
					description:
						"One or more requested rule IDs do not exist in shared rules or have no version row. Typically returned as ApiError with `errorCode` such as `WORKFLOW_NOT_FOUND`.",
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["status", "message", "errorCode"],
								properties: {
									status: { type: "string", enum: ["fail"] },
									message: { type: "string" },
									errorCode: {
										type: "string",
										description: "Application error code (e.g. WORKFLOW_NOT_FOUND).",
										example: "WORKFLOW_NOT_FOUND"
									}
								}
							}
						}
					}
				},
				"401": { $ref: "#/components/responses/Unauthorized" },
				"500": { $ref: "#/components/responses/InternalServerError" }
			},
			security: [{ bearerAuth: [] }]
		}
	}
};
