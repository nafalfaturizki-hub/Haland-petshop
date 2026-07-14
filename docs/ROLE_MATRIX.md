# Role Matrix

## Roles in Scope

- Owner
- Manager
- Doctor
- Cashier
- Receptionist
- Staff
- Inventory
- Groomer
- Customer

## Current Implementation Status

The codebase currently has a narrower runtime role model:

- OWNER
- ADMIN_KLINIK
- DOKTER
- CUSTOMER

This is a major gap against the requested production role model.

## Permission Matrix (Target State)

| Role | Dashboard | Customers | Pets | Appointments | Medical Records | Procedures | Pet Hotel | Petshop | POS | Billing | Reports | Users | Settings | Customer Portal | Profile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Owner | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Read | Full |
| Manager | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Limited | Limited | Read | Full |
| Doctor | Read | Read | Read | Read/Update | Full | Read | Read | No | No | No | Read | No | No | No | Read |
| Cashier | Read | Read | Read | Read | Read | No | Read | Read | Full | Full | Read | No | No | No | Read |
| Receptionist | Read | Full | Full | Full | Read | No | Read | No | Read | Read | Read | No | No | No | Read |
| Staff | Read | Read | Read | Read | Read | Read | Read | Read | Read | Read | Read | No | No | No | Read |
| Inventory | Read | Read | Read | Read | Read | Read | Read | Full | Read | Read | Read | No | No | No | Read |
| Groomer | Read | Read | Read | Read | Read | Read | Read | No | No | No | Read | No | No | No | Read |
| Customer | No | No | No | No | No | No | No | No | No | No | No | No | No | Full | Full |

## Gap Summary

- The current implementation does not model the requested roles explicitly.
- Permission checks are hardcoded around a smaller role set.
- Staff-facing routes are gated by a narrower allow-list that will not be sufficient once the broader role model is introduced.
