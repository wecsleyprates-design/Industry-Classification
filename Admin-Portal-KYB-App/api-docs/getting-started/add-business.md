<!-- Source: https://docs.worthai.com/getting-started/add-business.md -->
# Add Business

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Add Business

> The following steps are intended to help you add a business to the customer portal.  This step is needed in order to generate a business ID. This business ID will be used to make other API calls such as KYB and KYC as it serves as the unique identifier of each business that is onboarded.

## 1. *Customer Sign In*

* Using your login credentials you will sign into the customer portal via the [API Customer Sign In](https://docs.worthai.com/api-reference/auth/sign-in/customer-sign-in) endpoint
* Upon signing in you will get an *`id_token`* and *`customer_id`*
  * These two identifiers are needed to make the **Add Business** call

## 2. *Add Business*

*For more information on the Add Business route, please see the [API Reference for Add Business](https://docs.worthai.com/api-reference/add-or-update-business/add-business)*.

* The following three data fields are the ***MINIMUM*** requirements needed to Add a Business:

  1. **Authorization**: <span style={{ color: 'red', fontWeight: 'bold' }}>REQUIRED</span>
     * Insert the `id_token` captured from the Customer Sign In call for authentication

  2. **Customer ID**: <span style={{ color: 'red', fontWeight: 'bold' }}>REQUIRED</span>
     * Insert the `customer_id` captured from the Customer Sign In call for authentication

  3. **Name**: <span style={{ color: 'red', fontWeight: 'bold' }}>REQUIRED</span>
     * This is the name of the company that you are adding

**Important Note**: while there are only three required fields for the Add Business route, the more information that is captured in the Add Business data fields, the more robust and enriched the KYB/KYC response data will be.

**Required/Recommended Fields: KYB**
<br />The following fields are ***recommended*** when making the Add Business call for **KYB**, as it will return a more robust data set:

<table>
  <thead>
    <tr>
      <th>Field Name</th>
      <th>Required / Recommended</th>
      <th>Notes</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td><code>name</code></td>
      <td>✅ Required</td>
      <td>Legal business name</td>
    </tr>

    <tr>
      <td><code>external\_id</code></td>
      <td>🔶 Recommended</td>
      <td>Internal identifier for tracking</td>
    </tr>

    <tr>
      <td><code>tin</code> (Tax ID)</td>
      <td>🔶 Recommended</td>
      <td>Strongest match for business identity</td>
    </tr>

    <tr>
      <td><code>address\_line\_1</code></td>
      <td>🔶 Recommended</td>
      <td>Business street address</td>
    </tr>

    <tr>
      <td><code>address\_city</code></td>
      <td>🔶 Recommended</td>
      <td>City of the business</td>
    </tr>

    <tr>
      <td><code>address\_state</code></td>
      <td>🔶 Recommended</td>
      <td>State where business operates</td>
    </tr>

    <tr>
      <td><code>address\_postal\_code</code></td>
      <td>🔶 Recommended</td>
      <td>ZIP/Postal code</td>
    </tr>

    <tr>
      <td><code>naics\_code</code> <em>or</em> <code>mcc\_code</code></td>
      <td>🔶 Recommended</td>
      <td>Industry classification business code</td>
    </tr>

    <tr>
      <td><code>year\_created</code></td>
      <td>🔶 Recommended</td>
      <td>The year the company was created</td>
    </tr>

    <tr>
      <td><code>annual\_total\_income</code></td>
      <td>🔶 Recommended</td>
      <td>Business revenue</td>
    </tr>

    <tr>
      <td><code>official\_website</code></td>
      <td>🔶 Recommended</td>
      <td>Company website</td>
    </tr>
  </tbody>
</table>

**Required/Recommended Fields: KYC**
<br />The following fields are ***recommended*** when making the Add Business call for **KYC**, as it will return a more robust data set:

<table>
  <thead>
    <tr>
      <th>Field Name</th>
      <th>Required / Recommended</th>
      <th>Notes</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td><code>owner1\_first\_name</code></td>
      <td>🔶 Recommended</td>
      <td>Individual’s legal first name</td>
    </tr>

    <tr>
      <td><code>owner1\_last\_name</code></td>
      <td>🔶 Recommended</td>
      <td>Individual’s legal last name</td>
    </tr>

    <tr>
      <td><code>owner1\_mobile</code></td>
      <td>🔶 Recommended</td>
      <td>Personal contact number</td>
    </tr>

    <tr>
      <td><code>owner1\_email</code></td>
      <td>🔶 Recommended</td>
      <td>Primary email address</td>
    </tr>

    <tr>
      <td><code>owner1\_dob</code></td>
      <td>🔶 Recommended</td>
      <td>Used for identity matching (encrypted)</td>
    </tr>

    <tr>
      <td><code>owner1\_ssn</code></td>
      <td>🔶 Recommended</td>
      <td>Encrypted — critical for verification</td>
    </tr>

    <tr>
      <td><code>owner1\_address\_line\_1</code></td>
      <td>🔶 Recommended</td>
      <td>Home street address</td>
    </tr>

    <tr>
      <td><code>owner1\_address\_line\_2</code></td>
      <td>🔶 Recommended</td>
      <td>Apartment / Suite / Unit</td>
    </tr>

    <tr>
      <td><code>owner1\_address\_city</code></td>
      <td>🔶 Recommended</td>
      <td>Residential city</td>
    </tr>

    <tr>
      <td><code>owner1\_address\_state</code></td>
      <td>🔶 Recommended</td>
      <td>Residential state</td>
    </tr>

    <tr>
      <td><code>owner1\_address\_postal</code></td>
      <td>🔶 Recommended</td>
      <td>ZIP code of the residential address</td>
    </tr>

    <tr>
      <td><code>owner1\_title</code></td>
      <td>✅ Required</td>

      <td>
        Insert one of the following strings: Partner, Limited Partner, Director, Chief Accounting Officer,
        Chief Executive Officer, Chief Operations Officer, President, Vice President, Treasurer,
        Assistant Treasurer, 1% Shareholder, Shareholder, Controller, Managing Member, Owner,
        Sole Proprietor, Executor, Beneficiary, Trustee, Administrator
      </td>
    </tr>

    <tr>
      <td><code>owner1\_owner\_type</code></td>
      <td>✅ Required</td>
      <td>Insert one of the following strings: `CONTROL` or `BENEFICIARY`</td>
    </tr>
  </tbody>
</table>

## Viewing Add Business call in your Customer Portal

If you are using the Customer Portal you can validate the businesses that have been onboarded by following these two steps:

**Step 1:**
Once the business is added, you can log into your customer account and review the business onboarded.

**Step 2:**
Once logged in, on the left nav bar, click on **Businesses** and you will see the business you onboarded.

* Click on “View Details”
* Click on the unique “Ticket Number”
  * You will now see company verification details, **KYB** and other verifications and validations automatically populate into the portal from the Add Business Call


Built with [Mintlify](https://mintlify.com).