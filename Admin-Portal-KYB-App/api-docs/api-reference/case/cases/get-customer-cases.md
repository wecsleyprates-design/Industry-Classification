<!-- Source: https://docs.worthai.com/api-reference/case/cases/get-customer-cases.md -->
# Get Customer Cases

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Customer Cases

> Retrieve all cases associated with a particular customerID.



## OpenAPI

````yaml get /customers/{customerID}/cases
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
  /customers/{customerID}/cases:
    parameters: []
    get:
      tags:
        - Cases
      summary: Get Customer Cases
      description: Retrieve all cases associated with a particular customerID.
      operationId: GetCustomerCases
      parameters:
        - name: customerID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - 22f210e4-4455-4107-b132-97e8478546ea
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
                  example: Wed, 14 Feb 2024 05:46:36 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '6596'
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
                  example: W/"19c4-SDZV54m2x2k+2u7lhjulVgba6bM"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success15'
                  - examples:
                      - status: success
                        message: Success
                        data:
                          records:
                            - id: 1919e44d-a542-450a-bbb2-e3db2e118be5
                              applicant_id: 35430fe0-ec96-46ef-9688-7d0ffe63be8b
                              created_at: '2024-02-14T05:45:10.183Z'
                              business_name: One Stop Furniture And Mattress
                              status_label: ONBOARDING
                              applicant:
                                first_name: John
                                last_name: Doe
                              status:
                                id: 3
                                code: ONBOARDING
                                label: ONBOARDING
                          total_pages: 1
                          total_items: 1
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Success
                data:
                  records:
                    - id: 1919e44d-a542-450a-bbb2-e3db2e118be5
                      applicant_id: 35430fe0-ec96-46ef-9688-7d0ffe63be8b
                      created_at: '2024-02-14T05:45:10.183Z'
                      business_name: One Stop Furniture And Mattress
                      status_label: ONBOARDING
                      applicant:
                        first_name: John
                        last_name: Doe
                      status:
                        id: 3
                        code: ONBOARDING
                        label: ONBOARDING
                  total_pages: 1
                  total_items: 1
      deprecated: false
      servers:
        - url: https://api.joinworth.com/case/api/v1
          variables: {}
components:
  schemas:
    Success15:
      title: Success15
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data56'
      examples:
        - status: success
          message: Business cases fetched successfully
          data:
            records:
              - id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
                applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                created_at: '2024-02-12T11:08:26.868Z'
                business_name: One Stop Furniture And Mattress
                status_label: ONBOARDING
                applicant:
                  first_name: Sandbox
                  last_name: Applicant
                status:
                  id: 3
                  code: ONBOARDING
                  label: ONBOARDING
            total_pages: 1
            total_items: 1
    Data56:
      title: Data56
      type: object
      properties:
        records:
          type: array
          items:
            $ref: '#/components/schemas/Record9'
          description: ''
        total_pages:
          type: integer
          contentEncoding: int32
        total_items:
          type: integer
          contentEncoding: int32
      examples:
        - records:
            - id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
              applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
              created_at: '2024-02-12T11:08:26.868Z'
              business_name: One Stop Furniture And Mattress
              status_label: ONBOARDING
              applicant:
                first_name: Sandbox
                last_name: Applicant
              status:
                id: 3
                code: ONBOARDING
                label: ONBOARDING
          total_pages: 1
          total_items: 1
    Record9:
      title: Record9
      type: object
      properties:
        id:
          type: string
        applicant_id:
          type: string
        created_at:
          type: string
        business_name:
          type: string
        status_label:
          type: string
        applicant:
          $ref: '#/components/schemas/Applicant3'
        status:
          $ref: '#/components/schemas/Status'
      examples:
        - id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
          applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
          created_at: '2024-02-12T11:08:26.868Z'
          business_name: One Stop Furniture And Mattress
          status_label: ONBOARDING
          applicant:
            first_name: Sandbox
            last_name: Applicant
          status:
            id: 3
            code: ONBOARDING
            label: ONBOARDING
    Applicant3:
      title: Applicant3
      type: object
      properties:
        first_name:
          type: string
        last_name:
          type: string
      examples:
        - first_name: Sandbox
          last_name: Applicant
    Status:
      title: Status
      type: object
      properties:
        id:
          type: integer
          contentEncoding: int32
        code:
          type: string
        label:
          type: string
      examples:
        - id: 3
          code: ONBOARDING
          label: ONBOARDING
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).