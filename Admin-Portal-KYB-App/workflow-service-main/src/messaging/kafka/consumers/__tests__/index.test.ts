import { handler } from "../index";
import { logger } from "#helpers/logger";
import { KAFKA_TOPICS, KAFKA_MESSAGE_KEYS } from "#constants";
import { notificationsEventsHandler } from "../notifications";
import { businessEventsHandler } from "../business";
import { EachMessagePayload } from "kafkajs";

// Mock dependencies
jest.mock("#helpers/logger");
jest.mock("../notifications");
jest.mock("../business");

describe("Kafka Handler", () => {
	const mockLogger = logger as jest.Mocked<typeof logger>;
	const mockNotificationsEventsHandler = notificationsEventsHandler as jest.MockedFunction<
		typeof notificationsEventsHandler
	>;
	const mockBusinessEventsHandler = businessEventsHandler as jest.MockedFunction<typeof businessEventsHandler>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("handler", () => {
		it("should process notifications topic messages successfully", async () => {
			// Arrange
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT),
					value: Buffer.from(
						JSON.stringify({
							event_type: "process.completion.facts",
							business_id: "123e4567-e89b-12d3-a456-426614174000",
							completion: {
								isComplete: true,
								percentage: 100,
								timestamp: "2023-01-01T00:00:00Z",
								details: {
									completed: 10,
									total: 10,
									failed: 0,
									taskTypes: []
								}
							},
							correlation: {
								case_id: "987fcdeb-51a2-43d7-8f9e-123456789abc"
							}
						})
					),
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			mockNotificationsEventsHandler.mockResolvedValue(undefined);

			// Act
			await handler(mockMessage);

			// Assert
			expect(mockLogger.info).toHaveBeenCalledWith(`Processing topic ${KAFKA_TOPICS.NOTIFICATIONS_V1}`);
			expect(mockNotificationsEventsHandler).toHaveBeenCalledWith(
				KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT,
				expect.stringContaining('"event_type":"process.completion.facts"')
			);
			expect(mockBusinessEventsHandler).not.toHaveBeenCalled();
		});

		it("should route business.v1 with CASE_STATUS_UPDATED_EVENT to business handler", async () => {
			const payload = {
				event: KAFKA_MESSAGE_KEYS.CASE_STATUS_UPDATED_EVENT,
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				business_id: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				case_status: "IN_REVIEW"
			};
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.BUSINESS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.CASE_STATUS_UPDATED_EVENT),
					value: Buffer.from(JSON.stringify(payload)),
					offset: "125",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			mockBusinessEventsHandler.mockResolvedValue(undefined);

			await handler(mockMessage);

			expect(mockBusinessEventsHandler).toHaveBeenCalledWith(
				KAFKA_MESSAGE_KEYS.CASE_STATUS_UPDATED_EVENT,
				JSON.stringify(payload)
			);
			expect(mockNotificationsEventsHandler).not.toHaveBeenCalled();
		});

		it("should route business.v1 topic to business handler", async () => {
			const payload = {
				event: KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT,
				source: "bulk_update_business_map",
				businessId: "ba1e8f99-46a3-4bed-9792-4abcc2a9051d",
				customerId: "987fcdeb-51a2-43d7-8f9e-123456789abc",
				currentState: { status: "open" },
				ruleIds: ["rule-uuid-1"]
			};
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.BUSINESS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT),
					value: Buffer.from(JSON.stringify(payload)),
					offset: "124",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			mockBusinessEventsHandler.mockResolvedValue(undefined);

			await handler(mockMessage);

			expect(mockLogger.info).toHaveBeenCalledWith(`Processing topic ${KAFKA_TOPICS.BUSINESS_V1}`);
			expect(mockBusinessEventsHandler).toHaveBeenCalledWith(
				KAFKA_MESSAGE_KEYS.BUSINESS_STATE_UPDATE_EVENT,
				JSON.stringify(payload)
			);
			expect(mockNotificationsEventsHandler).not.toHaveBeenCalled();
		});

		it("should handle empty message value", async () => {
			// Arrange - empty string value causes JSON.parse to throw, so it goes to error handler
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT),
					value: Buffer.from(""),
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			// Act
			await handler(mockMessage);

			// Assert - JSON.parse("") throws, so error handler is called
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.any(Error),
					topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
					partition: 0,
					offset: "123"
				}),
				"Error processing KAFKA message"
			);
			expect(mockNotificationsEventsHandler).not.toHaveBeenCalled();
		});

		it("should handle null message value", async () => {
			// Arrange
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT),
					value: null,
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			// Act
			await handler(mockMessage);

			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(
				`Empty message value for event: ${KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT}`
			);
			expect(mockNotificationsEventsHandler).not.toHaveBeenCalled();
		});

		it("should handle undefined message key", async () => {
			// Arrange
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
				partition: 0,
				message: {
					key: null,
					value: Buffer.from(JSON.stringify({ some: "data" })),
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			// Act
			await handler(mockMessage);

			// Assert
			expect(mockLogger.info).toHaveBeenCalledWith(`Processing topic ${KAFKA_TOPICS.NOTIFICATIONS_V1}`);
			expect(mockNotificationsEventsHandler).toHaveBeenCalledWith("", JSON.stringify({ some: "data" }));
		});

		it("should skip unknown topics", async () => {
			// Arrange
			const mockMessage: EachMessagePayload = {
				topic: "unknown-topic",
				partition: 0,
				message: {
					key: Buffer.from("SOME_EVENT"),
					value: Buffer.from(JSON.stringify({ some: "data" })),
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			// Act
			await handler(mockMessage);

			// Assert
			expect(mockLogger.info).toHaveBeenCalledWith(`Processing topic unknown-topic`);
			expect(mockNotificationsEventsHandler).not.toHaveBeenCalled();
		});

		it("should log error when notifications handler rejects", async () => {
			// Arrange
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT),
					value: Buffer.from(
						JSON.stringify({
							event_type: "process.completion.facts",
							business_id: "123e4567-e89b-12d3-a456-426614174000",
							completion: {
								isComplete: true,
								percentage: 100,
								timestamp: "2023-01-01T00:00:00Z",
								details: {
									completed: 10,
									total: 10,
									failed: 0,
									taskTypes: []
								}
							},
							correlation: {
								case_id: "987fcdeb-51a2-43d7-8f9e-123456789abc"
							}
						})
					),
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			const error = new Error("Case processing failed");
			mockNotificationsEventsHandler.mockRejectedValue(error);

			// Act
			await handler(mockMessage);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(
				{ error, topic: KAFKA_TOPICS.NOTIFICATIONS_V1, partition: 0, offset: "123" },
				"Error processing KAFKA message"
			);
		});

		it("should handle non-Error exceptions", async () => {
			// Arrange
			const mockMessage: EachMessagePayload = {
				topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
				partition: 0,
				message: {
					key: Buffer.from(KAFKA_MESSAGE_KEYS.INTEGRATION_CATEGORY_COMPLETE_EVENT),
					value: Buffer.from(
						JSON.stringify({
							event_type: "process.completion.facts",
							business_id: "123e4567-e89b-12d3-a456-426614174000",
							completion: {
								isComplete: true,
								percentage: 100,
								timestamp: "2023-01-01T00:00:00Z",
								details: {
									completed: 10,
									total: 10,
									failed: 0,
									taskTypes: []
								}
							},
							correlation: {
								case_id: "987fcdeb-51a2-43d7-8f9e-123456789abc"
							}
						})
					),
					offset: "123",
					timestamp: "1640995200000",
					headers: {},
					attributes: 0
				},
				heartbeat: jest.fn(),
				pause: jest.fn()
			};

			mockNotificationsEventsHandler.mockRejectedValue("String error");

			// Act
			await handler(mockMessage);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					error: "String error",
					topic: KAFKA_TOPICS.NOTIFICATIONS_V1,
					partition: 0,
					offset: "123"
				}),
				"Error processing KAFKA message"
			);
		});
	});
});
