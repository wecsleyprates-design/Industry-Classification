<!-- Source: https://docs.worthai.com/api-reference/integration/verification/get-verification-details.md -->
# Get Verification Details

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Verification Details

> Retrieves detailed verification results for a business, including submitted values, matched sources, and confidence levels.



## OpenAPI

````yaml get /verification/businesses/{businessID}/business-entity
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
  /verification/businesses/{businessID}/business-entity:
    parameters: []
    get:
      tags:
        - Verification
      summary: Get Verification Details
      description: >-
        Retrieves detailed verification results for a business, including
        submitted values, matched sources, and confidence levels.
      operationId: GetVerificationDetails1
      parameters:
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - cab0edbc-7f0b-4d11-81e3-7bb9c41c6c57
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
                  example: Tue, 26 Nov 2024 10:12:14 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '8426'
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
                  example: W/"20ea-EZU1PSus3esLn6U6TdmP2MzrOUA"
          content:
            application/json; charset=utf-8:
              schema:
                $ref: '#/components/schemas/Success20'
        '404':
          description: Not Found
          headers:
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
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '271'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"10f-12U+aFZaHRT9yLphYS945hB7oGk"
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Tue, 13 Feb 2024 13:13:59 GMT
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Keep-Alive:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: timeout=5
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ErrorNotFound3'
                  - examples:
                      - status: fail
                        message: >-
                          Business entity verification not found for
                          6f983451-e8c3-4442-8d10-7a15d2af8864
                        errorCode: NOT_FOUND
                        data:
                          errorName: VerificationApiError
                          details:
                            - >-
                              Business entity verification not found for
                              6f983451-e8c3-4442-8d10-7a15d2af8864
                contentMediaType: application/json; charset=utf-8
              example:
                status: fail
                message: >-
                  Business entity verification not found for
                  6f983451-e8c3-4442-8d10-7a15d2af8864
                errorCode: NOT_FOUND
                data:
                  errorName: VerificationApiError
                  details:
                    - >-
                      Business entity verification not found for
                      6f983451-e8c3-4442-8d10-7a15d2af8864
      deprecated: false
      security:
        - bearer: []
      servers:
        - url: https://api.joinworth.com/integration/api/v1
          variables: {}
components:
  schemas:
    Success20:
      title: Success20
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data54'
    ErrorNotFound3:
      title: ErrorNotFound3
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
          $ref: '#/components/schemas/Data55'
      examples:
        - status: fail
          message: >-
            Business entity verification not found for
            6f983451-e8c3-4442-8d10-7a15d2af8864
          errorCode: NOT_FOUND
          data:
            errorName: VerificationApiError
            details:
              - >-
                Business entity verification not found for
                6f983451-e8c3-4442-8d10-7a15d2af8864
    Data54:
      title: Data54
      type: object
      properties:
        businessEntityVerification:
          $ref: '#/components/schemas/BusinessEntityVerification'
        reviewTasks:
          type: array
          items:
            $ref: '#/components/schemas/ReviewTask'
          description: ''
        registrations:
          type: array
          items:
            $ref: '#/components/schemas/Registration'
          description: ''
        addressSources:
          type: array
          items:
            $ref: '#/components/schemas/AddressSource'
          description: ''
        people:
          type: array
          items:
            type: string
          description: ''
        names:
          type: array
          items:
            $ref: '#/components/schemas/Name1'
          description: ''
    Data55:
      title: Data55
      required:
        - errorName
        - details
      type: object
      properties:
        errorName:
          type: string
        details:
          type: array
          items:
            type: string
          description: ''
      examples:
        - errorName: VerificationApiError
          details:
            - >-
              Business entity verification not found for
              6f983451-e8c3-4442-8d10-7a15d2af8864
    BusinessEntityVerification:
      title: BusinessEntityVerification
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for the business entity verification record.
        created_at:
          type: string
          format: date
          description: The date when the verification record was created.
        updated_at:
          type: string
          format: date
          nullable: true
          description: >-
            The date when the verification record was last updated, or null if
            never updated.
        business_integration_task_id:
          type: string
          format: uuid
          description: >-
            The integration task identifier associated with this verification
            process.
        external_id:
          type: string
          description: Client-provided external identifier for tracking the business.
        business_id:
          type: string
          format: uuid
          description: Unique identifier for the business in the system.
        name:
          type: string
          nullable: true
          description: The legal name of the business, if available.
        status:
          type: string
          enum:
            - in_review
            - rejected
            - approved
          description: |-
            Current verification status:
              • in_review: The business is under review.
              • approved: Business details have been verified successfully.
              • rejected: Business details failed verification.
        tin:
          type: string
          nullable: true
          description: Tax Identification Number (TIN) for the business, if provided.
        formation_state:
          type: string
          nullable: true
          description: State where the business was legally formed, if known.
        formation_date:
          type: string
          format: date
          nullable: true
          description: The date when the business was legally formed, if known.
        year:
          type: integer
          nullable: true
          description: The year the business was created, if known.
        number_of_employees:
          type: integer
          nullable: true
          description: Number of employees at the time of verification, if known.
      examples:
        - id: b92456c7-b181-4a36-b841-90fed91b1cf0
          created_at: '2024-11-26T06:46:44.462Z'
          updated_at: null
          business_integration_task_id: dc279948-dcaa-4252-ba17-47c5c644cac7
          external_id: 2cc347d5-a64e-4ad5-bfd3-4332683546dc
          business_id: 80768728-ca4a-4e4f-8f96-5f3be0adaecd
          name: banking test 1
          status: in_review
          tin: '549858454'
          formation_state: IN
          formation_date: '2020-02-24T00:00:00.000Z'
          year: null
          number_of_employees: null
    ReviewTask:
      title: ReviewTask
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for this verification task.
        business_entity_verification_id:
          type: string
          format: uuid
          description: Identifier of the parent business entity verification record.
        created_at:
          type: string
          format: date
          description: Date when this verification task was created.
        updated_at:
          type: string
          format: date
          nullable: true
          description: >-
            Date when this verification task was last updated, or null if not
            updated.
        category:
          type: string
          enum:
            - sos
            - address
            - tin
            - watchlist
            - name
          description: |-
            Type of verification performed:
              • sos: source-of-service check
              • address: address validation
              • tin: Tax ID number verification
              • watchlist: watchlist/sanctions screening
              • name: business name matching
        key:
          type: string
          description: Unique key or code identifying the specific sub-task or data field.
        status:
          type: string
          enum:
            - pending
            - success
            - failure
          description: |-
            Current task status:
              • pending: Task is in progress
              • success: Task completed successfully
              • failure: Task completed with an error
        message:
          type: string
          nullable: true
          description: >-
            Optional human-readable message or error detail returned by the
            task.
        label:
          type: string
        sublabel:
          type: string
        metadata:
          type: array
          items:
            oneOf:
              - allOf:
                  - $ref: '#/components/schemas/Metadata2'
                  - examples:
                      - id: ac01034d-325e-455b-bc3d-c1852c6bb306
                        type: name
                        metadata:
                          name: banking test 1
                          submitted: true
              - type: string
          description: ''
      examples:
        - id: 1b60e304-c435-44ef-bbdb-572aa3a46684
          business_entity_verification_id: b92456c7-b181-4a36-b841-90fed91b1cf0
          created_at: '2024-11-26T06:46:45.506Z'
          updated_at: null
          category: name
          key: name
          status: success
          message: Match identified to the submitted Business Name
          label: Business Name
          sublabel: Verified
          metadata:
            - id: ac01034d-325e-455b-bc3d-c1852c6bb306
              type: name
              metadata:
                name: banking test 1
                submitted: true
    Registration:
      title: Registration
      type: object
      properties:
        id:
          type: string
          format: uuid
        business_entity_verification_id:
          type: string
          format: uuid
        created_at:
          type: string
          format: date
        updated_at:
          type: string
          format: date
          nullable: true
        external_id:
          type: string
        name:
          type: string
        status:
          type: string
          enum:
            - active
            - inactive
          description: |-
            Current registration status:
              • active: the business is currently registered and in good standing.
              • inactive: the business registration is inactive or expired.
        sub_status:
          type: string
          nullable: true
        status_details:
          type: string
          nullable: true
        jurisdiction:
          type: string
        entity_type:
          type: string
        file_number:
          type: string
        full_addresses:
          type: array
          items:
            type: string
        registration_date:
          type: string
          format: date
        registration_state:
          type: string
        source:
          type: string
      examples:
        - id: 65948511-e748-44cd-b6f3-6f2663a4927a
          business_entity_verification_id: b92456c7-b181-4a36-b841-90fed91b1cf0
          created_at: '2024-11-26T06:46:45.538Z'
          updated_at: null
          external_id: 8a473e02-9f08-49e6-bada-d0980ab19437
          name: banking test 1
          status: active
          sub_status: GOOD_STANDING
          status_details: Active-Good Standing
          jurisdiction: DOMESTIC
          entity_type: CORPORATION
          file_number: FN-XXXXXXX
          full_addresses:
            - 123 MAIN ST, PAWNEE, IN 46001
            - 354 CIRCLE COURT,BRONX, NY 10468
          registration_date: '2020-02-24T00:00:00.000Z'
          registration_state: IN
          source: https://secure.in.gov/sos/bus_service/online_corps/name_search.aspx
    AddressSource:
      title: AddressSource
      type: object
      properties:
        id:
          type: string
        business_entity_verification_id:
          type: string
        created_at:
          type: string
        updated_at:
          type:
            - string
            - 'null'
        external_id:
          type: string
        external_registration_id:
          type: string
        full_address:
          type: string
        address_line_1:
          type: string
        address_line_2:
          type:
            - string
            - 'null'
        city:
          type: string
        state:
          type: string
        postal_code:
          type: string
        lat:
          oneOf:
            - type:
                - number
                - 'null'
            - type:
                - string
                - 'null'
            - {}
        long:
          oneOf:
            - type:
                - number
                - 'null'
            - type:
                - string
                - 'null'
            - {}
        submitted:
          type: boolean
        deliverable:
          type: boolean
        cmra:
          type: boolean
        address_property_type:
          type:
            - string
            - 'null'
      examples:
        - id: 527f39dd-4b7b-41c7-872d-754bc064a34e
          business_entity_verification_id: b92456c7-b181-4a36-b841-90fed91b1cf0
          created_at: '2024-11-26T06:46:45.529Z'
          updated_at: null
          external_id: 092528df-063d-4db0-b720-05bad17528d2
          external_registration_id: 8a473e02-9f08-49e6-bada-d0980ab19437
          full_address: 123 Main St, Pawnee, IN 46001
          address_line_1: 123 Main St
          address_line_2: null
          city: Pawnee
          state: IN
          postal_code: '46001'
          lat: 40.52
          long: 30.4
          submitted: true
          deliverable: true
          cmra: false
          address_property_type: null
    Name1:
      title: Name1
      type: object
      properties:
        id:
          type: string
        business_entity_verification_id:
          type: string
        created_at:
          type: string
        updated_at:
          type:
            - string
            - 'null'
        name:
          type: string
        type:
          type: string
        submitted:
          type: boolean
        source:
          type: array
          items:
            $ref: '#/components/schemas/Source'
          description: ''
      examples:
        - id: ce49d078-79f0-44c0-a2cd-569e2a304072
          business_entity_verification_id: b92456c7-b181-4a36-b841-90fed91b1cf0
          created_at: '2024-11-26T06:46:45.550Z'
          updated_at: null
          name: banking test 1
          type: legal
          submitted: true
          source:
            - id: 8a473e02-9f08-49e6-bada-d0980ab19437
              type: registration
              metadata:
                state: IN
                status: active
                file_number: FN-XXXXXXX
                jurisdiction: DOMESTIC
    Metadata2:
      title: Metadata2
      type: object
      properties:
        id:
          type: string
        type:
          type: string
        metadata:
          $ref: '#/components/schemas/Metadata3'
      examples:
        - id: ac01034d-325e-455b-bc3d-c1852c6bb306
          type: name
          metadata:
            name: banking test 1
            submitted: true
    Source:
      title: Source
      type: object
      properties:
        id:
          type: string
        type:
          type: string
        metadata:
          $ref: '#/components/schemas/Metadata1'
      examples:
        - id: e3be2d71-93ec-4ff6-ab09-be3b90ce9cfe
          type: registration
          metadata:
            state: CA
            status: active
            file_number: C3799816
            jurisdiction: DOMESTIC
    Metadata3:
      title: Metadata3
      type: object
      properties:
        name:
          type: string
        submitted:
          type: boolean
        city:
          type: string
        state:
          type: string
        postal_code:
          type: string
        full_address:
          type: string
        address_line1:
          type: string
        address_line2:
          type:
            - string
            - 'null'
      examples:
        - name: banking test 1
          submitted: true
    Metadata1:
      title: Metadata1
      type: object
      properties:
        state:
          type: string
        status:
          type: string
        file_number:
          type: string
        jurisdiction:
          type: string
      examples:
        - state: CA
          status: active
          file_number: C3799816
          jurisdiction: DOMESTIC
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````