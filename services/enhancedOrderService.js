const db = require('../db');

/**
 * Enhanced Order Service
 * Builds complete order data by leveraging our enhanced menu structure
 * to send proper tax details, attributes, and metadata to PetPooja
 */

class EnhancedOrderService {
    
    /**
     * Get complete order data with enhanced menu information
     * @param {number} orderId - Local order ID
     * @returns {object} Enhanced order data for PetPooja
     */
    async getEnhancedOrderData(orderId) {
        const connection = await db.getConnection();
        
        try {
            // Get basic order data
            const orderData = await this.getOrderWithItems(connection, orderId);
            
            // Enhance with menu metadata
            const enhancedOrderData = await this.enhanceWithMenuData(connection, orderData);
            
            // Calculate taxes and totals
            const finalOrderData = await this.calculateTaxesAndTotals(connection, enhancedOrderData);
            
            return finalOrderData;
            
        } finally {
            connection.release();
        }
    }
    
    /**
     * Get order with basic item information
     */
    async getOrderWithItems(connection, orderId) {
        // Get order details
        const [orders] = await connection.query(`
            SELECT o.*, r.name as restaurant_name, r.contact as restaurant_contact,
                   r.address as restaurant_address
            FROM Orders o
            JOIN Restaurants r ON o.restaurant_id = r.id
            WHERE o.id = ?
        `, [orderId]);
        
        if (orders.length === 0) {
            throw new Error(`Order ${orderId} not found`);
        }
        
        const order = orders[0];
        
        // Get order items with basic details
        const [orderItems] = await connection.query(`
            SELECT oi.*, i.name as item_name, i.external_id as item_external_id,
                   i.attribute_id, i.tax_ids, i.tax_inclusive, i.gst_type,
                   i.allow_variation, i.allow_addon, i.packing_charges as item_packing_charges,
                   v.name as variation_name, v.external_id as variation_external_id,
                   v.variation_groupname, v.addon_groups as variation_addon_groups,
                   v.packing_charges as variation_packing_charges
            FROM OrderItems oi
            JOIN Items i ON oi.item_id = i.id
            LEFT JOIN Variations v ON oi.variation_id = v.id
            WHERE oi.order_id = ?
        `, [orderId]);
        
        return {
            order,
            items: orderItems
        };
    }
    
    /**
     * Enhance order data with detailed menu metadata
     */
    async enhanceWithMenuData(connection, orderData) {
        const { order, items } = orderData;
        
        // Enhance each item with detailed information
        const enhancedItems = await Promise.all(items.map(async (item) => {
            // Get item attributes
            const itemAttribute = await this.getItemAttribute(connection, item.attribute_id);
            
            // Get item taxes
            const itemTaxes = await this.getItemTaxes(connection, order.restaurant_id, item.tax_ids);
            
            // Get add-on details if present
            const addonDetails = await this.getAddonDetails(connection, item.addon_items);
            
            // Get variation-specific addon groups if applicable
            const variationAddonGroups = item.variation_addon_groups 
                ? JSON.parse(item.variation_addon_groups) 
                : [];
            
            return {
                ...item,
                // Enhanced menu data
                attribute: itemAttribute,
                taxes: itemTaxes,
                addons: addonDetails,
                variation_addon_groups: variationAddonGroups,
                // Calculate item-level packing charges
                effective_packing_charges: item.variation_packing_charges || item.item_packing_charges || 0
            };
        }));
        
        // Get restaurant-level taxes
        const restaurantTaxes = await this.getRestaurantTaxes(connection, order.restaurant_id);
        
        return {
            order,
            items: enhancedItems,
            restaurant_taxes: restaurantTaxes
        };
    }
    
    /**
     * Get item attribute details
     */
    async getItemAttribute(connection, attributeId) {
        if (!attributeId) return null;
        
        const [attributes] = await connection.query(`
            SELECT * FROM ItemAttributes WHERE external_id = ? AND is_active = 1
        `, [attributeId]);
        
        return attributes[0] || null;
    }
    
    /**
     * Get item tax details
     */
    async getItemTaxes(connection, restaurantId, taxIds) {
        if (!taxIds) return [];
        
        const taxIdArray = taxIds.split(',').map(id => id.trim());
        
        const [taxes] = await connection.query(`
            SELECT * FROM Taxes 
            WHERE restaurant_id = ? AND external_id IN (${taxIdArray.map(() => '?').join(',')}) 
            AND is_active = 1
            ORDER BY \`rank\`
        `, [restaurantId, ...taxIdArray]);
        
        return taxes;
    }
    
    /**
     * Get restaurant-level taxes
     */
    async getRestaurantTaxes(connection, restaurantId) {
        const [taxes] = await connection.query(`
            SELECT * FROM Taxes 
            WHERE restaurant_id = ? AND is_active = 1
            ORDER BY \`rank\`
        `, [restaurantId]);
        
        return taxes;
    }
    
    /**
     * Get detailed addon information
     */
    async getAddonDetails(connection, addonItemsJson) {
        if (!addonItemsJson) return [];
        
        const addonItems = JSON.parse(addonItemsJson);
        
        const addonDetails = await Promise.all(addonItems.map(async (addon) => {
            // Get addon item details
            const [addonItemRows] = await connection.query(`
                SELECT ai.*, ag.name as group_name, ag.external_id as group_external_id,
                       ia.name as attribute_name
                FROM AddOnItems ai
                JOIN AddOnGroups ag ON ai.addon_group_id = ag.id
                LEFT JOIN ItemAttributes ia ON ai.attribute_id = ia.external_id
                WHERE ai.id = ?
            `, [addon.id]);
            
            const addonItem = addonItemRows[0];
            
            return {
                ...addon,
                external_id: addonItem?.external_id,
                name: addonItem?.name || addon.name,
                group_name: addonItem?.group_name,
                group_external_id: addonItem?.group_external_id,
                attribute: addonItem?.attribute_name,
                unit_price: addonItem?.price || addon.price
            };
        }));
        
        return addonDetails;
    }
    
    /**
     * Calculate comprehensive taxes and totals
     */
    async calculateTaxesAndTotals(connection, orderData) {
        const { order, items, restaurant_taxes } = orderData;
        
        let totalItemAmount = 0;
        let totalTaxAmount = 0;
        let totalPackingCharges = 0;
        
        // Calculate item-level totals and taxes
        const itemsWithCalculations = items.map(item => {
            const basePrice = parseFloat(item.unit_price) * parseInt(item.quantity);
            const addonTotal = item.addons.reduce((sum, addon) => 
                sum + (parseFloat(addon.unit_price) * parseInt(addon.quantity)), 0);
            
            const itemSubtotal = basePrice + addonTotal;
            const itemPackingCharges = parseFloat(item.effective_packing_charges) * parseInt(item.quantity);
            
            // Calculate item taxes
            const itemTaxDetails = item.taxes.map(tax => {
                const taxableAmount = item.tax_inclusive ? itemSubtotal : itemSubtotal;
                const taxAmount = (parseFloat(tax.rate) / 100) * taxableAmount;
                
                return {
                    id: tax.external_id,
                    name: tax.name,
                    type: tax.type === 'percentage' ? 'P' : 'F',
                    rate: tax.rate,
                    amount: taxAmount.toFixed(2),
                    restaurant_liable_amt: "0.00" // Default - can be enhanced based on business logic
                };
            });
            
            const itemTaxTotal = itemTaxDetails.reduce((sum, tax) => sum + parseFloat(tax.amount), 0);
            
            totalItemAmount += itemSubtotal;
            totalTaxAmount += itemTaxTotal;
            totalPackingCharges += itemPackingCharges;
            
            return {
                ...item,
                calculated: {
                    base_price: basePrice,
                    addon_total: addonTotal,
                    subtotal: itemSubtotal,
                    packing_charges: itemPackingCharges,
                    tax_details: itemTaxDetails,
                    tax_total: itemTaxTotal,
                    final_price: itemSubtotal + itemTaxTotal + itemPackingCharges
                }
            };
        });
        
        // Format for PetPooja
        return {
            order_id: order.id.toString(),
            customer_name: order.customer_name || "Guest Customer",
            customer_phone: order.customer_phone || "",
            customer_address: order.customer_address || "",
            customer_email: order.customer_email || "",
            restaurant_name: order.restaurant_name,
            restaurant_address: order.restaurant_address,
            restaurant_contact: order.restaurant_contact,
            total: (totalItemAmount + totalTaxAmount + totalPackingCharges).toFixed(2),
            subtotal: totalItemAmount.toFixed(2),
            tax_total: totalTaxAmount.toFixed(2),
            packing_charges: totalPackingCharges.toFixed(2),
            payment_type: order.payment_method || 'COD',
            order_type: 'H', // Can be enhanced based on order type
            created_on: order.created_at,
            items: itemsWithCalculations.map(item => ({
                id: item.item_external_id || item.item_id.toString(),
                name: item.item_name,
                quantity: item.quantity.toString(),
                price: item.unit_price.toString(),
                final_price: item.calculated.final_price.toFixed(2),
                gst_liability: item.attribute?.name === 'non-veg' ? 'restaurant' : 'vendor', // Business logic
                item_tax: item.calculated.tax_details,
                variation_id: item.variation_external_id || "",
                variation_name: item.variation_name || "",
                AddonItem: {
                    details: item.addons.map(addon => ({
                        id: addon.external_id || addon.id.toString(),
                        name: addon.name,
                        group_name: addon.group_name || "",
                        group_id: addon.group_external_id || addon.group_id || "",
                        price: addon.unit_price.toString(),
                        quantity: addon.quantity.toString()
                    }))
                }
            })),
            taxes: restaurant_taxes.map(tax => ({
                id: tax.external_id,
                title: tax.name,
                type: tax.type === 'percentage' ? 'P' : 'F',
                price: tax.rate.toString(),
                tax: totalTaxAmount.toFixed(2), // Total tax amount for this tax type
                restaurant_liable_amt: "0.00" // Can be calculated based on business logic
            })),
            discounts: [] // Can be enhanced when discount system is implemented
        };
    }
}

module.exports = new EnhancedOrderService(); 