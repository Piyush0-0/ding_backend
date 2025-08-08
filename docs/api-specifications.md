# POS Integration API Specifications

## Menu Fetch API

### Endpoint
```
GET /api/v1/menu
```

### Request Parameters
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| restID    | string | Yes      | Unique identifier of the restaurant |

### Response Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "success": {
      "type": "string",
      "enum": ["1", "0"],
      "description": "Indicates if the request was successful"
    },
    "restaurants": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "restaurantid": {
            "type": "string",
            "description": "Unique identifier of the restaurant"
          },
          "active": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if the restaurant is active"
          },
          "details": {
            "type": "object",
            "properties": {
              "restaurantname": {
                "type": "string",
                "description": "Name of the restaurant"
              },
              "address": {
                "type": "string",
                "description": "Full address of the restaurant"
              },
              "contact": {
                "type": "string",
                "description": "Contact number"
              },
              "latitude": {
                "type": "string",
                "description": "Geographic latitude"
              },
              "longitude": {
                "type": "string",
                "description": "Geographic longitude"
              },
              "city": {
                "type": "string",
                "description": "City name"
              },
              "state": {
                "type": "string",
                "description": "State name"
              },
              "minimumorderamount": {
                "type": "string",
                "description": "Minimum order amount"
              },
              "minimumdeliverytime": {
                "type": "string",
                "description": "Minimum delivery time"
              },
              "minimum_prep_time": {
                "type": "string",
                "description": "Minimum preparation time in minutes"
              },
              "deliverycharge": {
                "type": "string",
                "description": "Delivery charge amount"
              },
              "currency_html": {
                "type": "string",
                "description": "Currency symbol"
              }
            },
            "required": ["restaurantname", "address", "contact", "latitude", "longitude", "city", "state"]
          }
        },
        "required": ["restaurantid", "active", "details"]
      }
    },
    "ordertypes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ordertypeid": {
            "type": "integer",
            "description": "Unique identifier for order type"
          },
          "ordertype": {
            "type": "string",
            "description": "Name of the order type"
          }
        },
        "required": ["ordertypeid", "ordertype"]
      }
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "categoryid": {
            "type": "string",
            "description": "Unique identifier for category"
          },
          "active": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if the category is active"
          },
          "categoryname": {
            "type": "string",
            "description": "Name of the category"
          },
          "categoryrank": {
            "type": "string",
            "description": "Display order of the category"
          },
          "parent_category_id": {
            "type": "string",
            "description": "ID of parent category (0 for root categories)"
          }
        },
        "required": ["categoryid", "active", "categoryname", "categoryrank"]
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "itemid": {
            "type": "string",
            "description": "Unique identifier for item"
          },
          "itemname": {
            "type": "string",
            "description": "Name of the item"
          },
          "item_categoryid": {
            "type": "string",
            "description": "Category ID this item belongs to"
          },
          "price": {
            "type": "string",
            "description": "Base price of the item"
          },
          "active": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if the item is active"
          },
          "itemallowvariation": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if item allows variations"
          },
          "itemallowaddon": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if item allows addons"
          },
          "item_attributeid": {
            "type": "string",
            "description": "Attribute ID (e.g., veg, non-veg)"
          },
          "variation": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Unique identifier for variation"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the variation"
                },
                "price": {
                  "type": "string",
                  "description": "Price of the variation"
                },
                "active": {
                  "type": "string",
                  "enum": ["1", "0"],
                  "description": "Indicates if variation is active"
                }
              },
              "required": ["id", "name", "price", "active"]
            }
          },
          "addon": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "addon_group_id": {
                  "type": "string",
                  "description": "ID of the addon group"
                },
                "addon_item_selection_min": {
                  "type": "string",
                  "description": "Minimum number of addons that can be selected"
                },
                "addon_item_selection_max": {
                  "type": "string",
                  "description": "Maximum number of addons that can be selected"
                }
              },
              "required": ["addon_group_id", "addon_item_selection_min", "addon_item_selection_max"]
            }
          }
        },
        "required": ["itemid", "itemname", "item_categoryid", "price", "active"]
      }
    },
    "addongroups": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "addongroupid": {
            "type": "string",
            "description": "Unique identifier for addon group"
          },
          "addongroup_name": {
            "type": "string",
            "description": "Name of the addon group"
          },
          "active": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if addon group is active"
          },
          "addongroupitems": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "addonitemid": {
                  "type": "string",
                  "description": "Unique identifier for addon item"
                },
                "addonitem_name": {
                  "type": "string",
                  "description": "Name of the addon item"
                },
                "addonitem_price": {
                  "type": "string",
                  "description": "Price of the addon item"
                },
                "active": {
                  "type": "string",
                  "enum": ["1", "0"],
                  "description": "Indicates if addon item is active"
                }
              },
              "required": ["addonitemid", "addonitem_name", "addonitem_price", "active"]
            }
          }
        },
        "required": ["addongroupid", "addongroup_name", "active", "addongroupitems"]
      }
    },
    "taxes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "taxid": {
            "type": "string",
            "description": "Unique identifier for tax"
          },
          "taxname": {
            "type": "string",
            "description": "Name of the tax"
          },
          "tax": {
            "type": "string",
            "description": "Tax percentage"
          },
          "active": {
            "type": "string",
            "enum": ["1", "0"],
            "description": "Indicates if tax is active"
          }
        },
        "required": ["taxid", "taxname", "tax", "active"]
      }
    }
  },
  "required": ["success", "restaurants", "ordertypes", "categories", "items", "addongroups", "taxes"]
}
```

### Response Codes
| Code | Description |
|------|-------------|
| 200  | Success     |
| 400  | Bad Request - Invalid parameters |
| 401  | Unauthorized - Invalid credentials |
| 404  | Not Found - Restaurant not found |
| 500  | Internal Server Error |

### Notes
1. All monetary values should be provided as strings to avoid floating-point precision issues
2. Active status is represented as "1" for active and "0" for inactive
3. Timestamps should be in ISO 8601 format
4. All IDs should be unique within their respective contexts
5. Prices should be in the smallest currency unit (e.g., cents for USD)
6. Coordinates should be provided in decimal degrees format
7. All text fields should be properly escaped to prevent XSS attacks
8. The API should support pagination for large menus
9. The API should support filtering by active status
10. The API should support sorting by rank/order fields 

## Order Creation API

### Endpoint
```
POST /api/v1/orders
```

### Authentication
This endpoint requires authentication using API credentials.

### Request Parameters

#### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token for authentication |
| Content-Type | Yes | application/json |

#### Body Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "restaurant": {
      "type": "object",
      "properties": {
        "restID": {
          "type": "string",
          "description": "Unique identifier of the restaurant"
        },
        "name": {
          "type": "string",
          "description": "Name of the restaurant"
        },
        "address": {
          "type": "string",
          "description": "Restaurant's address"
        },
        "contact": {
          "type": "string",
          "description": "Restaurant's contact number"
        }
      },
      "required": ["restID"]
    },
    "customer": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "format": "email",
          "description": "Customer's email address"
        },
        "name": {
          "type": "string",
          "description": "Customer's full name"
        },
        "address": {
          "type": "string",
          "description": "Delivery address"
        },
        "phone": {
          "type": "string",
          "description": "Contact phone number"
        },
        "latitude": {
          "type": "string",
          "description": "Delivery location latitude"
        },
        "longitude": {
          "type": "string",
          "description": "Delivery location longitude"
        }
      },
      "required": ["name", "phone"]
    },
    "order": {
      "type": "object",
      "properties": {
        "orderID": {
          "type": "string",
          "description": "Unique identifier for the order"
        },
        "order_type": {
          "type": "string",
          "enum": ["delivery", "pickup", "dine_in"],
          "description": "Type of order"
        },
        "payment_type": {
          "type": "string",
          "enum": ["cash", "card", "upi", "wallet"],
          "description": "Payment method"
        },
        "preorder_date": {
          "type": "string",
          "format": "date",
          "description": "Scheduled delivery/pickup date"
        },
        "preorder_time": {
          "type": "string",
          "format": "time",
          "description": "Scheduled delivery/pickup time"
        },
        "urgent_order": {
          "type": "boolean",
          "description": "Whether this is an urgent order"
        },
        "urgent_time": {
          "type": "number",
          "description": "Time in minutes for urgent preparation"
        },
        "table_no": {
          "type": "string",
          "description": "Table number for dine-in orders"
        },
        "no_of_persons": {
          "type": "string",
          "description": "Number of persons for dine-in"
        },
        "description": {
          "type": "string",
          "description": "Additional order instructions"
        },
        "created_on": {
          "type": "string",
          "format": "date-time",
          "description": "Order creation timestamp"
        },
        "callback_url": {
          "type": "string",
          "format": "uri",
          "description": "Webhook URL for order status updates"
        },
        "otp": {
          "type": "string",
          "description": "OTP for order verification"
        }
      },
      "required": ["orderID", "order_type", "payment_type", "created_on", "callback_url"]
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Item identifier"
          },
          "name": {
            "type": "string",
            "description": "Item name"
          },
          "quantity": {
            "type": "string",
            "description": "Quantity ordered"
          },
          "price": {
            "type": "string",
            "description": "Base price per unit"
          },
          "final_price": {
            "type": "string",
            "description": "Final price after discounts"
          },
          "item_tax": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Tax identifier"
              },
              "name": {
                "type": "string",
                "description": "Tax name"
              },
              "amount": {
                "type": "string",
                "description": "Tax amount"
              }
            },
            "required": ["id", "name", "amount"]
          },
          "variation": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Variation identifier"
              },
              "name": {
                "type": "string",
                "description": "Variation name"
              }
            }
          },
          "addons": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Addon identifier"
                },
                "name": {
                  "type": "string",
                  "description": "Addon name"
                },
                "group_id": {
                  "type": "string",
                  "description": "Addon group identifier"
                },
                "group_name": {
                  "type": "string",
                  "description": "Addon group name"
                },
                "price": {
                  "type": "string",
                  "description": "Addon price"
                },
                "quantity": {
                  "type": "string",
                  "description": "Addon quantity"
                }
              },
              "required": ["id", "name", "group_id", "price"]
            }
          }
        },
        "required": ["id", "name", "quantity", "price", "final_price", "item_tax"]
      }
    },
    "charges": {
      "type": "object",
      "properties": {
        "delivery_charges": {
          "type": "string",
          "description": "Delivery fee"
        },
        "packing_charges": {
          "type": "string",
          "description": "Packing fee"
        },
        "service_charge": {
          "type": "string",
          "description": "Service charge"
        },
        "discount": {
          "type": "string",
          "description": "Discount amount"
        },
        "discount_type": {
          "type": "string",
          "description": "Type of discount"
        },
        "tax_total": {
          "type": "string",
          "description": "Total tax amount"
        },
        "total": {
          "type": "string",
          "description": "Final order total"
        }
      },
      "required": ["total"]
    },
    "tax_details": {
      "type": "object",
      "properties": {
        "sc_tax_amount": {
          "type": "string",
          "description": "Service charge tax amount"
        },
        "dc_tax_amount": {
          "type": "string",
          "description": "Delivery charge tax amount"
        },
        "pc_tax_amount": {
          "type": "string",
          "description": "Packing charge tax amount"
        }
      }
    }
  },
  "required": ["restaurant", "customer", "order", "items", "charges"]
}
```

### Response Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "success": {
      "type": "string",
      "enum": ["1", "0"],
      "description": "Indicates if the request was successful"
    },
    "message": {
      "type": "string",
      "description": "Response message"
    },
    "restID": {
      "type": "string",
      "description": "Restaurant identifier"
    },
    "clientOrderID": {
      "type": "string",
      "description": "Client's order identifier"
    },
    "orderID": {
      "type": "string",
      "description": "System's order identifier"
    }
  },
  "required": ["success", "message", "orderID"]
}
```

### Response Codes
| Code | Description |
|------|-------------|
| 200  | Success - Order created |
| 400  | Bad Request - Invalid parameters |
| 401  | Unauthorized - Invalid credentials |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Restaurant not found |
| 409  | Conflict - Order already exists |
| 422  | Unprocessable Entity - Validation error |
| 500  | Internal Server Error |

### Notes
1. All monetary values should be provided as strings to avoid floating-point precision issues
2. Dates should be in ISO 8601 format (YYYY-MM-DD)
3. Times should be in 24-hour format (HH:mm:ss)
4. Timestamps should be in ISO 8601 format with timezone
5. Coordinates should be provided in decimal degrees format
6. All text fields should be properly escaped to prevent XSS attacks
7. The API supports both immediate and scheduled orders
8. For scheduled orders, preorder_date and preorder_time are required
9. For dine-in orders, table_no and no_of_persons are required
10. The callback_url will be used to notify about order status changes 

## Order Status Update API

### Endpoint
```
PUT /api/v1/orders/{orderID}/status
```

### Authentication
This endpoint requires authentication using API credentials.

### Request Parameters

#### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token for authentication |
| Content-Type | Yes | application/json |

#### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| orderID | string | Unique identifier of the order |

#### Body Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "restaurant": {
      "type": "object",
      "properties": {
        "restID": {
          "type": "string",
          "description": "Unique identifier of the restaurant"
        }
      },
      "required": ["restID"]
    },
    "order": {
      "type": "object",
      "properties": {
        "clientorderID": {
          "type": "string",
          "description": "Client's order identifier"
        },
        "status": {
          "type": "string",
          "enum": [
            "pending",
            "confirmed",
            "preparing",
            "ready_for_pickup",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "rejected"
          ],
          "description": "New status of the order"
        },
        "cancelReason": {
          "type": "string",
          "description": "Reason for cancellation if status is cancelled"
        },
        "errorCode": {
          "type": "string",
          "description": "Error code if status update failed"
        },
        "validation_errors": {
          "type": "object",
          "description": "Validation errors if any"
        }
      },
      "required": ["clientorderID", "status"]
    }
  },
  "required": ["restaurant", "order"]
}
```

### Response Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "success": {
      "type": "string",
      "enum": ["1", "0"],
      "description": "Indicates if the request was successful"
    },
    "message": {
      "type": "string",
      "description": "Response message"
    },
    "restID": {
      "type": "string",
      "description": "Restaurant identifier"
    },
    "orderID": {
      "type": "string",
      "description": "System's order identifier"
    },
    "status": {
      "type": "string",
      "description": "Updated order status"
    }
  },
  "required": ["success", "message", "orderID", "status"]
}
```

### Response Codes
| Code | Description |
|------|-------------|
| 200  | Success - Status updated |
| 400  | Bad Request - Invalid parameters |
| 401  | Unauthorized - Invalid credentials |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Order not found |
| 409  | Conflict - Invalid status transition |
| 422  | Unprocessable Entity - Validation error |
| 500  | Internal Server Error |

### Order Status Flow
1. pending → confirmed → preparing → ready_for_pickup → delivered
2. pending → confirmed → preparing → out_for_delivery → delivered
3. Any status → cancelled (with reason)
4. Any status → rejected (with reason)

### Notes
1. Status updates must follow the defined order flow
2. Cancellation and rejection can happen at any stage
3. A reason is required for cancellation and rejection
4. The API supports partial updates
5. Status changes are idempotent
6. All status changes are logged
7. Status changes trigger notifications to relevant parties
8. The API supports bulk status updates
9. Status changes can be scheduled for future execution
10. Status changes can be rolled back in case of errors 

## Order Status Callback API

### Endpoint
```
POST /api/v1/callback
```

### Description
This endpoint is used by POS systems to notify our system about order status updates. The callback URL will be provided in the order creation request.

### Request Parameters

#### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | application/json |

#### Body Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "restaurant": {
      "type": "object",
      "properties": {
        "restID": {
          "type": "string",
          "description": "Unique identifier of the restaurant"
        }
      },
      "required": ["restID"]
    },
    "order": {
      "type": "object",
      "properties": {
        "orderID": {
          "type": "string",
          "description": "System's order identifier"
        },
        "status": {
          "type": "string",
          "enum": [
            "pending",
            "confirmed",
            "preparing",
            "ready_for_pickup",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "rejected"
          ],
          "description": "Current status of the order"
        },
        "cancel_reason": {
          "type": "string",
          "description": "Reason for cancellation if status is cancelled"
        },
        "minimum_prep_time": {
          "type": "string",
          "description": "Minimum preparation time in minutes"
        },
        "minimum_delivery_time": {
          "type": "string",
          "description": "Minimum delivery time in minutes"
        },
        "delivery": {
          "type": "object",
          "properties": {
            "rider_name": {
              "type": "string",
              "description": "Name of the delivery rider"
            },
            "rider_phone_number": {
              "type": "string",
              "description": "Contact number of the delivery rider"
            }
          }
        },
        "is_modified": {
          "type": "boolean",
          "description": "Indicates if the order has been modified"
        }
      },
      "required": ["orderID", "status"]
    }
  },
  "required": ["restaurant", "order"]
}
```

### Response Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "success": {
      "type": "string",
      "enum": ["1", "0"],
      "description": "Indicates if the callback was processed successfully"
    },
    "message": {
      "type": "string",
      "description": "Response message"
    }
  },
  "required": ["success", "message"]
}
```

### Response Codes
| Code | Description |
|------|-------------|
| 200  | Success - Callback processed |
| 400  | Bad Request - Invalid parameters |
| 404  | Not Found - Order not found |
| 500  | Internal Server Error |

### Notes
1. The callback URL must be HTTPS
2. Callbacks should be retried on failure (recommended: 3 retries with exponential backoff)
3. Each callback should be idempotent
4. Callbacks should be sent within 5 seconds of status change
5. All status changes must be notified via callback
6. Callbacks should include all available information
7. Callbacks should be authenticated
8. Callbacks should be logged for audit purposes
9. Callbacks should be validated before processing
10. Callbacks should be processed asynchronously

### Callback Requirements for POS Systems
1. Must implement retry mechanism for failed callbacks
2. Must send callbacks for all status changes
3. Must include all available information in callbacks
4. Must implement proper error handling
5. Must maintain callback logs
6. Must implement proper security measures
7. Must handle callback timeouts
8. Must implement proper validation
9. Must handle callback failures gracefully
10. Must implement proper monitoring 