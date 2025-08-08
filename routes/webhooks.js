const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../services/webhookService');

// Dynamic webhook handlers - add new providers here
const WEBHOOK_HANDLERS = {
    petpooja: require('../services/webhookHandlers/petpoojaWebhookHandler'),
    // posist: require('../services/webhookHandlers/posistWebhookHandler'),
    // toast: require('../services/webhookHandlers/toastWebhookHandler'),
};

// Generic signature verification middleware
const verifyWebhookSignatureMiddleware = (providerName) => {
    return async (req, res, next) => {
        try {
            const signature = req.headers[`x-${providerName}-signature`] || req.headers['x-webhook-signature'];
            const { restaurant_id, pos_restaurant_id, restID } = req.body;
            
            if (!signature) {
                return res.status(401).json({ error: 'Missing webhook signature' });
            }
            
            const restaurantIdToUse = restaurant_id || pos_restaurant_id || restID;
            if (!restaurantIdToUse) {
                return res.status(400).json({ error: 'Missing restaurant identifier in payload' });
            }
            
            const isValid = await verifyWebhookSignature(
                req.body, 
                signature, 
                restaurantIdToUse, 
                providerName
            );
            
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
            
            next();
        } catch (error) {
            console.error(`${providerName} webhook signature verification error:`, error);
            res.status(500).json({ error: 'Webhook verification failed' });
        }
    };
};

// Generic webhook handler with support for custom response formats
const createWebhookHandler = (providerName, handlerMethod, requiresSignature = true) => {
    return async (req, res) => {
        try {
            console.log(`${providerName} webhook received:`, req.body);
            
            const handler = WEBHOOK_HANDLERS[providerName];
            if (!handler || !handler[handlerMethod]) {
                throw new Error(`Handler ${handlerMethod} not found for provider ${providerName}`);
            }
            
            const result = await handler[handlerMethod](req.body);
            
            res.status(200).json(result);
        } catch (error) {
            console.error(`${providerName} webhook error:`, error);
            
            // Handle custom error response formats (for store status endpoints)
            if (error.responseFormat && error.statusCode) {
                return res.status(error.statusCode).json(error.responseFormat);
            }
            
            res.status(500).json({ error: 'Failed to process webhook' });
        }
    };
};

// PetPooja webhooks (using generic pattern)
router.post('/petpooja/order-status', 
    verifyWebhookSignatureMiddleware('petpooja'), 
    createWebhookHandler('petpooja', 'updateOrderStatus')
);

router.post('/petpooja/menu-update', 
    verifyWebhookSignatureMiddleware('petpooja'), 
    createWebhookHandler('petpooja', 'handleMenuUpdate')
);

router.post('/petpooja/inventory-update', 
    verifyWebhookSignatureMiddleware('petpooja'), 
    createWebhookHandler('petpooja', 'handleInventoryUpdate')
);

// Stock update webhook (GENERIC - for internal use, testing, and comprehensive logging)
// Features: detailed responses, full audit trails, works with any POS provider
// Use for: admin panels, bulk operations, testing
router.post('/petpooja/stock-update', 
    createWebhookHandler('petpooja', 'handleStockUpdate', false)
);

// Store status webhooks (no signature verification required based on legacy implementation)
router.post('/petpooja/get-store-status', 
    createWebhookHandler('petpooja', 'handleStoreStatus', false)
);

router.post('/petpooja/get_store_status', 
    createWebhookHandler('petpooja', 'handleStoreDeliveryStatus', false)
);

// Update store status webhook
router.post('/petpooja/update_store_status', 
    createWebhookHandler('petpooja', 'handleUpdateStoreStatus', false)
);

// Item/Addon Stock Update webhooks (PETPOOJA SPEC COMPLIANT - for production webhook calls)
// Features: exact PetPooja response format, lightweight, optimized for webhook performance
// Use for: direct PetPooja webhook integration in production

// Mark items/addons as IN STOCK
router.post('/petpooja/item_stock', 
    createWebhookHandler('petpooja', 'handleItemStockUpdate', false)
);

// Mark items/addons as OUT OF STOCK (with optional auto turn-on time)
router.post('/petpooja/item_stock_off', 
    createWebhookHandler('petpooja', 'handleItemStockUpdate', false)
);

// Future: Other providers can be added with same pattern
// router.post('/posist/order-status', 
//     verifyWebhookSignatureMiddleware('posist'), 
//     createWebhookHandler('posist', 'updateOrderStatus')
// );

module.exports = router; 