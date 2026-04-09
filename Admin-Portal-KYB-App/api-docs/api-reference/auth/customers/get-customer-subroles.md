<!-- Source: https://docs.worthai.com/api-reference/auth/customers/get-customer-subroles.md -->
# Get Customer Subroles

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Customer Subroles

> Fetches a list of subroles associated with a specific customer. Accessible by respective Customer.



## OpenAPI

````yaml get /customers/{customerID}/subroles
openapi: 3.1.0
info:
  title: Auth Service
  version: 1.0.0
  description: API documentation for Auth Service
servers:
  - url: https://api.joinworth.com/auth/api/v1
    description: Production server
security: []
paths:
  /customers/{customerID}/subroles:
    get:
      tags:
        - Customers
      summary: Get Customer Subroles
      description: >-
        Fetches a list of subroles associated with a specific customer.
        Accessible by respective Customer.
      parameters:
        - name: customerID
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: success
                  message:
                    type: string
                    example: Customer subroles fetched successfully.
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        code:
                          type: string
                          example: cro
                        label:
                          type: string
                          example: CRO
                        id:
                          type: string
                          format: uuid
                          example: cdc69893-6d14-4ba5-a8a8-a0ba79f966b0
                        display_name:
                          type: string
                          example: CRO
              example:
                status: success
                message: Customer subroles fetched successfully.
                data:
                  - code: cro
                    label: CRO
                    id: cdc69893-6d14-4ba5-a8a8-a0ba79f966b0
                    display_name: CRO
                  - code: risk_analyst
                    label: Risk Analyst
                    id: cececa89-aa54-4433-8184-ec0598392811
                    display_name: Risk Analyst
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: fail
                  message:
                    type: string
                    example: Customer does not exists
                  errorCode:
                    type: string
                    example: INVALID
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: CustomersApiError
                    required:
                      - errorName
                required:
                  - status
                  - message
                  - errorCode
                  - data
              example:
                status: fail
                message: Customer does not exists
                errorCode: INVALID
                data:
                  errorName: CustomersApiError
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
      security:
        - bearerAuth: []
components:
  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Unauthorized
              errorCode:
                type: string
                example: ERR_UNAUTHORIZED
    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Forbidden
              errorCode:
                type: string
                example: ERR_FORBIDDEN
    InternalServerError:
      description: Internal Server Error
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Internal Server Error
              errorCode:
                type: string
                example: ERR_INTERNAL_SERVER
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

````

Built with [Mintlify](https://mintlify.com).