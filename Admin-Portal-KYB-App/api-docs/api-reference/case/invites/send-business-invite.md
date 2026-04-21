<!-- Source: https://docs.worthai.com/api-reference/case/invites/send-business-invite.md -->
# Send Business Invite

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Send Business Invite

> Send an invitation to onboard a business and its applicants. You can either create a new business with the invite or reference an existing business. At least one applicant must be provided via the `applicants` array. Applicant email addresses must not use disposable email domains.



## OpenAPI

````yaml POST /customers/{customerID}/businesses/invite
openapi: 3.1.0
info:
  title: Case Service
  description: >-
    This service handles the cases for business and also the subscriptions taken
    by business.
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/case/api/v1
    variables: {}
security:
  - bearer: []
tags:
  - name: Subscriptions
  - name: Invites
  - name: Customer Bulk Functions
  - name: NAICS AND MCC
  - name: Businesses
  - name: Cases
  - name: Core
  - name: Risk Alerts
  - name: Dashboard
  - name: Onboarding
  - name: White Label
  - name: Customer
  - name: Co-Applicants
  - name: Applicants
  - name: Misc
    description: ''
paths:
  /customers/{customerID}/businesses/invite:
    parameters: []
    post:
      tags:
        - Invites
      summary: Send Business Invite
      description: >-
        Send an invitation to onboard a business and its applicants. You can
        either create a new business with the invite or reference an existing
        business. At least one applicant must be provided via the `applicants`
        array. Applicant email addresses must not use disposable email domains.
      operationId: SendBusinessInvite
      parameters:
        - name: customerID
          in: path
          description: Unique identifier of the customer sending the invitation
          required: true
          style: simple
          schema:
            type: string
            format: uuid
            examples:
              - 22f210e4-4455-4107-b132-97e8478546ea
      requestBody:
        description: >-
          Business and applicant details for the invitation. Provide either a
          `business` object to create a new business, or an
          `existing_business_id` / `existing_business` object to invite
          applicants to an existing business.
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/SendBusinessInviteRequest'
                - examples:
                    - business:
                        name: Jim Tester's Electronics
                        mobile: '6078379283'
                        address_line_1: 123 Main St
                        address_city: Orlando
                        address_state: FL
                        address_postal_code: '32801'
                      applicants:
                        - first_name: Jim
                          last_name: Tester
                          email: jim.tester@email.com
                          mobile: '6078379283'
              contentMediaType: application/json
            example:
              business:
                name: Jim Tester's Electronics
                mobile: '6078379283'
                address_line_1: 123 Main St
                address_city: Orlando
                address_state: FL
                address_postal_code: '32801'
              applicants:
                - first_name: Jim
                  last_name: Tester
                  email: jim.tester@email.com
                  mobile: '6078379283'
        required: true
      responses:
        '200':
          description: OK
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Wed, 26 Feb 2025 11:38:47 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '72'
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Content-Security-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: >-
                    default-src 'self';base-uri 'self';font-src 'self' https:
                    data:;form-action 'self';frame-ancestors 'self';img-src
                    'self' data:;object-src 'none';script-src
                    'self';script-src-attr 'none';style-src 'self' https:
                    'unsafe-inline';upgrade-insecure-requests
            Cross-Origin-Opener-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Cross-Origin-Resource-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Origin-Agent-Cluster:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '?1'
            Referrer-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: no-referrer
            Strict-Transport-Security:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: max-age=15552000; includeSubDomains
            X-Content-Type-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: nosniff
            X-DNS-Prefetch-Control:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'off'
            X-Download-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: noopen
            X-Frame-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: SAMEORIGIN
            X-Permitted-Cross-Domain-Policies:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: none
            X-XSS-Protection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '0'
            Vary:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Origin
            Access-Control-Allow-Credentials:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'true'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"48-YSxfgLlrFUtgNBkAs61B0IvLxYQ"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SendBusinessInviteResponse'
                  - examples:
                      - status: success
                        message: Business invited successfully
                        data:
                          business_id: e6fbc974-a9d3-4d1b-bd99-90a618758d6d
                          applicant_email: jim.tester@email.com
                          invitation_id: 76fd24c2-c75a-4ab0-8ee7-a1d287d8951b
                          invitation_url: >-
                            https://app.joinworth.com/invite/76fd24c2-c75a-4ab0-8ee7-a1d287d8951b
                          customer_id: 22f210e4-4455-4107-b132-97e8478546ea
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Business invited successfully
                data:
                  business_id: e6fbc974-a9d3-4d1b-bd99-90a618758d6d
                  applicant_email: jim.tester@email.com
                  invitation_id: 76fd24c2-c75a-4ab0-8ee7-a1d287d8951b
                  invitation_url: >-
                    https://app.joinworth.com/invite/76fd24c2-c75a-4ab0-8ee7-a1d287d8951b
                  customer_id: 22f210e4-4455-4107-b132-97e8478546ea
        '500':
          description: Internal Server Error
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Wed, 26 Feb 2025 11:39:51 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '174'
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Content-Security-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: >-
                    default-src 'self';base-uri 'self';font-src 'self' https:
                    data:;form-action 'self';frame-ancestors 'self';img-src
                    'self' data:;object-src 'none';script-src
                    'self';script-src-attr 'none';style-src 'self' https:
                    'unsafe-inline';upgrade-insecure-requests
            Cross-Origin-Opener-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Cross-Origin-Resource-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Origin-Agent-Cluster:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '?1'
            Referrer-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: no-referrer
            Strict-Transport-Security:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: max-age=15552000; includeSubDomains
            X-Content-Type-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: nosniff
            X-DNS-Prefetch-Control:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'off'
            X-Download-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: noopen
            X-Frame-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: SAMEORIGIN
            X-Permitted-Cross-Domain-Policies:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: none
            X-XSS-Protection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '0'
            Vary:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Origin
            Access-Control-Allow-Credentials:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'true'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"ae-A6iCqigge8z0SXpFdTyZkLyzBNs"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ErrorTryingToInviteAnotherBusiness'
                  - examples:
                      - status: error
                        message: >-
                          This business was not onboarded by the current
                          customer.
                        errorCode: UNKNOWN_ERROR
                        data:
                          errorName: BusinessApiError
                          data:
                            data: {}
                contentMediaType: application/json; charset=utf-8
              example:
                status: error
                message: This business was not onboarded by the current customer.
                errorCode: UNKNOWN_ERROR
                data:
                  errorName: BusinessApiError
                  data:
                    data: {}
      deprecated: false
      servers:
        - url: https://api.joinworth.com/case/api/v1
          variables: {}
components:
  schemas:
    SendBusinessInviteRequest:
      title: SendBusinessInviteRequest
      type: object
      required:
        - applicants
      properties:
        business:
          type: object
          description: >-
            Details for creating a new business with the invitation. Cannot be
            used together with `existing_business_id` or `existing_business`.
          required:
            - name
          properties:
            name:
              type: string
              description: Legal business name
            mobile:
              type: string
              description: >-
                Business phone number. Must be a valid phone number, max 15
                characters.
              maxLength: 15
            tin:
              type: string
              description: Tax Identification Number (EIN) for the business
            dba:
              type: string
              description: Doing Business As name, if different from the legal name
            address_line_1:
              type: string
              description: Street address line 1
            address_line_2:
              type: string
              description: Street address line 2 (suite, unit, etc.)
            address_city:
              type: string
              description: City
            address_state:
              type: string
              description: State or province
            address_postal_code:
              type: string
              description: ZIP or postal code
        existing_business_id:
          type: string
          format: uuid
          description: >-
            UUID of an existing business to send the invitation for. Cannot be
            used together with `business` or `existing_business`.
        existing_business:
          type: object
          description: >-
            Reference to an existing business with additional context. Cannot be
            used together with `business` or `existing_business_id`.
          required:
            - business_id
            - name
          properties:
            business_id:
              type: string
              format: uuid
              description: UUID of the existing business
            name:
              type: string
              description: Business name for confirmation
            is_quick_add:
              type: boolean
              description: >-
                When true, creates new business records from the existing
                business reference
        case_id:
          type: string
          format: uuid
          description: >-
            UUID of an existing case to associate with the invitation. Only
            applicable when using `existing_business_id` or `existing_business`.
        applicants:
          type: array
          description: List of applicants to invite. At least one applicant is required.
          minItems: 1
          items:
            $ref: '#/components/schemas/Applicant'
        existing_applicant_ids:
          type: array
          description: UUIDs of existing applicants to include in the invitation
          items:
            type: string
            format: uuid
        esign_template_id:
          type: string
          format: uuid
          description: UUID of an e-sign template to attach to the invitation
        esign_templates:
          type: array
          description: List of e-sign template UUIDs to attach to the invitation
          items:
            type: string
            format: uuid
        custom_field_template_id:
          type: string
          format: uuid
          description: UUID of a custom field template to apply to the invitation
        custom_fields:
          type: object
          description: >-
            Custom field values to prefill on the invitation, keyed by field
            identifier
    SendBusinessInviteResponse:
      title: SendBusinessInviteResponse
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          type: object
          properties:
            business_id:
              type: string
              format: uuid
              description: Unique identifier for the invited business
            applicant_email:
              type: string
              format: email
              description: Email address of the first applicant in the invitation
            invitation_id:
              type: string
              format: uuid
              description: Unique identifier for this invitation
            invitation_url:
              type:
                - string
                - 'null'
              format: uri
              description: >-
                URL leading to the sign-up form for the invited applicant. May
                not be present in all responses.
            customer_id:
              type: string
              format: uuid
              description: Unique identifier of the customer who sent the invite
      examples:
        - status: success
          message: Business invited successfully
          data:
            business_id: e6fbc974-a9d3-4d1b-bd99-90a618758d6d
            applicant_email: jim.tester@email.com
            invitation_id: 76fd24c2-c75a-4ab0-8ee7-a1d287d8951b
            invitation_url: >-
              https://app.joinworth.com/invite/76fd24c2-c75a-4ab0-8ee7-a1d287d8951b
            customer_id: 22f210e4-4455-4107-b132-97e8478546ea
    ErrorTryingToInviteAnotherBusiness:
      title: ErrorTryingToInviteAnotherBusiness
      required:
        - status
        - message
        - errorCode
        - data
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        errorCode:
          type: string
        data:
          $ref: '#/components/schemas/Data'
      examples:
        - status: error
          message: This business was not onboarded by the current customer.
          errorCode: UNKNOWN_ERROR
          data:
            errorName: BusinessApiError
            data:
              data: {}
    Applicant:
      title: Applicant
      type: object
      required:
        - first_name
        - last_name
        - email
      properties:
        first_name:
          type: string
          description: Applicant's first name
        last_name:
          type: string
          description: Applicant's last name
        email:
          type: string
          format: email
          description: >-
            Applicant's email address. Must be a valid email and cannot use a
            disposable email domain.
        mobile:
          type: string
          description: >-
            Applicant's phone number. Must be a valid phone number, max 15
            characters.
          maxLength: 15
    Data:
      title: Data
      required:
        - errorName
        - data
      type: object
      properties:
        errorName:
          type: string
        data:
          $ref: '#/components/schemas/Data2'
      examples:
        - errorName: BusinessApiError
          data:
            data: {}
    Data2:
      title: Data2
      required:
        - data
      type: object
      properties:
        data:
          type: object
      examples:
        - data: {}
  securitySchemes:
    bearer:
      type: http
      scheme: bearer
      bearerFormat: JWT

````