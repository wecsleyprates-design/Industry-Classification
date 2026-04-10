import type { OpenAPIV3 } from "openapi-types";
import { WORKFLOW_STATUS, ACTION_TYPES, WORKFLOW_LIST_STATUS } from "#constants";
import { COMPARISON_OPERATOR, LOGICAL_OPERATOR } from "#helpers/workflow";

const versionStatusValues = Object.values(WORKFLOW_STATUS);
const workflowListStatusValues = Object.values(WORKFLOW_LIST_STATUS);
const comparisonOperators = Object.values(COMPARISON_OPERATOR);

const workflowsOpenAPI: OpenAPIV3.PathsObject = {
	"/": {
		post: {
			tags: ["Workflows"],
			summary: "Create workflow draft",
			description:
				"Creates a new workflow in draft status with the specified name and description. Optionally, rules can be included in the request to create the workflow with rules in a single call.",
			operationId: "createWorkflowDraft",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["name"],
							properties: {
								name: {
									type: "string",
									description: "Name of the workflow",
									example: "Customer Onboarding Workflow"
								},
								description: {
									type: "string",
									description: "Optional description of the workflow",
									example: "Automated workflow for processing new customer onboarding cases"
								},
								trigger_id: {
									type: "string",
									format: "uuid",
									description: "Optional trigger ID. If not provided, will use the default SUBMITTED trigger",
									example: "628e1991-bf73-4027-924c-cacde8948839"
								},
								rules: {
									type: "array",
									description:
										"Optional array of rules to add during workflow creation. If provided, rules will be created along with the workflow in a single transaction.",
									items: {
										type: "object",
										description: "Workflow rule definition"
									}
								},
								default_action: {
									oneOf: [
										{
											type: "object",
											description: "Single default action to apply when no rules match"
										},
										{
											type: "array",
											items: {
												type: "object",
												description: "Action definition"
											},
											description: "Array of default actions to apply when no rules match"
										}
									],
									description:
										"Optional default action(s) to apply when no workflow rules match. Can be a single action object or an array of action objects."
								},
								auto_publish: {
									type: "boolean",
									description:
										"If true, the workflow will be automatically published after creation. Defaults to false.",
									default: false,
									example: false
								}
							},
							additionalProperties: false
						}
					}
				}
			},
			responses: {
				"201": {
					description: "Workflow draft created successfully",
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
										example: "Workflow draft created successfully"
									},
									data: {
										type: "object",
										properties: {
											workflow_id: {
												type: "string",
												format: "uuid",
												description: "Unique identifier for the created workflow",
												example: "123e4567-e89b-12d3-a456-426614174000"
											},
											version_id: {
												type: "string",
												format: "uuid",
												description: "Unique identifier for the version",
												example: "987fcdeb-51a2-43d1-b789-123456789abc"
											},
											message: {
												type: "string",
												example: "Workflow draft created successfully"
											},
											published_at: {
												type: "string",
												format: "date-time",
												description:
													"Timestamp when the workflow was published (only present if auto_publish was true)",
												example: "2024-01-15T10:30:00.000Z"
											}
										},
										required: ["workflow_id", "version_id", "message"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					description: "Bad Request - Invalid input data",
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
										example: "Validation failed"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 400
									},
									data: {
										type: "object",
										description: "Validation error details"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Invalid or missing authentication",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Unauthorized"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 401
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
									},
									data: {
										type: "object",
										nullable: true
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		}
	},
	"/{id}": {
		get: {
			tags: ["Workflows"],
			summary: "Get workflow by ID",
			description:
				"Retrieves a single workflow with all its details including current version, trigger, rules, and default action. Prioritizes DRAFT version if exists, otherwise returns current PUBLISHED version. This endpoint is used for loading an existing workflow into the wizard for modification.",
			operationId: "getWorkflowById",
			parameters: [
				{
					name: "id",
					in: "path",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					description: "Unique identifier for the workflow to retrieve",
					example: "123e4567-e89b-12d3-a456-426614174000"
				}
			],
			responses: {
				"200": {
					description: "Workflow retrieved successfully",
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
										example: "Workflow retrieved successfully"
									},
									data: {
										type: "object",
										properties: {
											id: {
												type: "string",
												format: "uuid",
												description: "Workflow unique identifier",
												example: "123e4567-e89b-12d3-a456-426614174000"
											},
											name: {
												type: "string",
												description: "Workflow name",
												example: "Customer Onboarding Workflow"
											},
											description: {
												type: "string",
												nullable: true,
												description: "Workflow description",
												example: "Automated workflow for processing new customer onboarding cases"
											},
											priority: {
												type: "integer",
												description: "Workflow priority (lower number = higher priority)",
												example: 1
											},
											active: {
												type: "boolean",
												description: "Whether the workflow is active",
												example: true
											},
											created_at: {
												type: "string",
												format: "date-time",
												description: "Workflow creation timestamp",
												example: "2024-01-01T00:00:00Z"
											},
											updated_at: {
												type: "string",
												format: "date-time",
												description: "Workflow last update timestamp",
												example: "2024-01-02T00:00:00Z"
											},
											current_version: {
												type: "object",
												properties: {
													id: {
														type: "string",
														format: "uuid",
														description: "Version unique identifier",
														example: "987fcdeb-51a2-43d1-b789-123456789abc"
													},
													version_number: {
														type: "integer",
														description: "Version number",
														example: 1
													},
													status: {
														type: "string",
														enum: versionStatusValues,
														description: "Version status",
														example: WORKFLOW_STATUS.DRAFT
													},
													trigger_id: {
														type: "string",
														format: "uuid",
														description: "Trigger unique identifier",
														example: "628e1991-bf73-4027-924c-cacde8948839"
													},
													trigger: {
														type: "object",
														properties: {
															id: {
																type: "string",
																format: "uuid",
																description: "Trigger unique identifier",
																example: "628e1991-bf73-4027-924c-cacde8948839"
															},
															name: {
																type: "string",
																description: "Trigger name",
																example: "SUBMITTED"
															},
															conditions: {
																type: "object",
																description: "Trigger conditions in JSON Logic format",
																example: {
																	"==": [{ var: "status.code" }, "SUBMITTED"]
																}
															}
														},
														required: ["id", "name", "conditions"]
													},
													default_action: {
														oneOf: [
															{
																type: "object",
																description: "Single default action",
																nullable: true
															},
															{
																type: "array",
																items: {
																	type: "object"
																},
																description: "Array of default actions"
															}
														],
														nullable: true,
														description:
															"Default action(s) to apply when no rules match. Can be null if not configured.",
														example: {
															type: ACTION_TYPES.SET_FIELD,
															parameters: {
																field: "case.status",
																value: "AUTO_APPROVED"
															}
														}
													},
													rules: {
														type: "array",
														description: "Array of workflow rules",
														items: {
															type: "object",
															properties: {
																id: {
																	type: "string",
																	format: "uuid",
																	description: "Rule unique identifier",
																	example: "abc12345-e89b-12d3-a456-426614174000"
																},
																name: {
																	type: "string",
																	description: "Rule name",
																	example: "High Risk Rule"
																},
																priority: {
																	type: "integer",
																	description: "Rule priority (lower number = higher priority)",
																	example: 1
																},
																conditions: {
																	type: "object",
																	description: "Rule conditions",
																	example: {
																		operator: "AND",
																		conditions: [
																			{
																				field: "facts.mcc_code",
																				operator: "=",
																				value: "1234"
																			}
																		]
																	}
																},
																actions: {
																	oneOf: [
																		{
																			type: "object",
																			description: "Single action"
																		},
																		{
																			type: "array",
																			items: {
																				type: "object"
																			},
																			description: "Array of actions"
																		}
																	],
																	description: "Action(s) to execute when rule matches",
																	example: [
																		{
																			type: "set_field",
																			parameters: {
																				field: "case.status",
																				value: "UNDER_MANUAL_REVIEW"
																			}
																		}
																	]
																}
															},
															required: ["id", "name", "priority", "conditions", "actions"]
														}
													}
												},
												required: ["id", "version_number", "status", "trigger_id", "trigger", "rules"]
											}
										},
										required: ["id", "name", "priority", "active", "created_at", "updated_at", "current_version"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					description: "Bad Request - Invalid workflow ID format",
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
										example: "Workflow ID must be a valid UUID format"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 400
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Invalid or missing authentication",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Unauthorized"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 401
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"403": {
					description: "Forbidden - User does not have access to this workflow",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Access denied. You are not authorized to access this workflow."
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 403
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"404": {
					description: "Not Found - Workflow not found",
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
										example: "Workflow with ID 123e4567-e89b-12d3-a456-426614174000 not found"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 404
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		},
		put: {
			tags: ["Workflows"],
			summary: "Update workflow",
			description:
				"Updates an existing workflow with new rules, trigger, or metadata. Supports complex nested conditions with 2-level validation.",
			operationId: "updateWorkflow",
			parameters: [
				{
					name: "id",
					in: "path",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					description: "Unique identifier for the workflow to update",
					example: "123e4567-e89b-12d3-a456-426614174000"
				}
			],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								name: {
									type: "string",
									description: "Updated name for the workflow",
									example: "Updated Customer Onboarding Workflow"
								},
								description: {
									type: "string",
									description: "Updated description for the workflow",
									example: "Updated automated workflow for processing new customer onboarding cases"
								},
								trigger_id: {
									type: "string",
									format: "uuid",
									description: "Updated trigger ID for the workflow",
									example: "628e1991-bf73-4027-924c-cacde8948839"
								},
								rules: {
									type: "array",
									description: "Array of workflow rules with complex nested conditions",
									items: {
										type: "object",
										required: ["name", "priority", "conditions", "actions"],
										properties: {
											name: {
												type: "string",
												description: "Name of the rule",
												example: "High Priority Customer Rule"
											},
											priority: {
												type: "integer",
												minimum: 0,
												description: "Priority of the rule (lower number = higher priority)",
												example: 1
											},
											conditions: {
												type: "object",
												description: "Rule conditions with 2-level nesting support",
												required: ["operator", "conditions"],
												properties: {
													operator: {
														type: "string",
														enum: [LOGICAL_OPERATOR.AND],
														description: "Root condition operator (always AND)",
														example: LOGICAL_OPERATOR.AND
													},
													conditions: {
														type: "array",
														description: "Array of conditions (simple or OR groups)",
														items: {
															oneOf: [
																{
																	type: "object",
																	description: "Simple condition",
																	required: ["field", "value", "operator"],
																	properties: {
																		field: {
																			type: "string",
																			description: "Field path to evaluate",
																			example: "facts.mcc_code"
																		},
																		value: {
																			description: "Value to compare against",
																			example: false
																		},
																		operator: {
																			type: "string",
																			enum: comparisonOperators,
																			description: "Comparison operator",
																			example: COMPARISON_OPERATOR.EQUALS
																		}
																	}
																},
																{
																	type: "object",
																	description: "OR condition group",
																	required: ["operator", "conditions"],
																	properties: {
																		operator: {
																			type: "string",
																			enum: [LOGICAL_OPERATOR.OR],
																			description: "Nested condition operator (always OR)",
																			example: LOGICAL_OPERATOR.OR
																		},
																		conditions: {
																			type: "array",
																			description: "Array of simple conditions within the OR group",
																			items: {
																				type: "object",
																				required: ["field", "value", "operator"],
																				properties: {
																					field: {
																						type: "string",
																						description: "Field path to evaluate",
																						example: "facts.other_fact"
																					},
																					value: {
																						description: "Value to compare against",
																						example: null
																					},
																					operator: {
																						type: "string",
																						enum: comparisonOperators,
																						description: "Comparison operator",
																						example: COMPARISON_OPERATOR.EQUALS
																					}
																				}
																			}
																		}
																	}
																}
															]
														}
													}
												}
											},
											actions: {
												type: "array",
												description: "Array of actions to execute when rule matches",
												items: {
													type: "object",
													required: ["type", "parameters"],
													properties: {
														type: {
															type: "string",
															description: "Type of action to execute",
															example: "set_field"
														},
														parameters: {
															type: "object",
															required: ["field", "value"],
															properties: {
																field: {
																	type: "string",
																	description: "Field to set",
																	example: "case.status"
																},
																value: {
																	description: "Value to set",
																	example: "UNDER_MANUAL_REVIEW"
																}
															}
														}
													}
												}
											}
										}
									}
								},
								default_action: {
									oneOf: [
										{
											type: "object",
											description: "Single default action to apply when no rules match",
											required: ["type", "parameters"],
											properties: {
												type: {
													type: "string",
													description: "Type of default action",
													example: "set_field"
												},
												parameters: {
													type: "object",
													required: ["field", "value"],
													properties: {
														field: {
															type: "string",
															description: "Field to set",
															example: "case.status"
														},
														value: {
															description: "Value to set",
															example: "AUTO_APPROVED"
														}
													}
												}
											}
										},
										{
											type: "array",
											description: "Array of default actions to apply when no rules match",
											items: {
												type: "object",
												required: ["type", "parameters"],
												properties: {
													type: {
														type: "string",
														description: "Type of default action",
														example: "set_field"
													},
													parameters: {
														type: "object",
														required: ["field", "value"],
														properties: {
															field: {
																type: "string",
																description: "Field to set",
																example: "case.status"
															},
															value: {
																description: "Value to set",
																example: "AUTO_APPROVED"
															}
														}
													}
												}
											}
										}
									],
									description:
										"Optional default action(s) to apply when no workflow rules match. Can be a single action object or an array of action objects."
								},
								auto_publish: {
									type: "boolean",
									description:
										"If true, the workflow will be automatically published after the update. Defaults to false.",
									default: false,
									example: false
								}
							},
							additionalProperties: false
						}
					}
				}
			},
			responses: {
				"200": {
					description: "Workflow updated successfully",
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
										example: "Workflow updated successfully"
									},
									data: {
										type: "object",
										properties: {
											workflow_id: {
												type: "string",
												format: "uuid",
												description: "Unique identifier for the updated workflow",
												example: "123e4567-e89b-12d3-a456-426614174000"
											},
											requires_new_version: {
												type: "boolean",
												description: "Whether the changes require a new workflow version",
												example: true
											},
											changes: {
												type: "array",
												description: "List of changes detected in the workflow",
												items: {
													type: "object",
													properties: {
														type: {
															type: "string",
															description: "Type of change detected",
															example: "trigger_updated"
														},
														description: {
															type: "string",
															description: "Description of the change",
															example: "Trigger ID changed from old-trigger to new-trigger"
														}
													}
												}
											},
											message: {
												type: "string",
												example: "Workflow updated successfully"
											},
											published_at: {
												type: "string",
												format: "date-time",
												description:
													"Timestamp when the workflow was published (only present if auto_publish was true)",
												example: "2024-01-15T10:30:00.000Z"
											}
										},
										required: ["workflow_id", "requires_new_version", "changes", "message"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					description: "Bad Request - Invalid input data",
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
										example:
											"Invalid rules structure: Condition operator must be one of: =, !=, >, <, >=, <=, IN, NOT_IN, CONTAINS, NOT_CONTAINS, BETWEEN"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 422
									},
									data: {
										type: "object",
										description: "Validation error details"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Invalid or missing authentication",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Unauthorized"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 401
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"404": {
					description: "Not Found - Workflow not found",
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
										example: "Workflow not found"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 404
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"422": {
					description: "Unprocessable Entity - Validation failed",
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
										example: "Trigger with ID invalid-trigger-id not found"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 422
									},
									data: {
										type: "object",
										properties: {
											errorName: {
												type: "string",
												example: "ApiError"
											},
											details: {
												type: "array",
												items: {
													type: "string"
												},
												example: ["Trigger with ID invalid-trigger-id not found"]
											}
										}
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
									},
									data: {
										type: "object",
										nullable: true
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		},
		delete: {
			tags: ["Workflows"],
			summary: "Delete a draft workflow",
			description:
				"Deletes a draft workflow and all its draft versions. Only allows deletion of workflows with no published or archived versions. This ensures logs are preserved for workflows with execution history.",
			operationId: "deleteDraftWorkflow",
			parameters: [
				{
					name: "id",
					in: "path",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					description: "The workflow ID to delete",
					example: "123e4567-e89b-12d3-a456-426614174000"
				}
			],
			responses: {
				"200": {
					description: "Draft workflow deleted successfully",
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
										example: "Draft workflow deleted successfully"
									},
									data: {
										type: "object",
										properties: {
											message: {
												type: "string",
												example: "Draft workflow deleted successfully"
											}
										},
										required: ["message"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"404": {
					description: "Workflow not found",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Workflow not found"
									},
									errorCode: {
										type: "string",
										example: "NOT_FOUND"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"409": {
					description: "Conflict - Cannot delete workflow with published or archived versions",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example:
											"Cannot delete workflow with published versions. Please archive or unpublish all versions first."
									},
									errorCode: {
										type: "string",
										example: "CONFLICT"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		}
	},
	"/{id}/priority": {
		put: {
			tags: ["Workflows"],
			summary: "Change workflow priority",
			description:
				"Changes the priority of a workflow and automatically reorders other workflows within the same customer. Priorities are scoped per customer, so changing a workflow's priority only affects other workflows belonging to the same customer. The priority must be between 1 and the maximum priority for the customer.",
			operationId: "changeWorkflowPriority",
			parameters: [
				{
					name: "id",
					in: "path",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					description: "Unique identifier for the workflow to change priority",
					example: "123e4567-e89b-12d3-a456-426614174000"
				}
			],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["priority"],
							properties: {
								priority: {
									type: "integer",
									minimum: 1,
									description:
										"The new priority for the workflow. Must be between 1 and the maximum priority for the customer. Lower numbers indicate higher priority.",
									example: 2
								}
							},
							additionalProperties: false
						}
					}
				}
			},
			responses: {
				"200": {
					description: "Workflow priority changed successfully",
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
										example: "Workflow priority changed successfully"
									},
									data: {
										type: "object",
										properties: {
											workflow_id: {
												type: "string",
												format: "uuid",
												description: "Unique identifier for the workflow whose priority was changed",
												example: "123e4567-e89b-12d3-a456-426614174000"
											},
											affected_workflows: {
												type: "array",
												description:
													"List of workflows whose priorities were automatically adjusted as a result of this change",
												items: {
													type: "object",
													properties: {
														workflow_id: {
															type: "string",
															format: "uuid",
															description: "Unique identifier for the affected workflow",
															example: "987fcdeb-51a2-43d1-b789-123456789abc"
														},
														old_priority: {
															type: "integer",
															description: "The previous priority of the workflow",
															example: 1
														},
														new_priority: {
															type: "integer",
															description: "The new priority of the workflow",
															example: 2
														}
													},
													required: ["workflow_id", "old_priority", "new_priority"]
												}
											}
										},
										required: ["workflow_id", "affected_workflows"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					description: "Bad Request - Invalid input data or priority value",
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
										example: "Priority must be at least 1"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 400
									},
									data: {
										type: "object",
										description: "Validation error details"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Invalid or missing authentication",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Unauthorized"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 401
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"404": {
					description: "Not Found - Workflow not found",
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
										example: "Workflow with ID 123e4567-e89b-12d3-a456-426614174000 not found"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 404
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"409": {
					description: "Conflict - Workflow priority mismatch or concurrent modification detected",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example:
											"Workflow priority mismatch. Expected priority 3, but found 5. The workflow may have been modified by another process."
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 409
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"422": {
					description: "Unprocessable Entity - Priority out of valid range",
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
										example: "Priority must be between 1 and 5"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 422
									},
									data: {
										type: "object",
										description: "Validation error details"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
									},
									data: {
										type: "object",
										nullable: true
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		}
	},
	"/customers/{customerId}/workflows": {
		get: {
			tags: ["Workflows"],
			summary: "Get workflows list for a customer",
			description:
				"Retrieves a paginated list of workflows for a specific customer with support for filtering, searching, and sorting.",
			operationId: "getWorkflowsList",
			parameters: [
				{
					name: "customerId",
					in: "path",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					description: "Customer ID",
					example: "123e4567-e89b-12d3-a456-426614174000"
				},
				{
					name: "page",
					in: "query",
					required: false,
					schema: {
						type: "integer",
						minimum: 1,
						default: 1
					},
					description: "Page number",
					example: 1
				},
				{
					name: "items_per_page",
					in: "query",
					required: false,
					schema: {
						type: "integer",
						minimum: 1,
						maximum: 100,
						default: 10
					},
					description: "Number of items per page",
					example: 10
				},
				{
					name: "pagination",
					in: "query",
					required: false,
					schema: {
						type: "boolean",
						default: true
					},
					description: "Whether to use pagination",
					example: true
				},
				{
					name: "filter[status]",
					in: "query",
					required: false,
					schema: {
						oneOf: [
							{
								type: "string",
								enum: workflowListStatusValues,
								description: "Note: 'draft' is deprecated and no longer works"
							},
							{
								type: "array",
								items: {
									type: "string",
									enum: workflowListStatusValues,
									description: "Note: 'draft' is deprecated and no longer works"
								}
							}
						]
					},
					description:
						"Filter by workflow status. Valid values: 'active' (workflows with published version and active=true, or drafts with previous published version), 'inactive' (new drafts without published version, or published workflows with active=false). Note: 'draft' filter is deprecated and no longer works as workflows no longer return 'draft' status.",
					example: "active"
				},
				{
					name: "filter[created_by]",
					in: "query",
					required: false,
					schema: {
						oneOf: [
							{
								type: "string",
								format: "uuid"
							},
							{
								type: "array",
								items: {
									type: "string",
									format: "uuid"
								}
							}
						]
					},
					description: "Filter by creator user ID(s)",
					example: "123e4567-e89b-12d3-a456-426614174000"
				},
				{
					name: "search[name]",
					in: "query",
					required: false,
					schema: {
						type: "string"
					},
					description: "Search by workflow name (case-insensitive partial match)",
					example: "onboarding"
				},
				{
					name: "search[description]",
					in: "query",
					required: false,
					schema: {
						type: "string"
					},
					description:
						"Search by workflow description (case-insensitive partial match). Note: Workflows are always sorted by priority ASC (no user sorting allowed to avoid confusion with priority)",
					example: "customer"
				}
			],
			responses: {
				"200": {
					description: "Workflows retrieved successfully",
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
										example: "Workflows retrieved successfully"
									},
									data: {
										type: "object",
										properties: {
											records: {
												type: "array",
												items: {
													type: "object",
													properties: {
														id: {
															type: "string",
															format: "uuid",
															example: "123e4567-e89b-12d3-a456-426614174000"
														},
														name: {
															type: "string",
															example: "Customer Onboarding Workflow"
														},
														description: {
															type: "string",
															example: "Automated workflow for processing new customer onboarding cases"
														},
														priority: {
															type: "integer",
															example: 1
														},
														cases: {
															type: "integer",
															example: 200
														},
														published_version: {
															type: "string",
															nullable: true,
															description:
																"Published version number (e.g., '1.0', '2.0'). Null if no published version exists. Frontend should format this as needed (e.g., with links).",
															example: "1.0"
														},
														draft_version: {
															type: "string",
															nullable: true,
															description:
																"Draft version number (e.g., '2.0', '3.0'). Null if no draft version exists. Frontend should format this as needed (e.g., with links).",
															example: "2.0"
														},
														status: {
															type: "string",
															enum: workflowListStatusValues,
															description:
																"Workflow status: 'active' if workflow has published version with active=true OR has draft with previous published version, 'inactive' otherwise",
															example: WORKFLOW_LIST_STATUS.ACTIVE
														},
														created_by: {
															type: "string",
															format: "uuid",
															description: "UUID of the customer who created the workflow",
															example: "123e4567-e89b-12d3-a456-426614174000"
														},
														created_by_name: {
															type: "string",
															description: "Name of the customer who created the workflow (fetched from auth-service)",
															example: "John Doe",
															nullable: true
														},
														created_at: {
															type: "string",
															format: "date-time",
															example: "2024-01-01T00:00:00Z"
														},
														updated_at: {
															type: "string",
															format: "date-time",
															example: "2024-01-02T00:00:00Z"
														}
													},
													required: [
														"id",
														"name",
														"description",
														"priority",
														"cases",
														"published_version",
														"draft_version",
														"status",
														"created_by",
														"created_at"
													]
												}
											},
											total_pages: {
												type: "integer",
												example: 10
											},
											total_items: {
												type: "integer",
												example: 100
											}
										},
										required: ["records", "total_pages", "total_items"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					description: "Bad Request - Invalid input data",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Customer ID must be a valid UUID format"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 400
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Invalid or missing authentication",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Unauthorized"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 401
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"403": {
					description: "Forbidden - Access denied",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Access denied. You are not authorized to access workflows for this customer."
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 403
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
									}
								},
								required: ["status", "message"]
							}
						}
					}
				}
			}
		}
	},
	"/{id}/status": {
		patch: {
			tags: ["Workflows"],
			summary: "Update workflow status",
			description:
				"Activates or deactivates a workflow by updating its active status. To activate a workflow, it must have at least one published version. Deactivating a workflow does not require any published version.",
			operationId: "updateWorkflowStatus",
			parameters: [
				{
					name: "id",
					in: "path",
					required: true,
					schema: {
						type: "string",
						format: "uuid"
					},
					description: "Unique identifier for the workflow to update status",
					example: "123e4567-e89b-12d3-a456-426614174000"
				}
			],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["status"],
							properties: {
								status: {
									type: "boolean",
									description:
										"New active status for the workflow. Set to true to activate, false to deactivate. Activating requires at least one published version.",
									example: true
								}
							},
							additionalProperties: false
						}
					}
				}
			},
			responses: {
				"200": {
					description: "Workflow status updated successfully",
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
										example: "Workflow status updated successfully"
									},
									data: {
										type: "object",
										properties: {
											workflow_id: {
												type: "string",
												format: "uuid",
												description: "Unique identifier for the workflow whose status was updated",
												example: "123e4567-e89b-12d3-a456-426614174000"
											},
											active: {
												type: "boolean",
												description: "The new active status of the workflow",
												example: true
											}
										},
										required: ["workflow_id", "active"]
									}
								},
								required: ["status", "message", "data"]
							}
						}
					}
				},
				"400": {
					description: "Bad Request - Invalid input data",
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
										example: "Status must be a boolean"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 400
									},
									data: {
										type: "object",
										description: "Validation error details"
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"401": {
					description: "Unauthorized - Invalid or missing authentication",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Unauthorized"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 401
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"404": {
					description: "Not Found - Workflow not found",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Workflow not found"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 404
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"409": {
					description:
						"Conflict - Cannot activate workflow without published version. The workflow must have at least one published version before it can be activated.",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "You need to complete the pending configuration before activating the workflow"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 409
									}
								},
								required: ["status", "message"]
							}
						}
					}
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["error"],
										example: "error"
									},
									message: {
										type: "string",
										example: "Internal server error"
									},
									errorCode: {
										type: "number",
										nullable: true,
										example: 500
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

export default workflowsOpenAPI;
