<!-- Source: https://docs.worthai.com/api-reference/auth/customers/get-customer-user-by-id.md -->
# Get Customer User By ID

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Customer User By ID

> Fetch details of a specific user associated with a customer.



## OpenAPI

````yaml get /customers/{customerID}/users/{userID}
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
  /customers/{customerID}/users/{userID}:
    get:
      tags:
        - Customers
      summary: Get Customer User By ID
      description: Fetch details of a specific user associated with a customer.
      parameters:
        - name: customerID
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: userID
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
                  message:
                    type: string
                  data:
                    type: object
                    properties:
                      id:
                        type: string
                        format: uuid
                        description: Unique identifier for the user
                        example: 94520740-d63c-4e02-85ca-c4e138801e73
                      first_name:
                        type: string
                        description: First name of the user
                      last_name:
                        type: string
                        description: Last name of the user
                      email:
                        type: string
                        format: email
                        description: Email address of the user
                      mobile:
                        type: string
                        nullable: true
                        description: Mobile phone number of the user, if provided
                      is_email_verified:
                        type: boolean
                        description: >-
                          Whether the email address of the user has been
                          verified
                      is_first_login:
                        type: boolean
                        description: >-
                          True if the user has not yet completed their first
                          login flow
                      created_at:
                        type: string
                        format: date-time
                        description: Timestamp when the user was created
                      created_by:
                        type: string
                        format: uuid
                        description: ID of the actor who created this user
                      updated_at:
                        type: string
                        format: date-time
                        description: Timestamp of the last update to this user
                      updated_by:
                        type: string
                        format: uuid
                        description: ID of the actor who last updated this user
                      status:
                        type: string
                        description: Active/Inactive state of user
                        enum:
                          - ACTIVE
                          - INACTIVE
                      company_details:
                        type: object
                        description: >-
                          The company record of the customer associated with
                          this user
                        properties:
                          id:
                            type: string
                            format: uuid
                            description: Unique identifier for the company
                          name:
                            type: string
                            description: Company name
                          contact_number:
                            type: string
                            nullable: true
                            description: Company contact phone, if available
                          is_active:
                            type: boolean
                            description: Whether the company account is active
                          created_at:
                            type: string
                            format: date-time
                            description: Timestamp when the company was created
                          created_by:
                            type: string
                            format: uuid
                            description: ID of who created the company record
                          updated_at:
                            type: string
                            format: date-time
                            description: Timestamp of last company record update
                          updated_by:
                            type: string
                            format: uuid
                            description: ID of who last updated the company record
                      subrole:
                        type: object
                        description: The assigned subrole of the user
                        properties:
                          id:
                            type: string
                            format: uuid
                            description: Subrole identifier
                          code:
                            type: string
                            description: Machine-readable code for the subrole
                          label:
                            type: string
                            description: Human-readable label for the subrole
                          role_id:
                            type: integer
                            description: Numeric ID of the parent role
                          display_name:
                            type: string
                            description: Display name for the subrole
              example:
                status: success
                message: Success
                data:
                  id: 94520740-d63c-4e02-85ca-c4e138801e73
                  first_name: Sandbox
                  last_name: CRO
                  email: dummy.customer.user@email.com
                  mobile: null
                  is_email_verified: false
                  is_first_login: true
                  created_at: '2024-02-12T14:16:49.053328'
                  created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                  updated_at: '2024-02-12T14:16:49.053328'
                  updated_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                  status: ACTIVE
                  company_details:
                    id: 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
                    name: Sandbox
                    contact_number: null
                    is_active: true
                    created_at: '2024-02-12T09:26:48.247698'
                    created_by: 9e18e65b-8ab5-48fd-87ad-3b586146a00f
                    updated_at: '2024-02-12T09:26:48.247698'
                    updated_by: 9e18e65b-8ab5-48fd-87ad-3b586146a00f
                  subrole:
                    id: f1fa445c-743b-4a0e-ad54-bb9294c41005
                    code: cro
                    label: CRO
                    role_id: 2
                    display_name: CRO
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          description: Not Found
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
                    example: Customer user Not Found
                  errorCode:
                    type: string
                    example: NOT_FOUND
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
                message: Customer user Not Found
                errorCode: NOT_FOUND
                data:
                  errorName: CustomersApiError
        '500':
          $ref: '#/components/responses/InternalServerError'
      security:
        - bearerAuth: []
components:
  responses:
    BadRequest:
      description: Invalid Request
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Error occurred
              errorCode:
                type: string
                example: ERR_INTERNAL_SERVER
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