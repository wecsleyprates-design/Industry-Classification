import { schema } from "../schema";
import { v4 as uuidv4 } from "uuid";

describe("schema.updateBusinessDisplayProfile", () => {
	const businessID = uuidv4();
	const userId = uuidv4();

	const validateBody = (body: Record<string, unknown>) =>
		schema.updateBusinessDisplayProfile.body.validate(body, { abortEarly: false });

	const validateParams = (params: Record<string, unknown>) =>
		schema.updateBusinessDisplayProfile.params.validate(params, { abortEarly: false });

	it("accepts body with name only", () => {
		const { error, value } = validateBody({
			userId,
			name: "Acme LLC",
		});
		expect(error).toBeUndefined();
		expect(value.name).toBe("Acme LLC");
	});

	it("accepts body with dba_names only", () => {
		const { error, value } = validateBody({
			userId,
			dba_names: [{ name: "Acme Store" }],
		});
		expect(error).toBeUndefined();
		expect(value.dba_names).toHaveLength(1);
	});

	it("accepts body with name and dba_names", () => {
		const { error } = validateBody({
			userId,
			name: "Acme LLC",
			dba_names: [{ name: "Acme Store" }, { name: "Acme Shop" }],
		});
		expect(error).toBeUndefined();
	});

	it("accepts empty dba_names array to clear DBAs", () => {
		const { error } = validateBody({
			userId,
			dba_names: [],
		});
		expect(error).toBeUndefined();
	});

	it("rejects body when neither name nor dba_names is provided", () => {
		const { error } = validateBody({
			userId,
		});
		expect(error).toBeDefined();
	});

	it("rejects invalid businessID param", () => {
		const { error } = validateParams({ businessID: "not-a-uuid" });
		expect(error).toBeDefined();
	});

	it("accepts valid businessID param", () => {
		const { error } = validateParams({ businessID });
		expect(error).toBeUndefined();
	});
});
