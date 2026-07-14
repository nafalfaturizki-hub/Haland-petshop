# Permission Gap Audit

## Summary

The repository has a functional but incomplete permission system. It supports basic role-based access for a subset of roles, but it does not yet meet the requested ERP-level coverage.

## Current Gaps

- Missing roles: Manager, Cashier, Receptionist, Staff, Inventory, Groomer.
- Existing middleware only authorizes Owner, Admin Klinik, Doctor, and Customer; it does not support the broader role set.
- The UI sidebar and route gates rely on the narrower permission utility and will not support the expanded role matrix without refactoring.
- Server actions often validate access individually rather than through a policy object, which can lead to inconsistent enforcement.
- Some modules remain effectively unprotected from a product-scope perspective because the permission map is not yet feature-complete.

## High-Risk Areas

- Route-level access for staff modules.
- Server action authorization for product, inventory, billing, and invoice operations.
- Menu visibility and feature exposure across the staff UI.
- Customer portal access and role redirection.

## Recommended Fixes

1. Replace the current flat role checks with a policy-driven permission engine.
2. Introduce a normalized role enum that covers all target roles.
3. Move route, menu, and action authorization to shared policy helpers.
4. Add tests around authorization boundaries so access control changes are regression-safe.
