<!-- Source: https://docs.worthai.com/api-reference/auth/customers/get-customer-users.md -->
# Get Customer Users

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Customer Users

> Fetches a list of users associated with a specific customer. Accessible by respective Customer.



## OpenAPI

````yaml get /customers/{customerID}/users
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
  /customers/{customerID}/users:
    get:
      tags:
        - Customers
      summary: Get Customer Users
      description: >-
        Fetches a list of users associated with a specific customer. Accessible
        by respective Customer.
      parameters:
        - name: customerID
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: query
          in: query
          description: You can pass any query parameters as needed to filter
          required: false
          schema:
            type: object
            additionalProperties:
              type: string
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
                    example: Success
                  data:
                    type: object
                    properties:
                      records:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: string
                              format: uuid
                            first_name:
                              type: string
                            last_name:
                              type: string
                            email:
                              type: string
                              format: email
                            mobile:
                              type: string
                              nullable: true
                            is_email_verified:
                              type: boolean
                            is_first_login:
                              type: boolean
                            created_at:
                              type: string
                              format: date-time
                            created_by:
                              type: string
                              format: uuid
                            updated_at:
                              type: string
                              format: date-time
                            updated_by:
                              type: string
                              format: uuid
                            ext_auth_ref_id:
                              type: string
                              format: uuid
                            status:
                              type: string
                            subrole:
                              type: object
                              properties:
                                id:
                                  type: string
                                  format: uuid
                                code:
                                  type: string
                                display_name:
                                  type: string
                                label:
                                  type: string
                                description:
                                  type: string
                      total_pages:
                        type: integer
                      total_items:
                        type: string
              example:
                status: success
                message: Success
                data:
                  records:
                    - id: 94520740-d63c-4e02-85ca-c4e138801e73
                      first_name: Sandbox
                      last_name: CRO
                      email: dummy.customer.user@email.com
                      mobile: null
                      is_email_verified: false
                      is_first_login: true
                      created_at: '2024-02-12T14:16:49.053Z'
                      created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                      updated_at: '2024-02-12T14:16:49.053Z'
                      updated_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                      ext_auth_ref_id: ec46bd5b-0fae-47e1-8e4e-d37a5ac87e7e
                      status: ACTIVE
                      subrole:
                        id: f1fa445c-743b-4a0e-ad54-bb9294c41005
                        code: cro
                        display_name: CRO
                        label: CRO
                        description: This is Sandbox's CRO
                  total_pages: 1
                  total_items: '1'
        '400':
          $ref: '#/components/responses/BadRequest'
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