const { fetchMenu } = require('./services/posAdapters/petpoojaAdapter');

async function testPetpoojaFetchMenu() {
    console.log('Starting Petpooja FetchMenu API test...');

    const petpoojaConfig = {
        app_key: 'YOUR_APP_KEY_HERE',
        app_secret: 'YOUR_APP_SECRET_HERE',
        access_token: 'YOUR_ACCESS_TOKEN_HERE',
        restID: 'YOUR_REST_ID_HERE', // Using the menu sharing code as restID as per documentation
        endpoint: 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/mapped_restaurant_menus' 
    };

    try {
        const result = await fetchMenu(petpoojaConfig);

        if (result.error) {
            console.error('Test FAILED:', result.message);
            if(result.data) {
                console.error('Error details:', JSON.stringify(result.data, null, 2));
            }
        } else {
            console.log('Test SUCCEEDED. API Response Status:', result.status);
            console.log('Full API Response Body:', JSON.stringify(result.data, null, 2));
            // You can add more specific checks here based on the expected menu structure
            if (result.data && result.data.success === '1' && result.data.restaurants) {
                console.log('Menu data seems to be successfully fetched for restaurant ID:', result.data.restaurants[0]?.restaurantid);
            } else {
                console.warn('Warning: The response structure might not be as expected or indicates an issue. Please review the full response body.');
            }
        }
    } catch (e) {
        console.error('Test script encountered an unhandled exception:', e);
    }

    console.log('Petpooja FetchMenu API test finished.');
}

testPetpoojaFetchMenu();
