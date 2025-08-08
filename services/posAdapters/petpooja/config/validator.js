function validateConfig(config, type = 'all') {
    const baseFields = ['app_key', 'app_secret', 'access_token', 'restID'];
    const orderFields = ['save_order_endpoint'];
    
    let requiredFields = baseFields;
    if (type === 'order' || type === 'all') {
        requiredFields = [...baseFields, ...orderFields];
    }

    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
        throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }

    return {
        ...config,
        restaurant_name_petpooja: config.restaurant_name_petpooja || '',
        restaurant_address_petpooja: config.restaurant_address_petpooja || '',
        restaurant_contact_petpooja: config.restaurant_contact_petpooja || '',
        udid: config.udid || `web_${Date.now()}`,
        device_type: config.device_type || 'WebClient'
    };
}

function validateOrderInput(orderInputData) {
    const errors = [];
    const requiredFields = [
        'customer_name',
        'customer_address',
        'customer_phone',
        'order_id',
        'preorder_date',
        'preorder_time',
        'payment_type',
        'total',
        'items'
    ];

    // Check required fields
    requiredFields.forEach(field => {
        if (!orderInputData[field]) {
            errors.push(`Missing required field: ${field}`);
        }
    });

    // Validate customer phone number
    if (orderInputData.customer_phone && !/^\d{10}$/.test(orderInputData.customer_phone)) {
        errors.push('Invalid customer phone number format');
    }

    // Validate order items
    if (orderInputData.items && Array.isArray(orderInputData.items)) {
        orderInputData.items.forEach((item, index) => {
            if (!item.id || !item.name || !item.price || !item.quantity) {
                errors.push(`Invalid item at index ${index}: missing required fields`);
            }
            if (item.AddonItem?.details) {
                item.AddonItem.details.forEach((addon, addonIndex) => {
                    if (!addon.id || !addon.name || !addon.group_id) {
                        errors.push(`Invalid addon at item ${index}, addon ${addonIndex}: missing required fields`);
                    }
                });
            }
        });
    } else {
        errors.push('Order must contain at least one item');
    }

    // Validate dates and times
    if (orderInputData.preorder_date && !/^\d{4}-\d{2}-\d{2}$/.test(orderInputData.preorder_date)) {
        errors.push('Invalid preorder date format (YYYY-MM-DD)');
    }
    if (orderInputData.preorder_time && !/^\d{2}:\d{2}:\d{2}$/.test(orderInputData.preorder_time)) {
        errors.push('Invalid preorder time format (HH:MM:SS)');
    }

    // Validate numeric fields
    const numericFields = ['total', 'service_charge', 'delivery_charges', 'packing_charges', 'discount_total', 'tax_total'];
    numericFields.forEach(field => {
        if (orderInputData[field] && isNaN(parseFloat(orderInputData[field]))) {
            errors.push(`Invalid ${field}: must be a number`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateConfig,
    validateOrderInput
}; 