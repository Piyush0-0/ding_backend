# POS Integration Schema Migration Plan

## Executive Summary

This document outlines a complete migration plan to normalize the POS integration schema and eliminate data duplication in the `restaurant_pos_integrations` table. The current system stores restaurant identifiers and API credentials in multiple places, leading to inconsistency and maintenance issues.

**Primary Goal:** Establish `pos_restaurant_id` as the single source of truth for restaurant identification and move API credentials to proper normalized fields.

---

## Current State Analysis

### ❌ Problem: Data Duplication

**Current Config Field Structure:**
```json
{
  "restaurantid": "4435",           // ❌ Legacy, not used for API calls
  "menusharingcode": "afp53r16",    // ❌ DUPLICATE of restID  
  "restID": "afp53r16",             // ❌ DUPLICATE of menusharingcode
  "app_key": "nh5xgk8...",          // ❌ Should be in proper field
  "app_secret": "71b9cbaa...",      // ❌ Should be in restaurant_specific_config
  "access_token": "8c3ce1...",      // ❌ Should be in restaurant_specific_config
  "endpoint": "https://..."         // ❌ Should be in restaurant_specific_config
}
```

**Current Normalized Fields:**
```
pos_restaurant_id: "afp53r16"       // ✅ Correct
api_key: "nh5xgk8..."               // ✅ Correct  
restaurant_specific_config: NULL    // ❌ Not utilized
config: [large JSON blob]           // ❌ Contains duplicated data
```

### Issues with Current Approach
1. **Data Inconsistency:** Restaurant ID stored in 3+ places
2. **Maintenance Complexity:** Updates require changing multiple fields
3. **API Confusion:** Webhooks check both `config.restID` and `pos_restaurant_id`
4. **Schema Bloat:** `config` field contains both duplicated and proper data
5. **Frontend Confusion:** Form has separate fields for `restaurantId` and `menuSharingCode` (which are the same for Petpooja)

---

## Target State: Clean Normalized Schema

### ✅ Target Structure

**Normalized Fields:**
```
pos_restaurant_id: "afp53r16"                    // ✅ Single source for restaurant ID
api_key: "nh5xgk8jzr0mwv4qtau26yp3d17bs9ie"      // ✅ Main API key
```

**Restaurant-Specific Config JSON:**
```json
{
  "app_secret": "71b9cbaa4d866b7bb14668c6f76cd6a2c159aead",
  "access_token": "8c3ce1377b19c2f5da15b1cb4502bdc7344884c1", 
  "endpoint": "https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/mapped_restaurant_menus",
  "udid": "web_1234567890",                       // ✅ Truly restaurant-specific
  "device_type": "WebClient"                      // ✅ Truly restaurant-specific
}
```

**Legacy Config Field:**
```
config: NULL                                     // ✅ Clean, no duplication
```

### Benefits of Target State
1. **Single Source of Truth:** `pos_restaurant_id` is the only restaurant identifier
2. **Clear Separation:** API credentials in proper fields vs restaurant-specific settings
3. **Maintainable:** Updates only require changing one field
4. **Scalable:** Easy to add new POS providers without schema changes
5. **Clear Frontend:** Single field for restaurant identification

---

## Migration Plan: 4 Phases

### Phase 1: Database Migration (Immediate - Safe)

#### 1.1 Migrate API Credentials
```sql
-- Move API credentials from config to normalized fields
UPDATE restaurant_pos_integrations 
SET 
  restaurant_specific_config = JSON_OBJECT(
    'app_secret', JSON_UNQUOTE(JSON_EXTRACT(config, '$.app_secret')),
    'access_token', JSON_UNQUOTE(JSON_EXTRACT(config, '$.access_token')),
    'endpoint', JSON_UNQUOTE(JSON_EXTRACT(config, '$.endpoint')),
    'udid', CONCAT('web_', UNIX_TIMESTAMP()),
    'device_type', 'WebClient'
  ),
  api_key = JSON_UNQUOTE(JSON_EXTRACT(config, '$.app_key'))
WHERE pos_type = 'petpooja' AND config IS NOT NULL;
```

#### 1.2 Verify Migration
```sql
-- Check migrated data
SELECT 
  restaurant_id,
  pos_restaurant_id,
  api_key,
  JSON_EXTRACT(restaurant_specific_config, '$.app_secret') as app_secret,
  JSON_EXTRACT(restaurant_specific_config, '$.access_token') as access_token
FROM restaurant_pos_integrations 
WHERE pos_type = 'petpooja';
```

### Phase 2: Backend Code Updates

#### 2.1 Update POS Config Service
**File:** `services/posConfigService.js`

**Current Code:**
```javascript
const mergedConfig = {
    ...globalConfig,
    ...restaurantConfig,
    restID: config.pos_restaurant_id,
    // ... pulls from config field
};
```

**Updated Code:**
```javascript
const mergedConfig = {
    ...globalConfig,
    ...restaurantConfig,
    
    // Use normalized fields as single source of truth
    restID: config.pos_restaurant_id,
    app_key: config.api_key,
    app_secret: restaurantConfig.app_secret,
    access_token: restaurantConfig.access_token,
    endpoint: restaurantConfig.endpoint || `${config.base_api_url}/mapped_restaurant_menus`,
    
    // Restaurant-specific settings
    udid: restaurantConfig.udid || `web_${Date.now()}`,
    device_type: restaurantConfig.device_type || 'WebClient'
};
```

#### 2.2 Update Webhook Handlers
**File:** `services/webhookHandlers/petpoojaWebhookHandler.js`

**Current Code:**
```sql
WHERE (
    JSON_UNQUOTE(JSON_EXTRACT(rpi.config, '$.restID')) = ?
    OR rpi.pos_restaurant_id = ?
)
```

**Updated Code:**
```sql
WHERE rpi.pos_restaurant_id = ?
```

**Impact:** All webhook queries (5+ locations) simplified to use single field.

#### 2.3 Update Restaurant Mapper
**File:** `services/posAdapters/petpooja/mappers/restaurantMapper.js`

**Current Code:**
```javascript
restID: integration.pos_restaurant_id || integration.config?.restID,
menusharingcode: integration.config?.menusharingcode || "",
```

**Updated Code:**
```javascript
restID: integration.pos_restaurant_id,
menusharingcode: integration.pos_restaurant_id,  // Same as restID for Petpooja
```

### Phase 3: Frontend Updates

#### 3.1 Simplify POS Integration Form
**File:** `ding-partner-onboarding/src/components/onboarding/PosIntegrationStep.js`

**Current Issues:**
- Has both `restaurantId` and `menuSharingCode` fields (confusing)
- Users don't understand the difference
- Both map to the same value in Petpooja

**Proposed Changes:**
```javascript
// Remove this confusing field
<Form.Item name="restaurantId" label="PetPooja Restaurant ID" />

// Keep only this field with better labeling
<Form.Item 
  name="menuSharingCode" 
  label="PetPooja Menu Sharing Code (Restaurant Identifier)" 
  rules={[{ required: true, message: 'Please enter your Menu Sharing Code' }]}
  tooltip="This is your restaurant identifier in PetPooja - found in API Integration settings"
>
  <Input prefix={<KeyOutlined />} placeholder="e.g., afp53r16" />
</Form.Item>
```

#### 3.2 Update API Call
**Current API Call:**
```javascript
const posIntegrationData = {
  posSystem: 'petpooja',
  restaurantId: values.restaurantId,        // ❌ Confusing
  menuSharingCode: values.menuSharingCode,  // ❌ Duplicate
  apiKey: values.apiKey,
  apiSecret: values.apiSecret,
  accessToken: values.accessToken
};
```

**Updated API Call:**
```javascript
const posIntegrationData = {
  posSystem: 'petpooja',
  menuSharingCode: values.menuSharingCode,  // ✅ Single field
  apiKey: values.apiKey,
  apiSecret: values.apiSecret,
  accessToken: values.accessToken
};
```

#### 3.3 Update Backend Endpoint
**File:** `routes/restaurants.js`

**Current Code:**
```javascript
const { posSystem, restaurantId: posRestaurantId, menuSharingCode, apiKey, apiSecret, accessToken } = req.body;
// Uses both restaurantId AND menuSharingCode
```

**Updated Code:**
```javascript
const { posSystem, menuSharingCode, apiKey, apiSecret, accessToken } = req.body;

const posIntegrationData = {
  pos_restaurant_id: menuSharingCode,  // Use menu sharing code as primary ID
  api_key: apiKey,
  restaurant_config: {
    app_secret: apiSecret,
    access_token: accessToken,
    endpoint: 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/mapped_restaurant_menus'
  }
};
```

### Phase 4: Cleanup

#### 4.1 Clear Config Field
```sql
-- Remove duplicated data after successful migration
UPDATE restaurant_pos_integrations 
SET config = NULL 
WHERE pos_type = 'petpooja' 
  AND restaurant_specific_config IS NOT NULL
  AND api_key IS NOT NULL;
```

#### 4.2 Update Documentation
- Update API documentation
- Update onboarding guides
- Update troubleshooting docs

---

## Implementation Timeline

### Immediate (Phase 1)
- [x] Database migration for restaurant ID 11 (completed)
- [ ] Database migration for all Petpooja integrations
- [ ] Verify menu fetch works with normalized fields

### Week 1 (Phase 2)
- [ ] Update PosConfigService
- [ ] Update webhook handlers
- [ ] Update restaurant mapper
- [ ] Test menu sync functionality
- [ ] Test webhook processing

### Week 2 (Phase 3) 
- [ ] Update frontend form
- [ ] Update backend API endpoints
- [ ] End-to-end testing of onboarding flow
- [ ] Test with new restaurant registrations

### Week 3 (Phase 4)
- [ ] Clear config field after validation
- [ ] Update documentation
- [ ] Monitor for any issues
- [ ] Performance testing

---

## Testing Strategy

### Unit Tests
- [ ] PosConfigService returns correct merged config
- [ ] Webhook handlers find restaurants by pos_restaurant_id
- [ ] Restaurant mapper uses correct fields

### Integration Tests
- [ ] Menu fetch API works with normalized data
- [ ] Webhook processing works end-to-end
- [ ] Order placement to Petpooja works
- [ ] Onboarding flow creates correct data structure

### Manual Testing
- [ ] Complete onboarding flow with new restaurant
- [ ] Test menu preview functionality
- [ ] Test webhook receiving (stock updates, order updates)
- [ ] Test order placement to Petpooja

---

## Rollback Plan

### If Migration Fails
1. **Restore Config Field:**
   ```sql
   UPDATE restaurant_pos_integrations 
   SET config = [backup_config_data]
   WHERE restaurant_id = ?;
   ```

2. **Revert Code Changes:**
   - Git revert to previous webhook handler version
   - Restore PosConfigService to use config field
   - Restore frontend form with both fields

3. **Validation Steps:**
   - Test menu fetch functionality
   - Test webhook processing
   - Test order placement

### Prevention Measures
- Take database backup before migration
- Deploy to staging environment first
- Test all critical paths before production
- Have monitoring in place for POS integration errors

---

## Risk Assessment

### High Risk
- **Webhook Processing:** If webhook queries fail, restaurant orders may not be processed
- **Menu Sync:** If menu fetch fails, restaurants can't see their menus

### Medium Risk  
- **Order Placement:** If order placement fails, revenue impact
- **Frontend UX:** User confusion during onboarding

### Low Risk
- **Data Migration:** Can be easily rolled back
- **Config Cleanup:** Can be restored from backup

### Mitigation Strategies
- **Gradual Rollout:** Migrate one restaurant at a time initially
- **Monitoring:** Add alerts for POS integration failures
- **Documentation:** Clear rollback procedures
- **Testing:** Comprehensive testing in staging environment

---

## Success Metrics

### Technical Metrics
- [ ] Zero webhook lookup failures
- [ ] Menu fetch API response time < 5s
- [ ] Order placement success rate > 99%
- [ ] Database queries use proper indexes

### Business Metrics
- [ ] Restaurant onboarding completion rate unchanged
- [ ] Order processing time unchanged
- [ ] Customer experience unchanged
- [ ] Support ticket volume for POS issues reduced

---

## Future Enhancements

### After Migration Completion
1. **Schema Optimization:** Add proper indexes on pos_restaurant_id
2. **Multi-Provider Support:** Easier to add new POS providers
3. **Configuration UI:** Admin interface to manage POS integrations
4. **Monitoring Dashboard:** Real-time POS integration health
5. **Automated Testing:** Integration tests for each POS provider

---

## Conclusion

This migration will significantly improve the maintainability and reliability of the POS integration system. By establishing a single source of truth for restaurant identification and properly organizing API credentials, we eliminate the current data duplication issues and create a foundation for future enhancements.

**Next Steps:**
1. Review and approve this migration plan
2. Set up staging environment for testing
3. Begin Phase 1 database migration
4. Execute phases sequentially with proper testing

---

**Document Version:** 1.0  
**Created:** 2025-06-30  
**Author:** Development Team  
**Status:** Pending Approval 