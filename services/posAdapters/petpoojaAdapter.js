const axios = require('axios');
const { mapRestaurantDetails } = require('./petpooja/mappers/restaurantMapper');
const { mapOrderInfo } = require('./petpooja/mappers/orderMapper');
const { mapEnhancedOrderInfo } = require('./petpooja/mappers/enhancedOrderMapper');
const { validateConfig } = require('./petpooja/config/validator');

// Debug utility
const debug = (message, data = null) => {
    console.log(`[PETPOOJA-DEBUG] ${new Date().toISOString()} - ${message}`);
    if (data) {
        console.log(`[PETPOOJA-DEBUG] Data:`, JSON.stringify(data, null, 2));
    }
};

class PetPoojaError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'PetPoojaError';
        this.code = code;
        this.details = details;
    }
}

async function fetchMenu(config) {
    debug(`🍽️ Starting fetchMenu`);
    
    try {
        const validatedConfig = validateConfig(config, 'menu');
        const fetchMenuEndpoint = validatedConfig.endpoint || 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/mapped_restaurant_menus';

        debug(`📡 Fetching menu from endpoint: ${fetchMenuEndpoint}`, {
            restID: validatedConfig.restID,
            app_key: validatedConfig.app_key?.substring(0, 10) + '...'
        });

        console.log(`Fetching menu from Petpooja: ${fetchMenuEndpoint} for restID: ${validatedConfig.restID}`);
        const response = await axios.post(
            fetchMenuEndpoint,
            { restID: validatedConfig.restID },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'app-key': validatedConfig.app_key,
                    'app-secret': validatedConfig.app_secret,
                    'access-token': validatedConfig.access_token
                },
                timeout: 30000 // Increased to 30 seconds for menu preview operations
            }
        );

        debug(`📥 Menu API response received:`, {
            status: response.status,
            success: response.data?.success,
            menuItemCount: response.data?.menu?.items?.length || 0
        });

        if (!response.data || response.data.success !== '1') {
            debug(`❌ Invalid response from Petpooja API`, response.data);
            throw new PetPoojaError(
                'Invalid response from Petpooja API',
                'MENU_FETCH_FAILED',
                response.data
            );
        }

        debug(`✅ Menu fetched successfully`);
        
        return {
            status: response.status,
            data: response.data,
            menu: response.data.menu || {}
        };
    } catch (err) {
        debug(`❌ Petpooja Fetch Menu API error:`, {
            message: err.message,
            code: err.code,
            response: err.response?.data
        });
        
        console.error('Petpooja Fetch Menu API error:', err.message);
        if (err instanceof PetPoojaError) {
            throw err;
        }
        throw new PetPoojaError(
            err.message,
            'MENU_FETCH_ERROR',
            err.response?.data
        );
    }
}

async function saveOrder(config, orderInputData) {
    debug(`📤 Starting saveOrder for order ID: ${orderInputData.order_id}`);
    try {
        const validatedConfig = validateConfig(config, 'order');
        debug(`⚙️ Config validated:`, {
            restID: validatedConfig.restID,
            save_order_endpoint: validatedConfig.save_order_endpoint,
            udid: validatedConfig.udid,
            device_type: validatedConfig.device_type
        });
        const restaurantConfig = {
            restID: validatedConfig.restID,
            res_name: validatedConfig.restaurant_name_petpooja || orderInputData.restaurant_details_for_petpooja?.res_name,
            address: validatedConfig.restaurant_address_petpooja || orderInputData.restaurant_details_for_petpooja?.address,
            contact_information: validatedConfig.restaurant_contact_petpooja || orderInputData.restaurant_details_for_petpooja?.contact_information
        };
        debug(`🏪 Restaurant config:`, restaurantConfig);
        // Always use enhancedOrderMapper, throw if it fails
        let orderInfoPayload;
        try {
            orderInfoPayload = await mapEnhancedOrderInfo(orderInputData, restaurantConfig);
            debug(`✅ Enhanced order mapping successful`);
        } catch (enhancedError) {
            debug(`❌ Enhanced mapping failed, throwing error:`, enhancedError.message);
            throw new PetPoojaError(
                'Enhanced order mapping failed',
                'ENHANCED_MAPPING_FAILED',
                enhancedError.message
            );
        }
        debug(`🔄 Order mapped to PetPooja format:`, {
            order_id: orderInfoPayload.OrderInfo?.Order?.details?.orderID,
            customer_name: orderInfoPayload.OrderInfo?.Customer?.details?.name,
            total: orderInfoPayload.OrderInfo?.Order?.details?.total,
            items_count: orderInfoPayload.OrderInfo?.OrderItem?.details?.length,
            payment_type: orderInfoPayload.OrderInfo?.Order?.details?.payment_type,
            tax_total: orderInfoPayload.OrderInfo?.Order?.details?.tax_total,
            packing_charges: orderInfoPayload.OrderInfo?.Order?.details?.packing_charges,
            enhanced_data: true
        });
        const finalPayload = {
            app_key: validatedConfig.app_key,
            app_secret: validatedConfig.app_secret,
            access_token: validatedConfig.access_token,
            orderinfo: orderInfoPayload,
            udid: validatedConfig.udid,
            device_type: validatedConfig.device_type
        };
        debug(`📡 Sending request to PetPooja:`, {
            endpoint: validatedConfig.save_order_endpoint,
            order_id: finalPayload.orderinfo.OrderInfo?.Order?.details?.orderID,
            payload_size: JSON.stringify(finalPayload).length,
            has_enhanced_data: true
        });
        console.log(`Sending order to Petpooja: ${validatedConfig.save_order_endpoint}`);
        
        // 🔍 COMPREHENSIVE PAYLOAD LOGGING
        console.log('\n🚀 ========== COMPLETE PETPOOJA PAYLOAD ==========');
        console.log('📡 Endpoint:', validatedConfig.save_order_endpoint);
        console.log('📦 Complete Final Payload:', JSON.stringify(finalPayload, null, 2));
        console.log('\n🔍 ========== PAYLOAD BREAKDOWN ==========');
        console.log('🔑 App Key:', finalPayload.app_key);
        console.log('🔐 App Secret:', finalPayload.app_secret ? '[REDACTED]' : 'NOT SET');
        console.log('🎟️ Access Token:', finalPayload.access_token ? '[REDACTED]' : 'NOT SET');
        console.log('📱 UDID:', finalPayload.udid);
        console.log('🖥️ Device Type:', finalPayload.device_type);
        
        if (finalPayload.orderinfo) {
            console.log('\n📋 ========== ORDER INFO STRUCTURE ==========');
            console.log('📦 OrderInfo Keys:', Object.keys(finalPayload.orderinfo.OrderInfo || {}));
            
            if (finalPayload.orderinfo.OrderInfo?.Restaurant) {
                console.log('🏪 Restaurant Details:', JSON.stringify(finalPayload.orderinfo.OrderInfo.Restaurant, null, 2));
            }
            
            if (finalPayload.orderinfo.OrderInfo?.Customer) {
                console.log('👤 Customer Details:', JSON.stringify(finalPayload.orderinfo.OrderInfo.Customer, null, 2));
            }
            
            if (finalPayload.orderinfo.OrderInfo?.Order) {
                console.log('🛒 Order Details:', JSON.stringify(finalPayload.orderinfo.OrderInfo.Order, null, 2));
                console.log('🔗 CALLBACK URL:', finalPayload.orderinfo.OrderInfo.Order.details?.callback_url || 'NOT SET');
            }
            
            if (finalPayload.orderinfo.OrderInfo?.OrderItem) {
                console.log('🍽️ Order Items Count:', finalPayload.orderinfo.OrderInfo.OrderItem.details?.length || 0);
                console.log('📋 Order Items:', JSON.stringify(finalPayload.orderinfo.OrderInfo.OrderItem, null, 2));
            }
            
            if (finalPayload.orderinfo.OrderInfo?.OrderTax) {
                console.log('💰 Order Tax:', JSON.stringify(finalPayload.orderinfo.OrderInfo.OrderTax, null, 2));
            }
            
            if (finalPayload.orderinfo.OrderInfo?.OrderDiscount) {
                console.log('🎟️ Order Discount:', JSON.stringify(finalPayload.orderinfo.OrderInfo.OrderDiscount, null, 2));
            }
        }
        console.log('🚀 ===============================================\n');
        
        const response = await axios.post(
            validatedConfig.save_order_endpoint,
            finalPayload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 20000
            }
        );
        debug(`📥 PetPooja API response:`, {
            status: response.status,
            success: response.data?.success,
            orderID: response.data?.orderID,
            clientOrderID: response.data?.clientOrderID,
            restID: response.data?.restID,
            message: response.data?.message,
            full_response: response.data  // Log complete response for debugging
        });
        
        // 🔍 COMPREHENSIVE RESPONSE LOGGING
        console.log('\n📥 ========== PETPOOJA API RESPONSE ==========');
        console.log('📊 Response Status:', response.status);
        console.log('📦 Complete Response Data:', JSON.stringify(response.data, null, 2));
        console.log('\n🔍 ========== RESPONSE BREAKDOWN ==========');
        console.log('✅ Success:', response.data?.success);
        console.log('🆔 Order ID:', response.data?.orderID || 'EMPTY/NULL');
        console.log('🏷️ Client Order ID:', response.data?.clientOrderID || 'EMPTY/NULL');
        console.log('🏪 Restaurant ID:', response.data?.restID || 'EMPTY/NULL');
        console.log('💬 Message:', response.data?.message || 'NO MESSAGE');
        console.log('⚠️ Errors:', response.data?.errors || 'NO ERRORS');
        console.log('📥 ===============================================\n');
        
        if (!response.data || response.data.success !== '1') {
            debug(`❌ Failed to save order in Petpooja`, response.data);
            
            // Log detailed error information for debugging
            console.error('🚨 PETPOOJA SAVE ORDER FAILED:');
            console.error('📊 Response Status:', response.status);
            console.error('📄 Full Response Data:', JSON.stringify(response.data, null, 2));
            
            if (response.data) {
                if (response.data.message) {
                    console.error('💬 PetPooja Error Message:', response.data.message);
                }
                if (response.data.errors) {
                    console.error('📝 PetPooja Errors:', JSON.stringify(response.data.errors, null, 2));
                }
                if (response.data.success === '0') {
                    console.error('❌ PetPooja explicitly returned success=0');
                }
            } else {
                console.error('❌ PetPooja returned no response data');
            }
            
            // Also log the payload we sent for comparison
            console.error('📤 Payload sent to PetPooja:');
            console.error('🔧 Order ID:', finalPayload.orderinfo.OrderInfo?.Order?.details?.orderID);
            console.error('🏪 Restaurant ID:', finalPayload.orderinfo.OrderInfo?.Restaurant?.details?.restID);
            console.error('🍽️ Items Count:', finalPayload.orderinfo.OrderInfo?.OrderItem?.details?.length);
            console.error('💰 Total Amount:', finalPayload.orderinfo.OrderInfo?.Order?.details?.total);
            console.error('📱 Items Details:', JSON.stringify(
                finalPayload.orderinfo.OrderInfo?.OrderItem?.details?.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })), null, 2
            ));
            
            throw new PetPoojaError(
                `Failed to save order in Petpooja: ${response.data?.message || 'Unknown error'}`,
                'ORDER_SAVE_FAILED',
                response.data
            );
        }
        debug(`✅ Order saved successfully in PetPooja! POS Order ID: ${response.data.orderID}`);
        return {
            status: response.status,
            data: response.data,
            orderId: response.data.orderID,
            enhanced_mapping_used: true
        };
    } catch (err) {
        debug(`❌ Petpooja Save Order API error:`, {
            order_id: orderInputData.order_id,
            message: err.message,
            code: err.code,
            response: err.response?.data
        });
        console.error('Petpooja Save Order API error:', err.message);
        if (err instanceof PetPoojaError) {
            throw err;
        }
        throw new PetPoojaError(
            err.message,
            'ORDER_SAVE_ERROR',
            err.response?.data
        );
    }
}

module.exports = {
    fetchMenu,
    saveOrder,
    PetPoojaError
}; 