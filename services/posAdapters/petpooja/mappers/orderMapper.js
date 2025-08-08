const { validateOrderInput } = require('../config/validator');
const db = require('../../../../db');

const mapCustomerDetails = (customer) => ({
    email: customer.email || "",
    name: customer.name || "N/A Customer",
    address: customer.address || "N/A Address",
    phone: customer.phone || "",
    latitude: customer.latitude || "",
    longitude: customer.longitude || ""
});

const mapOrderDetails = (order) => ({
    orderID: order.id?.toString() || `TEMP_ORD_${Date.now()}`,
    order_type: mapOrderType(order.order_type),
    payment_type: mapPaymentType(order.payment_method),
    total: String(order.total_amount || "0"),
    description: order.description || "",
    created_on: order.created_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
    table_no: order.table_number || "",
    // Optional fields that might be needed for specific order types
    ...(order.pickup_eta_minutes && { min_prep_time: order.pickup_eta_minutes }),
    ...(order.pickup_requested_at && { preorder_time: order.pickup_requested_at }),
    // Use breakdown fields from order
    service_charge: String(order.service_charge || "0"),
    sc_tax_amount: "0", // Tax on service charge - can be enhanced later
    delivery_charges: String(order.delivery_charge || "0"),
    dc_tax_amount: "0", // Tax on delivery charge - can be enhanced later
    dc_gst_details: [],
    packing_charges: String(order.packaging_charge || "0"),
    pc_tax_amount: "0", // Tax on packaging charge - can be enhanced later
    pc_gst_details: [],
    tax_total: String(order.tax_amount || "0"),
    ondc_bap: "",
    advanced_order: "N",
    urgent_order: false,
    urgent_time: 0,
    no_of_persons: "0",
    discount_total: String(order.discount_amount || "0"),
    discount_type: "F",
    enable_delivery: 1,
    callback_url: "",
    collect_cash: String(order.total_amount || "0"),
    otp: ""
});

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

const mapOrderItem = (item) => ({
    id: item.item_id,
    name: item.name,
    gst_liability: "vendor",
    item_tax: [], // We'll need to implement tax mapping if required
    item_discount: "0",
    price: String(item.unit_price || "0"),
    final_price: String((item.unit_price * item.quantity) + (item.add_ons_total || 0)),
    quantity: String(item.quantity || "1"),
    description: item.description || "",
    variation_name: item.variation_name || "",
    variation_id: item.variation_id || "",
    AddonItem: {
        details: (item.addon_items || []).map(addon => ({
            id: addon.id,
            name: addon.name,
            group_name: addon.group_name || "",
            price: String(addon.price || "0"),
            group_id: addon.group_id || "",
            quantity: String(addon.quantity || "1")
        }))
    }
});

const mapTaxDetails = (tax) => ({
    id: tax.id,
    title: tax.title || "Tax",
    type: tax.type || "P",
    price: String(tax.price || "0"),
    tax: String(tax.tax || "0"),
    restaurant_liable_amt: String(tax.restaurant_liable_amt || "0")
});

const mapDiscountDetails = (discount) => ({
    id: discount.id,
    title: discount.title || "Discount",
    type: discount.type || "F",
    price: String(discount.price || "0")
});

// Enhanced order mapper with proper tax calculations
async function mapOrderInfoWithTaxes(orderInputData, restaurantConfig) {
    console.log('🏗️ Enhanced Order Mapping with Tax Calculations Started');
    
    // Validate required fields
    if (!orderInputData.order_id) {
        throw new Error('Order ID is required');
    }
    if (!orderInputData.customer_name) {
        throw new Error('Customer name is required');
    }
    if (!orderInputData.customer_phone) {
        throw new Error('Customer phone is required');
    }

    // Calculate enhanced item details with taxes
    const enhancedItems = await Promise.all(orderInputData.items.map(async (item) => {
        // Get item tax details from database
        const itemTaxes = await getItemTaxDetails(item.id, restaurantConfig.restaurant_id);
        
        // Calculate item-level taxes
        const basePrice = parseFloat(item.price);
        const quantity = parseInt(item.quantity);
        const subtotal = basePrice * quantity;
        
        let itemTaxAmount = 0;
        const itemTaxDetails = [];
        
        for (const tax of itemTaxes) {
            let taxAmount = 0;
            if (tax.type === 'percentage') {
                taxAmount = subtotal * (parseFloat(tax.rate) / 100);
            } else {
                taxAmount = parseFloat(tax.rate) * quantity;
            }
            
            itemTaxAmount += taxAmount;
            itemTaxDetails.push({
                id: tax.external_id,
                name: tax.name,
                amount: taxAmount.toFixed(2)
            });
        }
        
        // Add fallback 5% CGST + SGST if no taxes configured
        if (itemTaxDetails.length === 0) {
            const cgstAmount = subtotal * 0.025; // 2.5% CGST
            const sgstAmount = subtotal * 0.025; // 2.5% SGST
            
            itemTaxDetails.push(
                { id: "default_cgst", name: "CGST", amount: cgstAmount.toFixed(2) },
                { id: "default_sgst", name: "SGST", amount: sgstAmount.toFixed(2) }
            );
            
            itemTaxAmount = cgstAmount + sgstAmount;
        }
        
        return {
            id: item.id,
            name: item.name,
            gst_liability: "vendor", // Can be enhanced based on item attributes
            item_tax: itemTaxDetails,
            item_discount: "0", // TODO: Implement discount calculation
            price: String(item.price),
            final_price: String(subtotal + itemTaxAmount),
            quantity: String(item.quantity),
            description: item.description || "",
            variation_name: item.variation_name || "",
            variation_id: item.variation_id || "",
            AddonItem: {
                details: (item.AddonItem?.details || []).map(addon => ({
                    id: addon.id,
                    name: addon.name,
                    group_name: addon.group_name || "",
                    price: String(addon.price || "0"),
                    group_id: addon.group_id,
                    quantity: String(addon.quantity || "1")
                }))
            }
        };
    }));
    
    // Calculate restaurant-level tax summary
    const restaurantTaxes = await getRestaurantTaxSummary(restaurantConfig.restaurant_id, enhancedItems);
    
    // Calculate totals
    const subtotal = enhancedItems.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
    const totalTaxAmount = enhancedItems.reduce((sum, item) => {
        return sum + item.item_tax.reduce((taxSum, tax) => taxSum + parseFloat(tax.amount), 0);
    }, 0);
    const grandTotal = subtotal + totalTaxAmount;
    
    return {
        RestaurantInfo: {
            restaurant_name: restaurantConfig.restaurant_name_petpooja || "Restaurant",
            restaurant_address: restaurantConfig.restaurant_address_petpooja || "",
            restaurant_contact: restaurantConfig.restaurant_contact_petpooja || "",
            restaurant_logo: "",
            device_type: restaurantConfig.device_type || "WebClient",
            udid: restaurantConfig.udid || "web_device",
            restID: restaurantConfig.restID || ""
        },
        CustomerInfo: {
            customer_name: orderInputData.customer_name,
            customer_address: orderInputData.customer_address || "",
            customer_phone: orderInputData.customer_phone,
            customer_email: orderInputData.customer_email || ""
        },
        Order: {
            details: {
                orderID: orderInputData.order_id,
                preorder_date: orderInputData.preorder_date || "",
                preorder_time: orderInputData.preorder_time || "",
                service_charge: orderInputData.service_charge || "0",
                sc_tax_amount: orderInputData.sc_tax_amount || "0",
                delivery_charges: orderInputData.delivery_charges || "0",
                dc_tax_amount: orderInputData.dc_tax_amount || "0",
                dc_gst_details: orderInputData.dc_gst_details || [],
                packing_charges: orderInputData.packing_charges || "0",
                pc_tax_amount: orderInputData.pc_tax_amount || "0",
                pc_gst_details: orderInputData.pc_gst_details || [],
                order_type: mapOrderType(orderInputData.order_type),
                ondc_bap: orderInputData.ondc_bap || "",
                advanced_order: orderInputData.advanced_order || "N",
                urgent_order: orderInputData.urgent_order || false,
                urgent_time: orderInputData.urgent_time || 20,
                payment_type: orderInputData.payment_type,
                table_no: orderInputData.table_no || "",
                no_of_persons: orderInputData.no_of_persons || "0",
                discount_total: orderInputData.discount_total || "0",
                tax_total: totalTaxAmount.toFixed(2),
                discount_type: orderInputData.discount_type || "F",
                total: grandTotal.toFixed(2),
                description: orderInputData.description || "",
                created_on: orderInputData.created_on || new Date().toISOString().replace('T', ' ').substring(0, 19),
                enable_delivery: orderInputData.enable_delivery || 1,
                min_prep_time: orderInputData.min_prep_time || 20,
                callback_url: orderInputData.callback_url || "",
                collect_cash: orderInputData.collect_cash || grandTotal.toFixed(2),
                otp: orderInputData.otp || ""
            }
        },
        OrderItem: {
            details: enhancedItems
        },
        Tax: {
            details: restaurantTaxes
        },
        Discount: {
            details: [] // TODO: Implement discount system
        }
    };
}

/**
 * Get item tax details from database
 */
async function getItemTaxDetails(itemExternalId, restaurantId) {
    try {
        // Get item tax configuration
        const [itemRows] = await db.query(
            `SELECT tax_ids, tax_inclusive FROM Items 
             WHERE external_id = ? AND restaurant_id = ?`,
            [itemExternalId, restaurantId]
        );

        if (!itemRows || itemRows.length === 0 || !itemRows[0].tax_ids) {
            return []; // No taxes configured
        }

        const taxIds = itemRows[0].tax_ids.split(',').map(id => id.trim()).filter(Boolean);
        
        if (taxIds.length === 0) {
            return [];
        }

        // Fetch tax details
        const placeholders = taxIds.map(() => '?').join(',');
        const [taxRows] = await db.query(
            `SELECT external_id, name, rate, type FROM Taxes 
             WHERE external_id IN (${placeholders}) 
             AND restaurant_id = ? 
             AND is_active = 1`,
            [...taxIds, restaurantId]
        );

        return taxRows || [];

    } catch (error) {
        console.error('Error getting item tax details:', error);
        return [];
    }
}

/**
 * Get restaurant-level tax summary for PetPooja
 */
async function getRestaurantTaxSummary(restaurantId, enhancedItems) {
    try {
        // Collect all unique tax IDs from items
        const allTaxes = new Map();
        
        enhancedItems.forEach(item => {
            item.item_tax.forEach(tax => {
                if (allTaxes.has(tax.id)) {
                    allTaxes.set(tax.id, {
                        ...allTaxes.get(tax.id),
                        tax: (parseFloat(allTaxes.get(tax.id).tax) + parseFloat(tax.amount)).toFixed(2)
                    });
                } else {
                    allTaxes.set(tax.id, {
                        id: tax.id,
                        title: tax.name,
                        type: "P", // Percentage type
                        price: "0", // Rate will be filled if available
                        tax: tax.amount,
                        restaurant_liable_amt: "0.00"
                    });
                }
            });
        });
        
        // Get tax rates from database
        const taxIds = Array.from(allTaxes.keys());
        if (taxIds.length > 0) {
            const placeholders = taxIds.map(() => '?').join(',');
            const [taxRows] = await db.query(
                `SELECT external_id, rate, type FROM Taxes 
                 WHERE external_id IN (${placeholders}) 
                 AND restaurant_id = ? 
                 AND is_active = 1`,
                [...taxIds, restaurantId]
            );
            
            taxRows.forEach(dbTax => {
                if (allTaxes.has(dbTax.external_id)) {
                    const taxSummary = allTaxes.get(dbTax.external_id);
                    taxSummary.price = dbTax.rate.toString();
                    taxSummary.type = dbTax.type === 'percentage' ? 'P' : 'F';
                }
            });
        }
        
        return Array.from(allTaxes.values());
        
    } catch (error) {
        console.error('Error getting restaurant tax summary:', error);
        return [];
    }
}

module.exports = {
    mapOrderInfo: mapOrderInfoWithTaxes,
    mapCustomerDetails,
    mapOrderDetails,
    mapOrderItem,
    mapTaxDetails,
    mapDiscountDetails,
    mapOrderType,
    mapPaymentType
}; 