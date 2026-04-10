// @ts-nocheck

import { v4 as uuidv4 } from "uuid";
import { BusinessApiError } from "../error";

const mockSendEventToGatherWebhookData = jest.fn();

jest.mock("#common/index", () => {
	const actual = jest.requireActual("#common/index");
	return {
		...actual,
		sendEventToGatherWebhookData: (...args: unknown[]) => mockSendEventToGatherWebhookData(...args)
	};
});

const mockDb = jest.fn();

jest.mock("#helpers/index", () => {
	const actual = jest.requireActual("#helpers/index");
	return {
		...actual,
		db: (...args: unknown[]) => mockDb(...args)
	};
});

import { businesses } from "../businesses";

describe("businesses.updateBusinessDisplayProfile", () => {
	const businessID = uuidv4();
	const userId = uuidv4();

	beforeEach(() => {
		jest.clearAllMocks();
		mockDb.mockReset();
	});

	it("throws BusinessApiError when business is not found", async () => {
		const updateDBASpy = jest.spyOn(businesses, "updateDBAName").mockResolvedValue(true);

		mockDb.mockImplementation((table: string) => {
			if (table === "data_businesses") {
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue(undefined)
				};
			}
			throw new Error(`unexpected table: ${table}`);
		});

		await expect(
			businesses.updateBusinessDisplayProfile({ name: "Any" }, { businessID }, { user_id: userId })
		).rejects.toThrow(BusinessApiError);

		await expect(
			businesses.updateBusinessDisplayProfile({ name: "Any" }, { businessID }, { user_id: userId })
		).rejects.toMatchObject({ message: "Business not found" });

		expect(updateDBASpy).not.toHaveBeenCalled();
		expect(mockSendEventToGatherWebhookData).not.toHaveBeenCalled();
		updateDBASpy.mockRestore();
	});

	it("updates legal name and delegates DBAs to updateDBAName when dba_names is provided", async () => {
		const updateDBASpy = jest.spyOn(businesses, "updateDBAName").mockResolvedValue(true);

		let businessesTableCalls = 0;
		mockDb.mockImplementation((table: string) => {
			if (table === "data_businesses") {
				businessesTableCalls += 1;
				if (businessesTableCalls === 1) {
					return {
						select: jest.fn().mockReturnThis(),
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue({ id: businessID, name: "Old Legal" })
					};
				}
				return {
					where: jest.fn().mockReturnThis(),
					update: jest.fn().mockResolvedValue(1)
				};
			}
			throw new Error(`unexpected table: ${table}`);
		});

		const result = await businesses.updateBusinessDisplayProfile(
			{ name: "New Legal", dba_names: [{ name: "  DBA One  " }, { name: "" }] },
			{ businessID },
			{ user_id: userId }
		);

		expect(result).toEqual({ business_id: businessID });
		expect(updateDBASpy).toHaveBeenCalledWith(
			{ name: "New Legal" },
			[{ name: "DBA One" }],
			{ business_id: businessID, user_id: userId }
		);
		expect(mockSendEventToGatherWebhookData).not.toHaveBeenCalled();
		updateDBASpy.mockRestore();
	});

	it("name-only with existing primary row updates data_businesses and primary name row and emits webhook", async () => {
		const updateDBASpy = jest.spyOn(businesses, "updateDBAName").mockResolvedValue(true);

		let call = 0;
		mockDb.mockImplementation((table: string) => {
			call += 1;
			if (table === "data_businesses" && call === 1) {
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue({ id: businessID, name: "Old" })
				};
			}
			if (table === "data_businesses" && call === 2) {
				const update = jest.fn().mockResolvedValue(1);
				return {
					where: jest.fn().mockReturnValue({ update })
				};
			}
			if (table === "data_business_names" && call === 3) {
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue({ id: "primary-name-row" })
				};
			}
			if (table === "data_business_names" && call === 4) {
				const update = jest.fn().mockResolvedValue(1);
				return {
					where: jest.fn().mockReturnValue({ update })
				};
			}
			throw new Error(`unexpected table/call: ${table} #${call}`);
		});

		const result = await businesses.updateBusinessDisplayProfile(
			{ name: "Only Name" },
			{ businessID },
			{ user_id: userId }
		);

		expect(result).toEqual({ business_id: businessID });
		expect(updateDBASpy).not.toHaveBeenCalled();
		expect(mockSendEventToGatherWebhookData).toHaveBeenCalled();
		updateDBASpy.mockRestore();
	});

	it("name-only without primary row inserts primary name row and emits webhook", async () => {
		const updateDBASpy = jest.spyOn(businesses, "updateDBAName").mockResolvedValue(true);

		let call = 0;
		mockDb.mockImplementation((table: string) => {
			call += 1;
			if (table === "data_businesses" && call === 1) {
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue({ id: businessID, name: "Old" })
				};
			}
			if (table === "data_businesses" && call === 2) {
				return {
					where: jest.fn().mockReturnThis(),
					update: jest.fn().mockResolvedValue(1)
				};
			}
			if (table === "data_business_names" && call === 3) {
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue(undefined)
				};
			}
			if (table === "data_business_names" && call === 4) {
				return {
					insert: jest.fn().mockResolvedValue([])
				};
			}
			throw new Error(`unexpected table/call: ${table} #${call}`);
		});

		await businesses.updateBusinessDisplayProfile({ name: "New Co" }, { businessID }, { user_id: userId });

		expect(updateDBASpy).not.toHaveBeenCalled();
		expect(mockSendEventToGatherWebhookData).toHaveBeenCalled();
		updateDBASpy.mockRestore();
	});

	it("dba-only uses existing business name when calling updateDBAName", async () => {
		const updateDBASpy = jest.spyOn(businesses, "updateDBAName").mockResolvedValue(true);

		mockDb.mockImplementation((table: string) => {
			if (table === "data_businesses") {
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue({ id: businessID, name: "Existing Legal" })
				};
			}
			throw new Error(`unexpected table: ${table}`);
		});

		await businesses.updateBusinessDisplayProfile(
			{ dba_names: [{ name: "Sole DBA" }] },
			{ businessID },
			{ user_id: userId }
		);

		expect(updateDBASpy).toHaveBeenCalledWith(
			{ name: "Existing Legal" },
			[{ name: "Sole DBA" }],
			{ business_id: businessID, user_id: userId }
		);
		expect(mockSendEventToGatherWebhookData).not.toHaveBeenCalled();
		updateDBASpy.mockRestore();
	});
});
