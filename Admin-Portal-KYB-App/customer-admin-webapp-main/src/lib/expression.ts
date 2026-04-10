export const evaluateCondition = (
	expression: string,
	variables: Record<string, any>,
): boolean => {
	// Step 1: Replace placeholders with actual values from the object
	Object.keys(variables).forEach((key) => {
		const value = variables[key];
		const regex = new RegExp(`{{${key}}}`, "g");
		// Wrap strings in quotes, leave numbers as is
		expression = expression.replace(
			regex,
			typeof value === "string" ? `"${value}"` : value,
		);
	});

	// Step 2: Replace logical operators (&&, ||) and comparison operators
	expression = expression
		.replace(/&&/g, "&&") // Keep JavaScript logical AND
		.replace(/\|\|/g, "||") // Keep JavaScript logical OR
		.replace(/=/g, "==="); // Convert '=' to '===' for strict comparison

	// Step 3: Split conditions and evaluate manually
	const conditionParts = expression.split("&&").map((cond) => cond.trim());

	for (const part of conditionParts) {
		if (!evaluateSimpleCondition(part)) {
			return false; // If any part fails, the whole condition is false
		}
	}

	return true; // If all parts pass, the condition is true
};

export const evaluateSimpleCondition = (condition: string): boolean => {
	// Handle comparison like "x > y" or "x === y"
	const match = condition.match(/(["\w\s;]+)\s*(===|>|<|>=|<=)\s*(["\w\s;]+)/);

	// Check if the condition pattern is valid
	if (!match) {
		return false;
	}

	const [left, operator, right] = match.slice(1);

	// Parse values as numbers if applicable, otherwise keep as strings
	const parsedLeft = isNaN(Number(left))
		? left.replace(/"/g, "").trim()
		: parseFloat(left);
	const parsedRight = isNaN(Number(right))
		? right.replace(/"/g, "").trim()
		: parseFloat(right);

	switch (operator) {
		case "===":
			return parsedLeft === parsedRight;
		case ">":
			return parsedLeft > parsedRight;
		case "<":
			return parsedLeft < parsedRight;
		case ">=":
			return parsedLeft >= parsedRight;
		case "<=":
			return parsedLeft <= parsedRight;
		default:
			return false; // Unsupported operator
	}
};
