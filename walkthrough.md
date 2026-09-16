# Walkthrough: Invoice Flight Formatting, Lloyds Bank Details, and Conditional Service Inclusions

## Overview
Enhanced both the server-side template compiler (`services/booking-service/src/index.ts`) and client-side fallback invoice renderer (`apps/web-client/src/components/documents/InvoiceTemplate.tsx`) to address all requested invoice improvements:
1. **Customer Acceptance Placed Beneath Terms & Conditions**:
   - Relocated the `CUSTOMER ACCEPTANCE & SIGNATURE` box from Page 2 to Page 3 directly beneath the Terms & Conditions.
   - Updated legal wording from "listed below" to "listed above".
   - Structured the 13 Terms & Conditions clauses into a compact 2-column layout to fit cleanly on Page 3 alongside the signature block without spilling over.
2. **Removal of "Umrah" and "Spiritual Journey"**:
   - Replaced "Tailored Package Spiritual Journey" with "Tailored Travel Package" (or "Tailored Flight Itinerary Package").
   - Sanitized package types from "9D/8N Umrah Tailored Package" to "9D/8N Tailored Travel Package" (or specific booked package type).
   - Removed "Hajj & Umrah Specific Disclaimers" heading in terms and conditions (updated to "Specialized & Package Travel Disclaimers").
   - Removed "Umrah" from visa bullet points and labels.
3. **Highlighted Bank Details**:
   - Styled the official bank remittance details card with a vibrant highlight design:
     - Gradient sky-blue card background with a 2px solid `#0284c7` border and soft shadow.
     - Bold header and direct settlement badge.
     - **Sort Code** (`30-54-66`) and **Account Number** (`19401663`) highlighted in prominent yellow high-contrast badges (`#fef08a` background, `#854d0e` text, bold monospace).
     - Prominent Lloyds Bank name, Tooba Travels Ltd account name, billing address, and payment reference.
4. **Full Airport Names**:
   - Accurate mapping and rendering of full airport names (e.g. `Toronto Pearson International (YYZ)`, `King Abdulaziz Int'l, Jeddah (JED)`, `Prince Mohammad Bin Abdulaziz, Madinah (MED)`).
5. **Strict Chronological Flight Sorting**:
   - Flight legs are ordered strictly by departure date and time across the schedule table, package route overview, and travel date computations.
6. **Vendor Name Elimination**:
   - Supplier/vendor names (e.g., "Polani Travels", "Basma Transport") are never displayed as the operating carrier on customer-facing invoices; actual airline carriers are resolved from flight numbers and codes (e.g., `DL` -> `Delta Air Lines`, `RJ` -> `Royal Jordanian`, `SV` -> `Saudia`).
7. **Conditional Service Omission**:
   - Services not present in a booking (hotels, visas, transfers) are completely omitted from the invoice. Fictitious or "Not specified" cards and inclusion bullet points are removed.

---

## Verification & Validation

### Automated Checks
- Ran `npx tsc --noEmit` in `services/booking-service`: Passed with 0 errors.
- Ran `npx tsc --noEmit` in `apps/web-client`: Passed with 0 errors.

### Git Verification
- Committed: `feat: move customer acceptance beneath terms, remove umrah and spiritual journey labels, and highlight bank details` (`21c366b`).
- Pushed successfully to `origin/main`.
