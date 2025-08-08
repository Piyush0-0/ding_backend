const enhancedOrderService = require('../../../enhancedOrderService');
const { validateOrderInput } = require('../config/validator');

/**
 * Enhanced Order Mapper for PetPooja
 * Uses our enhanced menu structure to build complete order payloads
 * with proper tax calculations, attributes, and metadata
 */

/**
 * Main function to map order info using enhanced data
 * @param {object} orderInputData - Basic order input
 * @param {object} restaurantConfig - Restaurant configuration
 * @returns {object} Complete PetPooja order payload
 */
async function mapEnhancedOrderInfo(orderInputData, restaurantConfig) {
    console.log('🔄 Enhanced Order Mapping Started');
    
    try {
        // Get enhanced order data from our rich menu structure
        const enhancedData = await enhancedOrderService.getEnhancedOrderData(orderInputData.order_id);
        
        console.log('✅ Enhanced order data retrieved:', {
            order_id: enhancedData.order_id,
            items_count: enhancedData.items.length,
            total_amount: enhancedData.total,
            tax_total: enhancedData.tax_total,
            packing_charges: enhancedData.packing_charges
        });
        
        // Build the complete PetPooja order structure
        const petpoojaOrder = {
            OrderInfo: {
                Restaurant: {
                    details: {
                        res_name: restaurantConfig.res_name || enhancedData.restaurant_name,
                        address: restaurantConfig.address || enhancedData.restaurant_address,
                        contact_information: restaurantConfig.contact_information || enhancedData.restaurant_contact,
                        restID: restaurantConfig.restID
                    }
                },
                Customer: {
                    details: {
                        email: enhancedData.customer_email || orderInputData.customer_email || "",
                        name: enhancedData.customer_name || orderInputData.customer_name || "Guest Customer",
                        address: enhancedData.customer_address || orderInputData.customer_address || "",
                        phone: enhancedData.customer_phone || orderInputData.customer_phone || "",
                        latitude: orderInputData.customer_latitude || "",
                        longitude: orderInputData.customer_longitude || ""
                    }
                },
                Order: {
                    details: {
                        orderID: enhancedData.order_id,
                        preorder_date: orderInputData.preorder_date || new Date().toISOString().split('T')[0],
                        preorder_time: orderInputData.preorder_time || new Date().toISOString().split('T')[1].split('.')[0],
                        service_charge: orderInputData.service_charge || "0",
                        sc_tax_amount: orderInputData.sc_tax_amount || "0",
                        delivery_charges: orderInputData.delivery_charges || "0",
                        dc_tax_amount: orderInputData.dc_tax_amount || "0",
                        dc_gst_details: orderInputData.dc_gst_details || [],
                        packing_charges: enhancedData.packing_charges || "0",
                        pc_tax_amount: calculatePackingTax(enhancedData.packing_charges),
                        pc_gst_details: buildPackingGSTDetails(enhancedData.packing_charges),
                        order_type: mapOrderType(orderInputData.order_type || 'DELIVERY'),
                        ondc_bap: orderInputData.ondc_bap || "",
                        advanced_order: orderInputData.advanced_order || "N",
                        urgent_order: orderInputData.urgent_order || false,
                        urgent_time: orderInputData.urgent_time || 20,
                        payment_type: mapPaymentType(enhancedData.payment_type || 'COD'),
                        table_no: orderInputData.table_no || "",
                        no_of_persons: orderInputData.no_of_persons || "0",
                        discount_total: orderInputData.discount_total || "0",
                        tax_total: enhancedData.tax_total || "0",
                        discount_type: orderInputData.discount_type || "F",
                        total: enhancedData.total,
                        description: orderInputData.description || "",
                        created_on: formatDateForPetPooja(enhancedData.created_on),
                        enable_delivery: orderInputData.enable_delivery || 1,
                        min_prep_time: orderInputData.min_prep_time || 20,
                        callback_url: orderInputData.callback_url || "",
                        collect_cash: orderInputData.collect_cash || enhancedData.total,
                        otp: orderInputData.otp || ""
                    }
                },
                OrderItem: {
                    details: enhancedData.items.map(item => {
                        // Validate item has required fields
                        if (!item.id || item.id === 'undefined' || item.id === item.name) {
                            console.warn(`⚠️ Item "${item.name}" has invalid external_id: ${item.id}`);
                            console.warn('This will likely cause PetPooja SaveOrder to fail!');
                        }
                        
                        return {
                            id: item.id,
                            name: item.name,
                            gst_liability: item.gst_liability || "vendor",
                            item_tax: item.item_tax || [],
                            item_discount: item.item_discount || "0",
                            price: parseFloat(item.price).toFixed(2),
                            final_price: parseFloat(item.final_price || item.price).toFixed(2),
                            quantity: item.quantity.toString(),
                            description: item.description || "",
                            variation_name: item.variation_name || "",
                            variation_id: item.variation_id || "",
                            AddonItem: item.AddonItem || { details: [] }
                        };
                    })
                },
                Tax: {
                    details: (enhancedData.taxes || []).map(tax => ({
                        id: tax.id,
                        title: tax.title,
                        type: tax.type,
                        price: tax.price,
                        tax: tax.tax,
                        restaurant_liable_amt: tax.restaurant_liable_amt
                    }))
                },
                Discount: {
                    details: enhancedData.discounts || []
                }
            }
        };
        
        // Validate the order before returning
        const validation = validatePetPoojaOrder(petpoojaOrder);
        if (!validation.isValid) {
            console.error('❌ Enhanced order validation failed:', validation.errors);
            throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
        }
        
        console.log('🎉 Enhanced order mapping completed successfully');
        
        return petpoojaOrder;
        
    } catch (error) {
        console.error('❌ Enhanced order mapping failed:', error);
        console.log('🔄 Falling back to basic order mapping...');
        
        // Fallback to basic mapping if enhanced mapping fails
        return mapBasicOrderInfo(orderInputData, restaurantConfig);
    }
}

/**
 * Fallback basic order mapping (existing functionality)
 */
function mapBasicOrderInfo(orderInputData, restaurantConfig) {
    console.log('⚠️ Using basic order mapping (enhanced mapping failed)');
    
    // Validate required fields
    const validationResult = validateOrderInput(orderInputData);
    if (!validationResult.isValid) {
        throw new Error(`Invalid order input: ${validationResult.errors.join(', ')}`);
    }

    return {
        OrderInfo: {
            Restaurant: {
                details: {
                    res_name: restaurantConfig.res_name || "Unknown Restaurant",
                    address: restaurantConfig.address || "N/A",
                    contact_information: restaurantConfig.contact_information || "N/A",
                    restID: restaurantConfig.restID
                }
            },
            Customer: {
                details: {
                    email: orderInputData.customer_email || "",
                    name: orderInputData.customer_name || "Guest Customer",
                    address: orderInputData.customer_address || "N/A",
                    phone: orderInputData.customer_phone || "",
                    latitude: orderInputData.customer_latitude || "",
                    longitude: orderInputData.customer_longitude || ""
                }
            },
            Order: {
                details: {
                    orderID: orderInputData.order_id,
                    preorder_date: orderInputData.preorder_date || new Date().toISOString().split('T')[0],
                    preorder_time: orderInputData.preorder_time || new Date().toISOString().split('T')[1].split('.')[0],
                    service_charge: orderInputData.service_charge || "0",
                    sc_tax_amount: orderInputData.sc_tax_amount || "0",
                    delivery_charges: orderInputData.delivery_charges || "0",
                    dc_tax_amount: orderInputData.dc_tax_amount || "0",
                    dc_gst_details: orderInputData.dc_gst_details || [],
                    packing_charges: orderInputData.packing_charges || "0",
                    pc_tax_amount: orderInputData.pc_tax_amount || "0",
                    pc_gst_details: orderInputData.pc_gst_details || [],
                    order_type: mapOrderType(orderInputData.order_type || 'DELIVERY'),
                    ondc_bap: orderInputData.ondc_bap || "",
                    advanced_order: orderInputData.advanced_order || "N",
                    urgent_order: orderInputData.urgent_order || false,
                    urgent_time: orderInputData.urgent_time || 20,
                    payment_type: mapPaymentType(orderInputData.payment_type || 'COD'),
                    table_no: orderInputData.table_no || "",
                    no_of_persons: orderInputData.no_of_persons || "0",
                    discount_total: orderInputData.discount_total || "0",
                    tax_total: orderInputData.tax_total || "0",
                    discount_type: orderInputData.discount_type || "F",
                    total: orderInputData.total,
                    description: orderInputData.description || "",
                    created_on: orderInputData.created_on || new Date().toISOString().replace('T', ' ').substring(0, 19),
                    enable_delivery: orderInputData.enable_delivery || 1,
                    min_prep_time: orderInputData.min_prep_time || 20,
                    callback_url: orderInputData.callback_url || "",
                    collect_cash: orderInputData.collect_cash || orderInputData.total || "0",
                    otp: orderInputData.otp || ""
                }
            },
            OrderItem: {
                details: orderInputData.items.map((item, index) => {
                    // Validate and fix item external_id issues
                    let itemId = item.id;
                    if (!itemId || itemId === 'undefined' || itemId === item.name) {
                        console.warn(`⚠️ Item "${item.name}" has invalid external_id: ${itemId}`);
                        console.warn(`📝 Using fallback item ID based on position: ITEM_${index + 1}`);
                        itemId = `FALLBACK_ITEM_${index + 1}`;
                    }
                    
                    return {
                        id: itemId,
                        name: item.name,
                        gst_liability: item.gst_liability || "vendor",
                        item_tax: item.item_tax || [],
                        item_discount: item.item_discount || "0",
                        price: parseFloat(item.price).toFixed(2),
                        final_price: parseFloat(item.final_price || item.price).toFixed(2),
                        quantity: item.quantity.toString(),
                        description: item.description || "",
                        variation_name: item.variation_name || "",
                        variation_id: item.variation_id || "",
                        AddonItem: item.AddonItem || { details: [] }
                    };
                })
            },
            Tax: {
                details: orderInputData.taxes || []
            },
            Discount: {
                details: orderInputData.discounts || []
            }
        }
    };
}

// Helper functions
const mapOrderType = (type) => {
    const typeMap = {
        'DINE_IN': 'D',
        'PICKUP': 'P',
        'DELIVERY': 'H'
    };
    return typeMap[type?.toUpperCase()] || 'H';
};

const mapPaymentType = (method) => {
    const methodMap = {
        'CASH': 'COD',
        'CARD': 'CARD',
        'UPI': 'UPI',
        'WALLET': 'WALLET'
    };
    return methodMap[method?.toUpperCase()] || 'COD';
};

const calculatePackingTax = (packingCharges) => {
    // Simple 5% tax on packing charges - can be enhanced
    return (parseFloat(packingCharges) * 0.05).toFixed(2);
};

const buildPackingGSTDetails = (packingCharges) => {
    const taxAmount = calculatePackingTax(packingCharges);
    return [
        { gst_liable: "vendor", amount: (parseFloat(taxAmount) / 2).toFixed(2) },
        { gst_liable: "restaurant", amount: (parseFloat(taxAmount) / 2).toFixed(2) }
    ];
};

const formatDateForPetPooja = (dateString) => {
    if (!dateString) return new Date().toISOString().replace('T', ' ').substring(0, 19);
    const date = new Date(dateString);
    return date.toISOString().replace('T', ' ').substring(0, 19);
};

/**
 * Validate PetPooja order structure
 */
function validatePetPoojaOrder(order) {
    const errors = [];
    
    // Check required restaurant details
    if (!order.OrderInfo?.Restaurant?.details?.restID) {
        errors.push('Missing restaurant ID (restID)');
    }
    
    // Check required customer details
    if (!order.OrderInfo?.Customer?.details?.name) {
        errors.push('Missing customer name');
    }
    
    // Check required order details
    const orderDetails = order.OrderInfo?.Order?.details;
    if (!orderDetails?.orderID) {
        errors.push('Missing order ID');
    }
    if (!orderDetails?.total || parseFloat(orderDetails.total) <= 0) {
        errors.push('Invalid or missing total amount');
    }
    if (!orderDetails?.preorder_date) {
        errors.push('Missing preorder_date');
    }
    if (!orderDetails?.preorder_time) {
        errors.push('Missing preorder_time');
    }
    
    // Check order items
    const items = order.OrderInfo?.OrderItem?.details;
    if (!items || items.length === 0) {
        errors.push('No order items found');
    } else {
        items.forEach((item, index) => {
            if (!item.id || item.id === 'undefined') {
                errors.push(`Item ${index + 1} (${item.name}) has missing or invalid external_id`);
            }
            if (!item.name) {
                errors.push(`Item ${index + 1} is missing name`);
            }
            if (!item.price || parseFloat(item.price) < 0) {
                errors.push(`Item ${index + 1} (${item.name}) has invalid price`);
            }
            if (!item.quantity || parseInt(item.quantity) <= 0) {
                errors.push(`Item ${index + 1} (${item.name}) has invalid quantity`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    mapEnhancedOrderInfo,
    mapBasicOrderInfo,
    mapOrderType,
    mapPaymentType
}; 