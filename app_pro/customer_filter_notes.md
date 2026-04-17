# Customer Filter Implementation Notes

## From Original App Screenshots:

### Sidebar Layout (top to bottom):
1. **Date Range** section
   - Toggle: "Filter by date" (with help icon)
   - From date picker (2026/04/17)
   - To date picker (2026/04/17)
   - Caption: "📅 2026-04-17 → 2026-04-17"

2. **🏢 Customer Filter** section
   - Description: "Filters to businesses of a specific customer within the date range above."
   - Dropdown: "All Customers" (default)
   - Caption: "Showing all 17 customers in this period"

3. **Sources** section
   - `rds_warehouse_public.facts`
   - `rds_manual_score_public.*`
   - `rds_integration_data.*`
   - `clients.customer_table`
   - `warehouse.worth_score_input_audit`

## Data Model for Customer Filter:
- From `smb_standard.sql`: JOIN `rds_cases_public.rel_business_customer_monitoring bcm` to `rds_auth_public.data_customers dc` ON `bcm.customer_id = dc.id`
- `dc.name` = customer display name
- The filter scopes all portfolio queries to businesses belonging to the selected customer
