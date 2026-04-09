<!-- Source: https://docs.worthai.com/api-reference/case/cases/get-customer-case-by-id.md -->
# Get Customer Case By ID

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Customer Case By ID

> Retrieve details about a particular case associated with the given customerID and caseID.



## OpenAPI

````yaml get /customers/{customerID}/cases/{caseID}
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
  /customers/{customerID}/cases/{caseID}:
    parameters: []
    get:
      tags:
        - Cases
      summary: Get Customer Case By ID
      description: >-
        Retrieve details about a particular case associated with the given
        customerID and caseID.
      operationId: GetCustomerCaseByID
      parameters:
        - name: customerID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
        - name: caseID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
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
                  example: Wed, 14 Feb 2024 06:15:58 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '2477'
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
                  example: W/"9ad-DjECcGgje/sbIRaqDxIB8HgzBoM"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success22'
                  - examples:
                      - status: success
                        message: Success
                        data:
                          id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
                          applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                          customer_id: 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
                          status:
                            code: 3
                            id: ONBOARDING
                            label: ONBOARDING
                          created_at: '2024-02-12T11:08:26.868002'
                          created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                          updated_at: '2024-02-12T11:08:26.868002'
                          updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                          business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                          business:
                            id: f17295d4-5237-4079-8b18-8786eddf49f3
                            name: One Stop Furniture And Mattress
                            tin: '844148259'
                            address_apartment: null
                            address_line_1: 3614, Cassopolis Street,
                            address_line_2: null
                            address_city: Elkhart
                            address_state: Indiana
                            address_postal_code: '46514'
                            address_country: United States
                            created_at: '2024-02-12T11:08:02.873642'
                            created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                            updated_at: '2024-02-13T12:45:56.024203'
                            updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                            mobile: null
                            official_website: null
                            public_website: null
                            social_account: null
                            status: VERIFIED
                          applicant:
                            id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                            first_name: Sandbox
                            last_name: Applicant
                            email: sandbox-test+applicant@joinworth.com
                            mobile: null
                            is_email_verified: true
                            is_first_login: false
                            created_at: '2024-02-12T11:08:02.832Z'
                            created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                            updated_at: '2024-02-12T11:08:26.848Z'
                            updated_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                            status: ACTIVE
                            subrole:
                              id: 9950995a-ad5c-43ba-a0ac-6f367cac72ef
                              code: applicant
                              label: Applicant
                              role_id: 3
                          owners:
                            - id: aae5fe81-6460-43fd-b7f0-bf7dc63d5e95
                              external_id: abc123
                              title:
                                id: 1
                                title: Partner
                              first_name: Sandbox
                              last_name: Applicant
                              ssn: '844148259'
                              email: sandbox-test+applicant+1@joinworth.com
                              mobile: '6073213231'
                              date_of_birth: '2024-02-08'
                              address_apartment: null
                              address_line_1: 3614, Cassopolis Street,
                              address_line_2: null
                              address_city: Elkhart
                              address_state: Indiana
                              address_postal_code: '46514'
                              address_country: Unites States
                              created_at: '2024-02-13T06:56:16.761321'
                              created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                              updated_at: '2024-02-13T06:56:16.761321'
                              updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                              ownership_percentage: 25
                              owner_type: CONTROL
                          status_history:
                            - id: 3
                              status: ONBOARDING
                              created_at: '2024-02-12T11:08:26.868Z'
                              created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Success
                data:
                  id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
                  applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                  customer_id: 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
                  status:
                    code: 3
                    id: ONBOARDING
                    label: ONBOARDING
                  created_at: '2024-02-12T11:08:26.868002'
                  created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                  updated_at: '2024-02-12T11:08:26.868002'
                  updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                  business_id: f17295d4-5237-4079-8b18-8786eddf49f3
                  business:
                    id: f17295d4-5237-4079-8b18-8786eddf49f3
                    name: One Stop Furniture And Mattress
                    tin: '844148259'
                    address_apartment: null
                    address_line_1: 3614, Cassopolis Street,
                    address_line_2: null
                    address_city: Elkhart
                    address_state: Indiana
                    address_postal_code: '46514'
                    address_country: United States
                    created_at: '2024-02-12T11:08:02.873642'
                    created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                    updated_at: '2024-02-13T12:45:56.024203'
                    updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                    mobile: null
                    official_website: null
                    public_website: null
                    social_account: null
                    status: VERIFIED
                  applicant:
                    id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                    first_name: Sandbox
                    last_name: Applicant
                    email: sandbox-test+applicant@joinworth.com
                    mobile: null
                    is_email_verified: true
                    is_first_login: false
                    created_at: '2024-02-12T11:08:02.832Z'
                    created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                    updated_at: '2024-02-12T11:08:26.848Z'
                    updated_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
                    status: ACTIVE
                    subrole:
                      id: 9950995a-ad5c-43ba-a0ac-6f367cac72ef
                      code: applicant
                      label: Applicant
                      role_id: 3
                  owners:
                    - id: aae5fe81-6460-43fd-b7f0-bf7dc63d5e95
                      external_id: abc123
                      title:
                        id: 1
                        title: Partner
                      first_name: Sandbox
                      last_name: Applicant
                      ssn: '844148259'
                      email: sandbox-test+applicant+1@joinworth.com
                      mobile: '6073213231'
                      date_of_birth: '2024-02-08'
                      address_apartment: null
                      address_line_1: 3614, Cassopolis Street,
                      address_line_2: null
                      address_city: Elkhart
                      address_state: Indiana
                      address_postal_code: '46514'
                      address_country: Unites States
                      created_at: '2024-02-13T06:56:16.761321'
                      created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                      updated_at: '2024-02-13T06:56:16.761321'
                      updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                      ownership_percentage: 25
                      owner_type: CONTROL
                  status_history:
                    - id: 3
                      status: ONBOARDING
                      created_at: '2024-02-12T11:08:26.868Z'
                      created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
      deprecated: false
      servers:
        - url: https://api.joinworth.com/case/api/v1
          variables: {}
components:
  schemas:
    Success22:
      title: Success22
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data85'
      examples:
        - status: success
          message: Success
          data:
            id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
            applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
            customer_id: 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
            status:
              code: 3
              id: ONBOARDING
              label: ONBOARDING
            created_at: '2024-02-12T11:08:26.868002'
            created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
            updated_at: '2024-02-12T11:08:26.868002'
            updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
            business_id: f17295d4-5237-4079-8b18-8786eddf49f3
            business:
              id: f17295d4-5237-4079-8b18-8786eddf49f3
              name: One Stop Furniture And Mattress
              tin: '844148259'
              address_apartment: null
              address_line_1: 3614, Cassopolis Street,
              address_line_2: null
              address_city: Elkhart
              address_state: Indiana
              address_postal_code: '46514'
              address_country: United States
              created_at: '2024-02-12T11:08:02.873642'
              created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
              updated_at: '2024-02-13T12:45:56.024203'
              updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
              mobile: null
              official_website: null
              public_website: null
              social_account: null
              status: VERIFIED
            applicant:
              id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
              first_name: Sandbox
              last_name: Applicant
              email: sandbox-test+applicant@joinworth.com
              mobile: null
              is_email_verified: true
              is_first_login: false
              created_at: '2024-02-12T11:08:02.832Z'
              created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
              updated_at: '2024-02-12T11:08:26.848Z'
              updated_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
              status: ACTIVE
              subrole:
                id: 9950995a-ad5c-43ba-a0ac-6f367cac72ef
                code: applicant
                label: Applicant
                role_id: 3
            owners:
              - id: aae5fe81-6460-43fd-b7f0-bf7dc63d5e95
                external_id: abc123
                title:
                  id: 1
                  title: Partner
                first_name: Sandbox
                last_name: Applicant
                ssn: '844148259'
                email: sandbox-test+applicant+1@joinworth.com
                mobile: '6073213231'
                date_of_birth: '2024-02-08'
                address_apartment: null
                address_line_1: 3614, Cassopolis Street,
                address_line_2: null
                address_city: Elkhart
                address_state: Indiana
                address_postal_code: '46514'
                address_country: Unites States
                created_at: '2024-02-13T06:56:16.761321'
                created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                updated_at: '2024-02-13T06:56:16.761321'
                updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
                ownership_percentage: 25
                owner_type: CONTROL
            status_history:
              - id: 3
                status: ONBOARDING
                created_at: '2024-02-12T11:08:26.868Z'
                created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
    Data85:
      title: Data85
      type: object
      properties:
        id:
          type: string
        applicant_id:
          type: string
        customer_id:
          type: string
        status:
          $ref: '#/components/schemas/Status5'
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        updated_by:
          type: string
        business_id:
          type: string
        business:
          $ref: '#/components/schemas/Business2'
        applicant:
          $ref: '#/components/schemas/Applicant8'
        owners:
          type: array
          items:
            $ref: '#/components/schemas/Owner'
          description: ''
        status_history:
          type: array
          items:
            $ref: '#/components/schemas/StatusHistory'
          description: ''
      examples:
        - id: eb7aa8d8-18e6-49b1-b7e7-6311cae51acd
          applicant_id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
          customer_id: 2e6438cb-ec3f-4e94-b5c9-8c058d2efaf1
          status:
            code: 3
            id: ONBOARDING
            label: ONBOARDING
          created_at: '2024-02-12T11:08:26.868002'
          created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
          updated_at: '2024-02-12T11:08:26.868002'
          updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
          business_id: f17295d4-5237-4079-8b18-8786eddf49f3
          business:
            id: f17295d4-5237-4079-8b18-8786eddf49f3
            name: One Stop Furniture And Mattress
            tin: '844148259'
            address_apartment: null
            address_line_1: 3614, Cassopolis Street,
            address_line_2: null
            address_city: Elkhart
            address_state: Indiana
            address_postal_code: '46514'
            address_country: United States
            created_at: '2024-02-12T11:08:02.873642'
            created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
            updated_at: '2024-02-13T12:45:56.024203'
            updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
            mobile: null
            official_website: null
            public_website: null
            social_account: null
            status: VERIFIED
          applicant:
            id: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
            first_name: Sandbox
            last_name: Applicant
            email: sandbox-test+applicant@joinworth.com
            mobile: null
            is_email_verified: true
            is_first_login: false
            created_at: '2024-02-12T11:08:02.832Z'
            created_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
            updated_at: '2024-02-12T11:08:26.848Z'
            updated_by: b03d6f6a-063b-4e71-8195-9f6f590a6257
            status: ACTIVE
            subrole:
              id: 9950995a-ad5c-43ba-a0ac-6f367cac72ef
              code: applicant
              label: Applicant
              role_id: 3
          owners:
            - id: aae5fe81-6460-43fd-b7f0-bf7dc63d5e95
              external_id: abc123
              title:
                id: 1
                title: Partner
              first_name: Sandbox
              last_name: Applicant
              ssn: '844148259'
              email: sandbox-test+applicant+1@joinworth.com
              mobile: '6073213231'
              date_of_birth: '2024-02-08'
              address_apartment: null
              address_line_1: 3614, Cassopolis Street,
              address_line_2: null
              address_city: Elkhart
              address_state: Indiana
              address_postal_code: '46514'
              address_country: Unites States
              created_at: '2024-02-13T06:56:16.761321'
              created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
              updated_at: '2024-02-13T06:56:16.761321'
              updated_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
              ownership_percentage: 25
              owner_type: CONTROL
          status_history:
            - id: 3
              status: ONBOARDING
              created_at: '2024-02-12T11:08:26.868Z'
              created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
    Status5:
      title: Status5
      type: object
      properties:
        code:
          type: integer
          contentEncoding: int32
        id:
          type: string
        label:
          type: string
      examples:
        - code: 3
          id: ONBOARDING
          label: ONBOARDING
    Business2:
      title: Business2
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        tin:
          type: string
        address_apartment:
          type:
            - string
            - 'null'
        address_line_1:
          type: string
        address_line_2:
          type:
            - string
            - 'null'
        address_city:
          type: string
        address_state:
          type: string
        address_postal_code:
          type: string
        address_country:
          type: string
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        updated_by:
          type: string
        mobile:
          type:
            - string
            - 'null'
        official_website:
          type:
            - string
            - 'null'
        public_website:
          type:
            - string
            - 'null'
        social_account:
          type:
            - string
            - 'null'
        status:
          type: string
      examples:
        - id: 0edc06d0-e336-4b83-beab-708171e9e8d1
          name: sdfdsaf
          tin: '123123123'
          address_apartment: null
          address_line_1: 123, William Street, Manhattan
          address_line_2: null
          address_city: New York
          address_state: New York
          address_postal_code: '10038'
          address_country: United States
          created_at: '2024-02-06T13:07:39.69822'
          created_by: 05e29ae7-11a7-4c5b-ace4-7d418bc0cd7b
          updated_at: '2024-02-06T13:07:50.528149'
          updated_by: 05e29ae7-11a7-4c5b-ace4-7d418bc0cd7b
          mobile: null
          official_website: null
          public_website: null
          social_account: null
          status: ACTIVE
    Applicant8:
      title: Applicant8
      type: object
      properties:
        id:
          type: string
        first_name:
          type: string
        last_name:
          type: string
        email:
          type: string
        mobile:
          type:
            - string
            - 'null'
        is_email_verified:
          type: boolean
        is_first_login:
          type: boolean
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        updated_by:
          type: string
        status:
          type: string
        subrole:
          $ref: '#/components/schemas/Subrole5'
      examples:
        - id: eea56c10-0c35-48b0-9132-ea9f524ed3cc
          first_name: John
          last_name: Doe
          email: yavise8435@fkcod.com
          mobile: null
          is_email_verified: true
          is_first_login: false
          created_at: '2024-02-14T06:06:54.015Z'
          created_by: eea56c10-0c35-48b0-9132-ea9f524ed3cc
          updated_at: '2024-02-14T06:07:07.920Z'
          updated_by: eea56c10-0c35-48b0-9132-ea9f524ed3cc
          status: ACTIVE
          subrole:
            id: 842a914c-7dd8-428c-8875-7ea5d1598d32
            code: standalone_applicant
            label: Standalone Applicant
            role_id: 3
    Owner:
      title: Owner
      type: object
      properties:
        id:
          type: string
        external_id:
          type:
            - string
            - 'null'
        title:
          $ref: '#/components/schemas/Title'
        first_name:
          type: string
        last_name:
          type: string
        ssn:
          type: string
        email:
          type: string
        mobile:
          type: string
        date_of_birth:
          type: string
        address_apartment:
          type:
            - string
            - 'null'
        address_line_1:
          type: string
        address_line_2:
          type:
            - string
            - 'null'
        address_city:
          type: string
        address_state:
          type: string
        address_postal_code:
          type: string
        address_country:
          type: string
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        updated_by:
          type: string
        ownership_percentage:
          type: integer
          contentEncoding: int32
        owner_type:
          type: string
      examples:
        - id: 29403835-9f48-47ed-9d49-fcc182fd299c
          external_id: abc123
          title:
            id: 1
            title: Partner
          first_name: JDVSXOAO
          last_name: CGRFRUP
          ssn: '590178253'
          email: johndoe@example.com
          mobile: '+16078665556'
          date_of_birth: '2023-12-01'
          address_apartment: null
          address_line_1: 990 LRDMYH INLT
          address_line_2: null
          address_city: Killen
          address_state: Alabama
          address_postal_code: '35645'
          address_country: USA
          created_at: '2024-03-28T12:21:41.911864'
          created_by: e8f15d25-ed33-4783-b6fe-0e7d4290c2eb
          updated_at: '2024-05-16T11:25:50.356739'
          updated_by: e9d43901-3fc6-4ee9-97be-74cd23b39aa0
          ownership_percentage: 100
          owner_type: CONTROL
    StatusHistory:
      title: StatusHistory
      type: object
      properties:
        id:
          type: integer
          contentEncoding: int32
        status:
          type: string
        created_at:
          type: string
        created_by:
          type: string
      examples:
        - id: 3
          status: ONBOARDING
          created_at: '2024-02-14T06:07:07.824Z'
          created_by: eea56c10-0c35-48b0-9132-ea9f524ed3cc
    Subrole5:
      title: Subrole5
      type: object
      properties:
        id:
          type: string
        code:
          type: string
        label:
          type: string
        role_id:
          type: integer
          contentEncoding: int32
      examples:
        - id: 842a914c-7dd8-428c-8875-7ea5d1598d32
          code: standalone_applicant
          label: Standalone Applicant
          role_id: 3
    Title:
      title: Title
      type: object
      properties:
        id:
          type: integer
          contentEncoding: int32
        title:
          type: string
      examples:
        - id: 1
          title: Partner
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).