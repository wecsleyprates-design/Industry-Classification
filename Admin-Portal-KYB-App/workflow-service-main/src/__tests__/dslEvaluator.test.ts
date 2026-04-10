import { evaluateDSLWithTracking } from "#helpers/workflow";
import type { DSLRule } from "#helpers/workflow";
import { initializeJsonLogic } from "#helpers";

initializeJsonLogic();

describe("evaluateDSLWithTracking", () => {
	describe("basic evaluation", () => {
		it("should return true when all AND conditions match", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "SUBMITTED" },
					{ field: "facts.score", operator: ">=", value: 700 }
				]
			};
			const data = {
				case: { status: "SUBMITTED" },
				facts: { score: 750 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(2);
			expect(result.false_conditions).toHaveLength(0);
		});

		it("should return false when any AND condition fails", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "SUBMITTED" },
					{ field: "facts.score", operator: ">=", value: 800 }
				]
			};
			const data = {
				case: { status: "SUBMITTED" },
				facts: { score: 750 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.false_conditions).toHaveLength(1);
		});

		it("should evaluate all AND conditions without short-circuit", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "REJECTED" },
					{ field: "facts.score", operator: ">=", value: 900 }
				]
			};
			const data = {
				case: { status: "SUBMITTED" },
				facts: { score: 750 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.true_conditions).toHaveLength(0);
			expect(result.false_conditions).toHaveLength(2);
			expect(result.false_conditions[0].field).toBe("case.status");
			expect(result.false_conditions[1].field).toBe("facts.score");
		});
	});

	describe("OR conditions within AND", () => {
		it("should return true when OR has at least one matching condition", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "SUBMITTED" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.score", operator: ">=", value: 900 },
							{ field: "facts.income", operator: ">=", value: 50000 }
						]
					}
				]
			};
			const data = {
				case: { status: "SUBMITTED" },
				facts: { score: 750, income: 60000 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(2);
			expect(result.false_conditions).toHaveLength(1);
		});

		it("should return false when OR has no matching conditions", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "SUBMITTED" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.score", operator: ">=", value: 900 },
							{ field: "facts.income", operator: ">=", value: 100000 }
						]
					}
				]
			};
			const data = {
				case: { status: "SUBMITTED" },
				facts: { score: 750, income: 60000 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.false_conditions).toHaveLength(2);
		});

		it("should handle multiple OR groups", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{
						operator: "OR",
						conditions: [
							{ field: "facts.country", operator: "=", value: "US" },
							{ field: "facts.country", operator: "=", value: "CA" }
						]
					},
					{
						operator: "OR",
						conditions: [
							{ field: "facts.verified", operator: "=", value: true },
							{ field: "facts.score", operator: ">=", value: 800 }
						]
					}
				]
			};
			const data = {
				facts: { country: "CA", verified: false, score: 850 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
		});
	});

	describe("condition details tracking", () => {
		it("should capture correct field, operator, expected and actual values for true conditions", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.credit_score", operator: ">=", value: 700 }]
			};
			const data = { facts: { credit_score: 750 } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.true_conditions).toHaveLength(1);
			const condition = result.true_conditions[0];
			expect(condition.field).toBe("facts.credit_score");
			expect(condition.operator).toBe(">=");
			expect(condition.expected_value).toBe(700);
			expect(condition.actual_value).toBe(750);
			expect(condition.result).toBe(true);
		});

		it("should capture correct details for false conditions", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.credit_score", operator: ">=", value: 800 }]
			};
			const data = { facts: { credit_score: 750 } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.false_conditions).toHaveLength(1);
			const condition = result.false_conditions[0];
			expect(condition.field).toBe("facts.credit_score");
			expect(condition.operator).toBe(">=");
			expect(condition.expected_value).toBe(800);
			expect(condition.actual_value).toBe(750);
			expect(condition.result).toBe(false);
		});

		it("should track nested object values correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.address.country", operator: "=", value: "US" }]
			};
			const data = { facts: { address: { country: "CA" } } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].actual_value).toBe("CA");
			expect(result.false_conditions[0].expected_value).toBe("US");
		});

		it("should handle undefined values for missing paths", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.nonexistent.path", operator: "=", value: "test" }]
			};
			const data = { facts: {} };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].actual_value).toBeUndefined();
		});
	});

	describe("different operators", () => {
		const baseData = {
			facts: {
				score: 750,
				status: "active",
				amount: 1000,
				tags: ["premium", "vip"],
				name: "Test User"
			}
		};

		it("should evaluate = operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.status", operator: "=", value: "active" }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate != operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.status", operator: "!=", value: "inactive" }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate > operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: ">", value: 700 }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate < operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: "<", value: 800 }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate >= operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: ">=", value: 750 }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate <= operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: "<=", value: 750 }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate IN operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.status", operator: "IN", value: ["active", "pending"] }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate NOT_IN operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.status", operator: "NOT_IN", value: ["inactive", "closed"] }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate CONTAINS operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.name", operator: "CONTAINS", value: "Test" }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate NOT_CONTAINS operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.name", operator: "NOT_CONTAINS", value: "Invalid" }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate BETWEEN operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: "BETWEEN", value: [700, 800] }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate IS_NULL operator correctly", () => {
			const data = { facts: { value: null } };
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.value", operator: "IS_NULL", value: null }]
			};

			const result = evaluateDSLWithTracking(dsl, data);
			expect(result.result).toBe(true);
		});

		it("should evaluate IS_NOT_NULL operator correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.score", operator: "IS_NOT_NULL", value: null }]
			};

			const result = evaluateDSLWithTracking(dsl, baseData);
			expect(result.result).toBe(true);
		});

		it("should evaluate REGEX_MATCH operator correctly when value matches pattern", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.code", operator: "REGEX_MATCH", value: "^[A-Z]{2}-\\d+$" }]
			};
			const data = { facts: { code: "AB-123" } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.true_conditions[0].operator).toBe("REGEX_MATCH");
			expect(result.true_conditions[0].actual_value).toBe("AB-123");
		});

		it("should evaluate REGEX_MATCH operator correctly when value does not match pattern", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.code", operator: "REGEX_MATCH", value: "^[A-Z]{2}-\\d+$" }]
			};
			const data = { facts: { code: "invalid" } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].operator).toBe("REGEX_MATCH");
			expect(result.false_conditions[0].actual_value).toBe("invalid");
		});

		it("should evaluate REGEX_MATCH as false when field value is not a string (e.g. null)", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.code", operator: "REGEX_MATCH", value: "^.+$" }]
			};
			const data = { facts: { code: null } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].actual_value).toBeNull();
		});
	});

	describe("complex real-world scenarios", () => {
		it("should evaluate all OR conditions without short-circuit", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.primary_address.country", operator: "!=", value: "US" },
					{ field: "facts.address_match_boolean", operator: "=", value: true },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.primary_address.country_2", operator: "!=", value: "US" },
							{ field: "facts.address_match_boolean_2", operator: "=", value: true }
						]
					}
				]
			};

			const data = {
				facts: {
					primary_address: {
						country: "CA",
						country_2: "CO"
					},
					address_match_boolean: true,
					address_match_boolean_2: false
				}
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(3);
			expect(result.false_conditions).toHaveLength(1);

			const trueFields = result.true_conditions.map(c => c.field);
			expect(trueFields).toContain("facts.primary_address.country");
			expect(trueFields).toContain("facts.address_match_boolean");
			expect(trueFields).toContain("facts.primary_address.country_2");

			expect(result.false_conditions[0].field).toBe("facts.address_match_boolean_2");
		});

		it("should evaluate all OR conditions when first ones fail", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "active" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.score", operator: ">=", value: 900 },
							{ field: "facts.verified", operator: "=", value: true }
						]
					}
				]
			};

			const data = {
				facts: { status: "active", score: 750, verified: true }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(2);
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].field).toBe("facts.score");
		});

		it("should evaluate all AND conditions even when first fails", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.country", operator: "!=", value: "US" },
					{ field: "facts.verified", operator: "=", value: true }
				]
			};

			const data = {
				facts: { country: "US", verified: true }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].field).toBe("facts.country");
			expect(result.true_conditions).toHaveLength(1);
			expect(result.true_conditions[0].field).toBe("facts.verified");
		});

		it("should track all conditions even when result is true", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "SUBMITTED" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.score", operator: ">=", value: 900 },
							{ field: "facts.verified", operator: "=", value: true }
						]
					}
				]
			};

			const data = {
				case: { status: "SUBMITTED" },
				facts: { score: 750, verified: true }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(2);
			expect(result.false_conditions).toHaveLength(1);

			expect(result.false_conditions[0].field).toBe("facts.score");
			expect(result.false_conditions[0].actual_value).toBe(750);
		});
	});

	describe("edge cases", () => {
		it("should handle empty conditions array", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: []
			};
			const data = { facts: {} };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(0);
			expect(result.false_conditions).toHaveLength(0);
		});

		it("should handle boolean values correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.is_active", operator: "=", value: true }]
			};
			const data = { facts: { is_active: true } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions[0].actual_value).toBe(true);
		});

		it("should handle numeric zero correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.count", operator: "=", value: 0 }]
			};
			const data = { facts: { count: 0 } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.true_conditions[0].actual_value).toBe(0);
		});

		it("should handle empty string correctly", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [{ field: "facts.name", operator: "=", value: "" }]
			};
			const data = { facts: { name: "" } };

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
		});
	});

	describe("first failed condition tracking (via false_conditions[0])", () => {
		it("should have first failed condition as first element in false_conditions array", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "inactive" },
					{ field: "facts.score", operator: ">=", value: 800 }
				]
			};
			const data = {
				facts: { status: "active", score: 750 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions.length).toBeGreaterThan(0);
			expect(result.false_conditions[0]).toBeDefined();
			expect(result.false_conditions[0]?.field).toBe("facts.status");
			expect(result.false_conditions[0]?.expected_value).toBe("inactive");
			expect(result.false_conditions[0]?.actual_value).toBe("active");
		});

		it("should have first condition in OR that fails as first element when OR fails completely", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "active" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.score", operator: ">=", value: 900 },
							{ field: "facts.verified", operator: "=", value: true }
						]
					}
				]
			};
			const data = {
				facts: { status: "active", score: 750, verified: false }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions.length).toBeGreaterThan(0);
			expect(result.false_conditions[0]?.field).toBe("facts.score");
			expect(result.false_conditions[0]?.expected_value).toBe(900);
			expect(result.false_conditions[0]?.actual_value).toBe(750);
		});

		it("should have first failed condition as first element in false_conditions array", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "active" },
					{
						operator: "OR",
						conditions: [
							{ field: "facts.score", operator: ">=", value: 900 },
							{ field: "facts.verified", operator: "=", value: true }
						]
					},
					{ field: "facts.country", operator: "!=", value: "US" }
				]
			};
			const data = {
				facts: { status: "active", score: 750, verified: true, country: "US" }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions.length).toBeGreaterThan(0);
			expect(result.false_conditions[0]?.field).toBe("facts.score");
			expect(result.false_conditions[0]?.expected_value).toBe(900);
			expect(result.false_conditions[0]?.actual_value).toBe(750);
		});

		it("should have empty false_conditions array when all conditions pass", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "active" },
					{ field: "facts.score", operator: ">=", value: 700 }
				]
			};
			const data = {
				facts: { status: "active", score: 750 }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(true);
			expect(result.false_conditions).toHaveLength(0);
		});

		it("should have first failed condition as first element even when multiple fail", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "facts.status", operator: "=", value: "inactive" },
					{ field: "facts.score", operator: ">=", value: 900 },
					{ field: "facts.country", operator: "!=", value: "US" }
				]
			};
			const data = {
				facts: { status: "active", score: 750, country: "US" }
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.false_conditions).toHaveLength(3);
			expect(result.false_conditions[0]).toBeDefined();
			expect(result.false_conditions[0]?.field).toBe("facts.status");
			expect(result.false_conditions[0]?.expected_value).toBe("inactive");
		});
	});

	describe("array path ([*]) - owner verification (all owners must satisfy AND)", () => {
		// Data: multiple owners under facts.owner_verification (keyed by owner ID).
		// Rules: conditions whose field path contains [*] resolve to an array (one value per owner) and are combined with AND (all must satisfy).
		const ownerVerificationData = {
			facts: {
				owner_verification: {
					"a1c0c045-8729-4758-8aa7-4dc5c58c4007": {
						email_report: {
							name: "match",
							email: "rahul.muwal+7@joinworth.com",
							is_deliverable: "yes",
							breach_count: 1,
							first_breached_at: "2020-12-25",
							last_breached_at: "2020-12-25",
							domain_registered_at: "2010-12-25",
							domain_is_free_provider: "no",
							domain_is_disposable: "no",
							top_level_domain_is_suspicious: "no",
							ip_spam_list_count: null
						},
						fraud_report: {
							name: "match",
							user_interactions: null,
							fraud_ring_detected: null,
							bot_detected: null,
							synthetic_identity_risk_score: 2,
							stolen_identity_risk_score: 17
						}
					},
					"e1b40d1c-5f52-4a83-ab67-0edc61f6ae7f": {
						email_report: {
							name: "match",
							email: "rahul.muwal+9878@joinworth.com",
							is_deliverable: "yes",
							breach_count: 1,
							first_breached_at: "2020-12-25",
							last_breached_at: "2020-12-25",
							domain_registered_at: "2010-12-25",
							domain_is_free_provider: "no",
							domain_is_disposable: "no",
							top_level_domain_is_suspicious: "no",
							ip_spam_list_count: null
						},
						fraud_report: {
							name: "match",
							user_interactions: null,
							fraud_ring_detected: null,
							bot_detected: null,
							synthetic_identity_risk_score: null,
							stolen_identity_risk_score: null
						}
					}
				}
			}
		};

		it("should resolve [*] path to array and require all elements to satisfy (AND) - fails when one value is null", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{
						field: "facts.owner_verification[*].fraud_report.synthetic_identity_risk_score",
						operator: ">",
						value: 1
					}
				]
			};

			const result = evaluateDSLWithTracking(dsl, ownerVerificationData);

			// Resolved array is [2, null]. 2 > 1 true, null > 1 is false (null coerces to 0) -> AND fails
			expect(result.result).toBe(false);
			expect(result.true_conditions).toHaveLength(0);
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].field).toBe(
				"facts.owner_verification[*].fraud_report.synthetic_identity_risk_score"
			);
			expect(result.false_conditions[0].actual_value).toEqual([2, null]);
			expect(result.false_conditions[0].expected_value).toBe(1);
		});

		it("should pass when all owner values satisfy the condition (AND)", () => {
			// Both owners have numeric synthetic_identity_risk_score; both <= 20
			const dataBothNumeric = {
				facts: {
					owner_verification: {
						"a1c0c045-8729-4758-8aa7-4dc5c58c4007": {
							fraud_report: { synthetic_identity_risk_score: 2, stolen_identity_risk_score: 17 }
						},
						"e1b40d1c-5f52-4a83-ab67-0edc61f6ae7f": {
							fraud_report: { synthetic_identity_risk_score: 5, stolen_identity_risk_score: 3 }
						}
					}
				}
			};

			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{
						field: "facts.owner_verification[*].fraud_report.synthetic_identity_risk_score",
						operator: "<=",
						value: 20
					}
				]
			};

			const result = evaluateDSLWithTracking(dsl, dataBothNumeric);

			// Resolved array [2, 5]; both <= 20 -> AND true
			expect(result.result).toBe(true);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.true_conditions[0].actual_value).toEqual([2, 5]);
			expect(result.false_conditions).toHaveLength(0);
		});

		it("should combine array-path condition with other conditions in AND", () => {
			const dsl: DSLRule = {
				operator: "AND",
				conditions: [
					{ field: "case.status", operator: "=", value: "SUBMITTED" },
					{
						field: "facts.owner_verification[*].fraud_report.stolen_identity_risk_score",
						operator: ">",
						value: 5
					}
				]
			};
			// stolen_identity_risk_score resolved to [17, null]; 17>5 true, null>5 false -> condition false
			const data = {
				case: { status: "SUBMITTED" },
				...ownerVerificationData
			};

			const result = evaluateDSLWithTracking(dsl, data);

			expect(result.result).toBe(false);
			expect(result.true_conditions).toHaveLength(1);
			expect(result.true_conditions[0].field).toBe("case.status");
			expect(result.false_conditions).toHaveLength(1);
			expect(result.false_conditions[0].field).toBe(
				"facts.owner_verification[*].fraud_report.stolen_identity_risk_score"
			);
			expect(result.false_conditions[0].actual_value).toEqual([17, null]);
		});
	});
});
