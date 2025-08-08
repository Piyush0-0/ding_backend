const mapRestaurantDetails = (restaurant, integration) => ({
    res_name: restaurant.name,
    address: restaurant.address,
    contact_information: restaurant.contact,
    restID: integration.pos_restaurant_id || integration.config?.restID,
    menusharingcode: integration.config?.menusharingcode || "",
    currency_html: "₹",
    country: restaurant.country || "India",
    images: [],
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    landmark: restaurant.landmark || "",
    city: restaurant.city,
    state: restaurant.state,
    minimumorderamount: restaurant.minimum_order_amount?.toString() || "0",
    minimumdeliverytime: restaurant.minimum_prep_time ? `${restaurant.minimum_prep_time}Minutes` : "",
    minimum_prep_time: restaurant.minimum_prep_time?.toString() || "",
    deliverycharge: restaurant.delivery_charge?.toString() || "0",
    
    // Enhanced service charge configuration
    sc_applicable_on: restaurant.sc_applicable_on || "H,P,D",
    sc_type: restaurant.sc_type || "2", // 1=Fixed, 2=Percentage
    sc_calculate_on: restaurant.sc_calculate_on || "2", // 1=CORE, 2=TOTAL (default to TOTAL for percentage)
    sc_value: restaurant.sc_value?.toString() || "0",
    tax_on_sc: restaurant.tax_on_sc || "0", // 0=No tax on service charge, 1=Tax applicable
    
    // Enhanced packaging charge configuration
    packaging_applicable_on: restaurant.packaging_applicable_on || "ORDER",
    packaging_charge: restaurant.packaging_charge?.toString() || "0",
    packaging_charge_type: restaurant.packaging_charge_type || "FIXED",
    calculatetaxonpacking: restaurant.calculate_tax_on_packing || "0",
    
    // Delivery charge configuration
    calculatetaxondelivery: restaurant.calculate_tax_on_delivery || "0",
    
    // Restaurant status
    active: restaurant.is_active ? "1" : "0"
});

module.exports = {
    mapRestaurantDetails
}; 