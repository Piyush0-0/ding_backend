const { saveOrder } = require('./services/posAdapters/petpoojaAdapter');

async function testPetpoojaSaveOrder() {
    console.log('Starting Petpooja Save Order API test with new payload structure...');

    const petpoojaApiConfig = {
        app_key: 'nh5xgk8jzr0mwv4qtau26yp3d17bs9ie',
        app_secret: '71b9cbaa4d866b7bb14668c6f76cd6a2c159aead',
        access_token: '8c3ce1377b19c2f5da15b1cb4502bdc7344884c1',
        restID: 'afp53r16', // YOUR Petpooja Restaurant ID (menu sharing code)
        save_order_endpoint: 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/save_order',
        // Optional: These can be passed in config if you don't want them in mockOrderInputData
        // restaurant_name_petpooja: "Dynamite Lounge From Config",
        // restaurant_address_petpooja: "Config Address",
        // restaurant_contact_petpooja: "1112223330",
        udid: "test_udid_123", // Optional
        device_type: "WebClientTester" // Optional
    };

    // This structure should provide the data needed by constructPetpoojaOrderInfo
    // It's based on the example JSON you provided.
    const mockOrderInputData = {
        // Restaurant details can be included here if not in petpoojaApiConfig, or to override
        restaurant_details_for_petpooja: {
            res_name: "Dynamite Lounge",
            address: "2nd Floor, Reliance Mall, Nr.Akshar Chowk",
            contact_information: "9427846660"
            // restID is taken from petpoojaApiConfig.restID
        },
        customer_name: "Harsha",
        customer_address: "Vijayawada",
        customer_phone: "8879979899",
        customer_email: "xxx@gmail.com",
        customer_latitude: "34.11752681212772",
        customer_longitude: "74.72949172653219",

        order_id: `MyOrder_${Date.now()}`, // Your system's order ID
        preorder_date: "2024-07-30", // Example: YYYY-MM-DD
        preorder_time: "15:50:00",   // Example: HH:MM:SS
        service_charge: "0",
        sc_tax_amount: "0",
        delivery_charges: "50",
        dc_tax_amount: "2.5",
        dc_gst_details: [
            { gst_liable: "vendor", amount: "2.5" },
            { gst_liable: "restaurant", amount: "0" }
        ],
        packing_charges: "20",
        pc_tax_amount: "1",
        pc_gst_details: [
            { gst_liable: "vendor", amount: "1" },
            { gst_liable: "restaurant", amount: "0" }
        ],
        order_type: "H", // H for Home Delivery, P for Pickup, D for Dine-in (Confirm with Petpooja)
        ondc_bap: "buyerAppNameExample",
        advanced_order: "N", // Y or N
        urgent_order: false,
        urgent_time: 20,
        payment_type: "COD",
        table_no: "",
        no_of_persons: "0",
        discount_total: "45",
        tax_total: "65.52",
        discount_type: "F", // F for Flat, P for Percentage
        total: "560",       // Final amount payable by customer
        description: "Test order with new payload structure.",
        created_on: "2024-07-30 15:49:00", // YYYY-MM-DD HH:MM:SS
        enable_delivery: 1,
        min_prep_time: 20,
        callback_url: "https://your.callback.url/notify",
        collect_cash: "480", // Amount to be collected if COD
        otp: "9876",

        items: [
            {
                id: "7765862", // Petpooja Item/Variant ID
                name: "Garlic Bread (3Pieces)",
                gst_liability: "vendor",
                item_tax: [
                    { id: "11213", name: "CGST", amount: "3.15" }, // Petpooja Tax ID
                    { id: "20375", name: "SGST", amount: "3.15" }
                ],
                item_discount: "14",
                price: "140.00",
                final_price: "126",
                quantity: "1",
                description: "",
                variation_name: "3Pieces",
                variation_id: "89058", // Petpooja Variation ID
                AddonItem: { details: [] }
            },
            {
                id: "118829149", // Petpooja Item ID
                name: "Veg Loaded Pizza",
                gst_liability: "vendor",
                item_tax: [
                    { id: "11213", name: "CGST", amount: "2.75" },
                    { id: "20375", name: "SGST", amount: "2.75" }
                ],
                item_discount: "", // Or "0"
                price: "110.00",
                final_price: "110.00",
                quantity: "1",
                description: "",
                variation_name: "",
                variation_id: "",
                AddonItem: {
                    details: [
                        { id: "1150783", name: "Mojito", group_name: "Add Beverage", price: "0", group_id: 135699, quantity: "1" }, // Petpooja Addon ID, Group ID
                        { id: "1150813", name: "Cheese", group_name: "Extra Toppings", price: "10", group_id: 135707, quantity: "1" }
                    ]
                }
            },
            {
                id: "118807411", // Petpooja Item ID
                name: "Chocolate Cake",
                gst_liability: "restaurant",
                item_tax: [
                    { id: "21866", name: "CGST", amount: "25.11" },
                    { id: "21867", name: "SGST", amount: "25.11" }
                ],
                item_discount: "31",
                price: "310.00",
                final_price: "279",
                quantity: "1",
                description: "",
                variation_name: "",
                variation_id: "",
                AddonItem: { details: [] }
            }
        ],
        taxes: [
            { id: "11213", title: "CGST", type: "P", price: "2.5", tax: "5.9", restaurant_liable_amt: "0.00" }, // Petpooja Tax ID
            { id: "20375", title: "SGST", type: "P", price: "2.5", tax: "5.9", restaurant_liable_amt: "0.00" },
            { id: "21866", title: "CGST", type: "P", price: "9", tax: "25.11", restaurant_liable_amt: "25.11" },
            { id: "21867", title: "SGST", type: "P", price: "9", tax: "25.11", restaurant_liable_amt: "25.11" }
        ],
        discounts: [
            { id: "362", title: "Discount", type: "F", price: "45" } // Petpooja Discount ID
        ]
    };

    try {
        const result = await saveOrder(petpoojaApiConfig, mockOrderInputData);

        if (result.error) {
            console.error('Test FAILED:', result.message);
            if(result.data) {
                console.error('Error details:', JSON.stringify(result.data, null, 2));
            }
        } else {
            console.log('Test SUCCEEDED (API call made). API Response Status:', result.status);
            console.log('Full API Response Body:', JSON.stringify(result.data, null, 2));
            
            if (result.data && result.data.success === "1") {
                console.log('SUCCESS: Petpooja reported order saved successfully!');
                if(result.data.order_id) console.log('Petpooja Order ID:', result.data.order_id);
            } else if (result.data && result.data.success === "0") {
                console.warn('FAILURE: Petpooja reported an error:', result.data.message);
            } else {
                console.warn('UNKNOWN RESPONSE: Review Petpooja response carefully.');
            }
        }
    } catch (e) {
        console.error('Test script encountered an unhandled exception:', e);
    }

    console.log('Petpooja Save Order API test finished.');
}

testPetpoojaSaveOrder(); 