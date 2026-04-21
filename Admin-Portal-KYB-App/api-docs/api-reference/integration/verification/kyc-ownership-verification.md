<!-- Source: https://docs.worthai.com/api-reference/integration/verification/kyc-ownership-verification.md -->
# KYC Ownership Verification

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# KYC Ownership Verification

> Know Your Customer: returns a list of individuals with ownership or control, including their submitted personal details and verification results.

Prior to utilizing this service, one must first obtain a businessID by creating a business via the [Add business](https://docs.worthai.com/api-reference/add-or-update-business/add-business) service. For more details on using these endpoints, please reference the [Getting Started](https://docs.worthai.com/getting-started/overview) guide.



## OpenAPI

````yaml get /verification/businesses/{businessId}/owners
openapi: 3.1.0
info:
  title: Integration Service
  description: >-
    This service is responsible for all integrations and contains all
    integration information about the business.
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/integration/api/v1
    variables: {}
  - url: http://localhost:3005/api/v1/accounting/taxStatus
    variables: {}
  - url: http://example.com
    variables: {}
  - url: http://localhost:3000/api/v1
    variables: {}
security: []
tags:
  - name: Banking
  - name: Financials
  - name: Accounting
  - name: Public Records
  - name: manual-filing
  - name: Taxation
  - name: OpenCorporates
  - name: ZoomInfo
  - name: Verification
  - name: Verification
  - name: FAQ Chatbot
  - name: Applicants
  - name: Extract Document Details
  - name: Charts / Stats
  - name: Credit Bureau (Equifax)
  - name: Insights
    description: >-
      AI Insights Assistant that can help generate an insights report.
      Additionally users can converse with a chatbot about their report.
  - name: Risk Alerts
  - name: Queue Management
  - name: Data Scrape
  - name: White Label
  - name: File Executions
  - name: Files
  - name: OCR
  - name: Customer Integration Settings
  - name: Facts
    description: >-
      Facts provide a common interface to pick the most authoritative values for
      attribues that may be sourced from different sources.


      E.g.: Which address do we surface as the primary address for a business?
      Determine that by collecting all addresses we have and returning the
      address with the highest degree of confidence.
  - name: Adverse Media
  - name: Misc
    description: ''
paths:
  /verification/businesses/{businessId}/owners:
    parameters: []
    get:
      tags:
        - Verification
      summary: KYC Ownership Verification
      description: >-
        Know Your Customer: returns a list of individuals with ownership or
        control, including their submitted personal details and verification
        results.


        Prior to utilizing this service, one must first obtain a businessID by
        creating a business via the [Add
        business](https://docs.worthai.com/api-reference/add-or-update-business/add-business)
        service. For more details on using these endpoints, please reference the
        [Getting Started](https://docs.worthai.com/getting-started/overview)
        guide.
      operationId: KYCOwnershipVerification
      parameters:
        - name: businessId
          in: path
          description: The unique universal identifier string for the business.
          required: true
          example: 74cf5442-6f51-4666-bed8-0bee0ca793cc
          style: simple
          schema:
            type: string
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
                  example: Wed, 02 Apr 2025 09:11:02 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '1734'
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
                  example: W/"6c6-Qy6NdKC1uBkywmBcWXV16zqKrGQ"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - type: object
                    properties:
                      status:
                        type: string
                        description: Indicates whether the request succeeded or failed.
                        enum:
                          - success
                          - fail
                        example: success
                      message:
                        type: string
                        description: Descriptive message about the result of the operation.
                        example: KYC Ownership Verification fetched successfully
                      data:
                        type: array
                        description: List of ownership verification records.
                        items:
                          type: object
                          properties:
                            id:
                              type: string
                              description: >-
                                Unique universal identifier for the ownership
                                verification record
                              example: 4e56263d-f076-4c9f-947c-9dbf8f9c3556
                            external_id:
                              type: string
                              description: External ID of the owner.
                              example: abc123
                            title:
                              type: string
                              description: The title or role of the individual.
                              enum:
                                - Partner
                                - Limited Partner
                                - Director
                                - Chief Accounting Officer
                                - Chief Executive Officer
                                - Chief Operations Officer
                                - President
                                - Vice President
                                - Treasurer
                                - Assistant Treasurer
                                - 1% Shareholder
                                - Shareholder
                                - Controller
                                - Managing Member
                                - Owner
                                - Sole Proprietor
                                - Executor
                                - Beneficiary
                                - Trustee
                                - Administrator
                            first_name:
                              type: string
                              description: First name of the customer
                              example: John
                            last_name:
                              type: string
                              description: Last name of the customer
                              example: Doe
                            email:
                              type: string
                              format: email
                              description: Email address of the customer
                              example: test@samplemail.com
                            mobile:
                              type: string
                              description: >-
                                Mobile phone number of the customer, with
                                country and area codes.
                              example: '+12345678909'
                            date_of_birth:
                              type: string
                              description: Date of birth in YYYY-MM-DD format.
                              example: '1989-07-22'
                            address_apartment:
                              type:
                                - string
                                - 'null'
                              description: Apartment or unit number
                              example: Apt 101
                            address_line_1:
                              type: string
                              description: First line of the address e.g. street address.
                              example: 123 Main St
                            address_line_2:
                              type:
                                - string
                                - 'null'
                              description: >-
                                Second line of the address (optional) e.g.
                                Building Number
                              example: Building 5
                            address_city:
                              type: string
                              description: City of the address
                              example: Orlando
                            address_state:
                              type: string
                              description: State or province of the address
                              example: FL
                            address_postal_code:
                              type: string
                              description: Postal or ZIP code
                              example: '32801'
                            address_country:
                              type: string
                              description: Country of the address
                              example: USA
                            created_at:
                              type: string
                              format: date-time
                              description: Timestamp when the record was created
                              example: '2025-04-01T07:24:55.205Z'
                            created_by:
                              type: string
                              description: >-
                                Unique universal identifier of the user who
                                created the record
                              example: 7882addb-9b7e-436b-8392-38c713dc47aa
                            updated_at:
                              type: string
                              format: date-time
                              description: Timestamp when the record was last updated
                              example: '2025-04-01T07:31:07.716Z'
                            updated_by:
                              type: string
                              description: >-
                                Identifier of the user who last updated the
                                record
                              example: 7882addb-9b7e-436b-8392-38c713dc47aa
                            business_id:
                              type: string
                              description: UUID of the business this owner is linked to.
                              example: df3998ab-7111-4c01-9f4f-d9bd6467c3b6
                            owner_type:
                              type: string
                              description: >-
                                Whether the owner has control (CONTROL) or
                                beneficial interest only (BENEFICIARY).
                              example: CONTROL
                            ownership_percentage:
                              type: string
                              description: >-
                                Percentage of the business owned by this person,
                                as a decimal string (e.g. "100.00").
                              example: '100.00'
                            kyc_check:
                              type: object
                              description: >-
                                Results of the KYC verification check for this
                                customer
                              properties:
                                name:
                                  type: object
                                  description: An object containing the `summary` property
                                  properties:
                                    summary:
                                      type: string
                                      description: >-
                                        Whether the name matches official
                                        records
                                      enum:
                                        - match
                                        - no_match
                                status:
                                  type: string
                                  description: Overall KYC check result status
                                  enum:
                                    - success
                                    - failed
                                address:
                                  type: object
                                  description: >-
                                    An object containing the `type`, `po_box`,
                                    and `summary` properties
                                  properties:
                                    type:
                                      type: string
                                      description: >-
                                        Result of address type check, `no_data`
                                        if not found
                                      example: commercial
                                    po_box:
                                      type: string
                                      description: >-
                                        Result of PO Box check, `no` if not
                                        found
                                      example: '432'
                                    summary:
                                      type: string
                                      description: >-
                                        Whether a match was found for address
                                        verification
                                      enum:
                                        - match
                                        - no_match
                                id_number:
                                  type: object
                                  description: An object containing the `summary` property
                                  properties:
                                    summary:
                                      type: string
                                      description: Match status of the ID number
                                      enum:
                                        - match
                                        - no_match
                                phone_number:
                                  type: object
                                  description: >-
                                    An object containing the `summary` and
                                    `area_code` properties
                                  properties:
                                    summary:
                                      type: string
                                      description: Phone number match status
                                      enum:
                                        - match
                                        - no_match
                                    area_code:
                                      type: string
                                      description: Area code match status
                                      enum:
                                        - match
                                        - no_match
                                date_of_birth:
                                  type: object
                                  properties:
                                    summary:
                                      type: string
                                      description: Date of birth match status
                                      enum:
                                        - match
                                        - no_match
                            risk_check_result:
                              type:
                                - object
                                - 'null'
                              description: >-
                                Results of risk checks including name, address,
                                DOB, SSN, phone, email, and verification steps
                              properties:
                                name:
                                  type: string
                                  description: Name match result
                                  example: match
                                address:
                                  type: object
                                  properties:
                                    type:
                                      type: string
                                      example: no_data
                                    po_box:
                                      type: string
                                      example: no_data
                                    summary:
                                      type: string
                                      example: match
                                dob:
                                  type: string
                                  description: Date of birth match result
                                  example: match
                                ssn:
                                  type: string
                                  description: SSN match result
                                  example: match
                                phone:
                                  type: object
                                  properties:
                                    summary:
                                      type: string
                                      example: match
                                    area_code:
                                      type: string
                                      example: match
                                    linked_services:
                                      type: array
                                      items:
                                        type: string
                                      example:
                                        - facebook
                                        - google
                                        - twitter
                                        - instagram
                                        - yahoo
                                        - whatsapp
                                        - telegram
                                        - viber
                                        - ok
                                email:
                                  type: object
                                  properties:
                                    breach_count:
                                      type: integer
                                      example: 1
                                    is_deliverable:
                                      type: string
                                      example: 'yes'
                                    linked_services:
                                      type: array
                                      items:
                                        type: string
                                    domain_is_custom:
                                      type: string
                                      example: 'no'
                                    last_breached_at:
                                      type: string
                                      format: date
                                      example: '2020-12-25'
                                    first_breached_at:
                                      type: string
                                      format: date
                                      example: '2020-12-25'
                                    domain_is_disposable:
                                      type: string
                                      example: 'no'
                                    domain_registered_at:
                                      type: string
                                      example: '2010-12-25'
                                    domain_is_free_provider:
                                      type: string
                                      example: 'no'
                                    top_level_domain_is_suspicious:
                                      type: string
                                      example: 'no'
                                user_interactions:
                                  type:
                                    - object
                                    - 'null'
                                fraud_ring_detected:
                                  type:
                                    - boolean
                                    - 'null'
                                bot_detected:
                                  type:
                                    - boolean
                                    - 'null'
                                synthetic_identity_risk_score:
                                  type:
                                    - number
                                    - 'null'
                                stolen_identity_risk_score:
                                  type:
                                    - number
                                    - 'null'
                                steps:
                                  type: object
                                  description: Status of each verification step
                                  properties:
                                    kyc_check:
                                      type: string
                                      example: success
                                    accept_tos:
                                      type: string
                                      example: success
                                    risk_check:
                                      type: string
                                      example: success
                                    verify_sms:
                                      type: string
                                      example: not_applicable
                                    selfie_check:
                                      type: string
                                      example: not_applicable
                                    watchlist_screening:
                                      type: string
                                      example: not_applicable
                                    documentary_verification:
                                      type: string
                                      example: success
                                ip_spam_list_count:
                                  type: integer
                                  example: 0
                                documents_verification:
                                  type: string
                                  example: success
                            identity_verification_attempted:
                              type: boolean
                              description: >-
                                Whether identity verification was attempted for
                                this owner
                              example: true
                            idv:
                              type:
                                - object
                                - 'null'
                              description: Identity document verification results
                              properties:
                                document_integrity_results:
                                  type: array
                                  items:
                                    type: object
                                    properties:
                                      attempt:
                                        type: integer
                                        description: Attempt number
                                        example: 1
                                      plaid_document_status:
                                        type: string
                                        example: success
                                      document_integrity_status:
                                        type: string
                                        example: clear
                                      details:
                                        type: object
                                        properties:
                                          authenticity:
                                            type: string
                                            example: match
                                          image_quality:
                                            type: string
                                            example: high
                                          aamva_is_verified:
                                            type:
                                              - string
                                              - 'null'
                  - examples:
                      - status: success
                        message: KYC Ownership Verification fetched successfully
                        data:
                          - id: 47797fcf-09ff-46d7-b500-39141135c52f
                            external_id: abc-123
                            title: Director
                            first_name: Leslie
                            last_name: Knope
                            email: admin@joinworth.com
                            mobile: '+12345678909'
                            date_of_birth: '1989-07-22'
                            address_apartment: null
                            address_line_1: 123 Main St.
                            address_line_2: null
                            address_city: Pawnee
                            address_state: IN
                            address_postal_code: '46001'
                            address_country: USA
                            created_at: '2024-05-16T11:34:14.545Z'
                            created_by: 19ac7412-6c06-4742-8c52-38787c4e889a
                            updated_at: '2024-05-16T11:34:14.545Z'
                            updated_by: 19ac7412-6c06-4742-8c52-38787c4e889a
                            business_id: df3998ab-7111-4c01-9f4f-d9bd6467c3b6
                            owner_type: CONTROL
                            ownership_percentage: '100.00'
                            kyc_check:
                              name:
                                summary: match
                              status: success
                              address:
                                type: no_data
                                po_box: no_data
                                summary: match
                              id_number:
                                summary: match
                              phone_number:
                                summary: match
                                area_code: match
                              date_of_birth:
                                summary: match
                            risk_check_result:
                              name: match
                              address:
                                type: no_data
                                po_box: no_data
                                summary: match
                              dob: match
                              ssn: match
                              phone:
                                summary: match
                                area_code: match
                                linked_services:
                                  - facebook
                                  - google
                                  - twitter
                                  - instagram
                                  - yahoo
                                  - whatsapp
                                  - telegram
                                  - viber
                                  - ok
                              email:
                                breach_count: 1
                                is_deliverable: 'yes'
                                linked_services:
                                  - facebook
                                  - google
                                  - twitter
                                  - instagram
                                  - yahoo
                                  - whatsapp
                                  - telegram
                                  - viber
                                  - ok
                                domain_is_custom: 'no'
                                last_breached_at: '2020-12-25'
                                first_breached_at: '2020-12-25'
                                domain_is_disposable: 'no'
                                domain_registered_at: '2010-12-25'
                                domain_is_free_provider: 'no'
                                top_level_domain_is_suspicious: 'no'
                              user_interactions: null
                              fraud_ring_detected: null
                              bot_detected: null
                              synthetic_identity_risk_score: null
                              stolen_identity_risk_score: null
                              steps:
                                kyc_check: success
                                accept_tos: success
                                risk_check: success
                                verify_sms: not_applicable
                                selfie_check: not_applicable
                                watchlist_screening: not_applicable
                                documentary_verification: success
                              ip_spam_list_count: 0
                              documents_verification: success
                            identity_verification_attempted: true
                            idv:
                              document_integrity_results:
                                - attempt: 1
                                  plaid_document_status: success
                                  document_integrity_status: clear
                                  details:
                                    authenticity: match
                                    image_quality: high
                                    aamva_is_verified: null
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: KYC Ownership Verification fetched successfully
                data:
                  - id: 47797fcf-09ff-46d7-b500-39141135c52f
                    external_id: abc-123
                    title: Director
                    first_name: Leslie
                    last_name: Knope
                    email: admin@joinworth.com
                    mobile: '+12345678909'
                    date_of_birth: '1989-07-22'
                    address_apartment: null
                    address_line_1: 123 Main St.
                    address_line_2: null
                    address_city: Pawnee
                    address_state: IN
                    address_postal_code: '46001'
                    address_country: USA
                    created_at: '2024-05-16T11:34:14.545Z'
                    created_by: 19ac7412-6c06-4742-8c52-38787c4e889a
                    updated_at: '2024-05-16T11:34:14.545Z'
                    updated_by: 19ac7412-6c06-4742-8c52-38787c4e889a
                    business_id: df3998ab-7111-4c01-9f4f-d9bd6467c3b6
                    owner_type: CONTROL
                    ownership_percentage: '100.00'
                    kyc_check:
                      name:
                        summary: match
                      status: success
                      address:
                        type: no_data
                        po_box: no_data
                        summary: match
                      id_number:
                        summary: match
                      phone_number:
                        summary: match
                        area_code: match
                      date_of_birth:
                        summary: match
                    risk_check_result:
                      name: match
                      address:
                        type: no_data
                        po_box: no_data
                        summary: match
                      dob: match
                      ssn: match
                      phone:
                        summary: match
                        area_code: match
                        linked_services:
                          - facebook
                          - google
                          - twitter
                          - instagram
                          - yahoo
                          - whatsapp
                          - telegram
                          - viber
                          - ok
                      email:
                        breach_count: 1
                        is_deliverable: 'yes'
                        linked_services:
                          - facebook
                          - google
                          - twitter
                          - instagram
                          - yahoo
                          - whatsapp
                          - telegram
                          - viber
                          - ok
                        domain_is_custom: 'no'
                        last_breached_at: '2020-12-25'
                        first_breached_at: '2020-12-25'
                        domain_is_disposable: 'no'
                        domain_registered_at: '2010-12-25'
                        domain_is_free_provider: 'no'
                        top_level_domain_is_suspicious: 'no'
                      user_interactions: null
                      fraud_ring_detected: null
                      bot_detected: null
                      synthetic_identity_risk_score: null
                      stolen_identity_risk_score: null
                      steps:
                        kyc_check: success
                        accept_tos: success
                        risk_check: success
                        verify_sms: not_applicable
                        selfie_check: not_applicable
                        watchlist_screening: not_applicable
                        documentary_verification: success
                      ip_spam_list_count: 0
                      documents_verification: success
                    identity_verification_attempted: true
                    idv:
                      document_integrity_results:
                        - attempt: 1
                          plaid_document_status: success
                          document_integrity_status: clear
                          details:
                            authenticity: match
                            image_quality: high
                            aamva_is_verified: null
        '404':
          description: Not Found
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Wed, 02 Apr 2025 09:11:39 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '114'
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
                  example: W/"72-VdKYyL5QvhAH8Nt32uwqSDHaEpQ"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - a8f8cdbd-1647-4ea3-b1bb-fb80f3217a07
                  - examples:
                      - status: fail
                        message: No owners found!
                        errorCode: NOT_FOUND
                        data:
                          errorName: VerificationApiError
                contentMediaType: application/json; charset=utf-8
              example:
                status: fail
                message: No owners found!
                errorCode: NOT_FOUND
                data:
                  errorName: VerificationApiError
      deprecated: false
      security:
        - bearer: []
      servers:
        - url: https://api.joinworth.com/integration/api/v1
          variables: {}
components:
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````