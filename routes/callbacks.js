const express = require('express');
const router = express.Router();
const { handlePetPoojaCallback } = require('../services/callbackHandlers/petpoojaCallbackHandler');
const { verifyWebhookSignature } = require('../services/webhookService');

/**
 * PetPooja callback endpoint
 * Handles order status updates from PetPooja POS system
 * Supports both legacy (unsecured) and new (secured) callback formats
 */
router.post('/', async (req, res) => {
    try {
        const { 
            restID, 
            orderID, 
            status, 
            cancel_reason, 
            minimum_prep_time, 
            minimum_delivery_time, 
            rider_name, 
            rider_phone_number, 
            is_modified 
        } = req.body;
        
        console.log('PetPooja callback received:', req.body);
        
        // Validate required fields
        if (!restID || !orderID || status === undefined) {
            console.error('Missing required callback fields:', { restID, orderID, status });
            return res.status(400).end();
        }
        
        // Optional signature verification (backward compatible)
        const signature = req.headers['x-petpooja-signature'] || req.headers['x-callback-signature'];
        if (signature) {
            console.log('Signature provided, verifying callback...');
            try {
                const isValid = await verifyWebhookSignature(
                    req.body, 
                    signature, 
                    restID, 
                    'petpooja'
                );
                
                if (!isValid) {
                    console.error('Invalid callback signature');
                    return res.status(401).end();
                }
                console.log('Callback signature verified successfully');
            } catch (error) {
                console.error('Callback signature verification error:', error);
                // Don't fail for legacy callbacks - just log the error
                console.log('Continuing with legacy callback processing...');
            }
        } else {
            console.log('No signature provided - processing as legacy callback');
        }
        
        // Process callback through service layer
        const result = await handlePetPoojaCallback({
            restaurant_id: restID,
            order_id: orderID,
            status: status,
            cancel_reason: cancel_reason,
            minimum_prep_time: minimum_prep_time,
            minimum_delivery_time: minimum_delivery_time,
            rider_name: rider_name,
            rider_phone_number: rider_phone_number,
            is_modified: is_modified,
            fullPayload: req.body
        });
        
        if (result.success) {
            // Return just HTTP status code as requested
            res.status(200).end();
        } else {
            console.error('Callback processing failed:', result.message);
            res.status(404).end(); // Order not found
        }
        
    } catch (error) {
        console.error('PetPooja callback error:', error);
        res.status(500).end();
    }
});

module.exports = router; 