# Shared External ID Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for handling shared external IDs when multiple restaurants use the same POS menu sharing code. The solution enables data reuse while maintaining restaurant-specific customizations.

## Problem Statement

### Current Issue
- Multiple restaurants can share the same menu sharing code (`pos_restaurant_id`) 
- When syncing menus, the same external IDs (categories, items, addons) appear across multiple restaurants
- Current schema creates duplicate records instead of reusing shared menu data
- This leads to data inconsistency, storage bloat, and maintenance complexity

### Real-World Scenario
- Restaurant A and Restaurant B both use menu sharing code `afp53r16`
- Petpooja returns identical external IDs for categories, items, and addons
- Currently: System creates duplicate records for each restaurant
- Desired: System reuses shared records with restaurant-specific customizations

## Solution Architecture

### Core Principle: **Reuse External Records with Restaurant-Specific Linking**

1. **Shared Menu Data**: Categories, Items, AddOns become shared resources
2. **Restaurant Linking**: Many-to-many relationships between restaurants and menu entities
3. **Override Capability**: Restaurants can override specific properties (price, name, availability)
4. **Data Integrity**: Single source of truth for shared menu items

## Implementation Phases

### Phase 1: Database Schema Enhancement

#### 1.1 New Linking Tables
```sql
-- Restaurant-Category Linking (Many-to-Many)
restaurant_categories (
    restaurant_id, category_id, is_active, rank,
    restaurant_specific_name
)

-- Restaurant-Item Linking (Many-to-Many)  
restaurant_items (
    restaurant_id, item_id, is_active, rank,
    restaurant_specific_price, restaurant_specific_name,
    restaurant_specific_description, restaurant_specific_availability
)

-- Restaurant-AddOnGroup Linking
restaurant_addon_groups (
    restaurant_id, addon_group_id, is_active, rank,
    restaurant_specific_name
)

-- Restaurant-AddOnItem Linking
restaurant_addon_items (
    restaurant_id, addon_item_id, is_active, rank,
    restaurant_specific_price, restaurant_specific_name
)
```

#### 1.2 Enhanced Indexing
- Add `idx_external_id` on all menu tables
- Add composite `idx_restaurant_external` indexes
- Optimize for external ID lookups and restaurant-specific queries

#### 1.3 Data Sync Tracking
```sql
menu_sync_log (
    restaurant_id, sync_type, sync_status,
    external_records_processed, new_records_created,
    existing_records_reused, conflicts_resolved
)
```

#### 1.4 Menu Query View
- `restaurant_menu_view`: Unified view combining shared data with restaurant overrides
- Simplifies frontend queries and maintains backward compatibility

### Phase 2: Enhanced Menu Sync Service

#### 2.1 Smart External ID Handling
```javascript
async function syncMenuItem(restaurantId, externalItem) {
  // 1. Check if item with external_id already exists
  let item = await findItemByExternalId(externalItem.external_id);
  
  if (item) {
    // REUSE: Link restaurant to existing item
    await linkRestaurantToItem(restaurantId, item.id);
    // Update item data if source is newer
    await updateItemIfNewer(item, externalItem);
    stats.existing_records_reused++;
  } else {
    // CREATE: New external item
    item = await createNewItem(externalItem);
    await linkRestaurantToItem(restaurantId, item.id);
    stats.new_records_created++;
  }
}
```

#### 2.2 Conflict Resolution Strategy
- **Last Update Wins**: When multiple restaurants update shared items
- **Audit Trail**: Track all changes with timestamps and restaurant IDs
- **Override Preservation**: Maintain restaurant-specific customizations

#### 2.3 Sync Performance Optimization
- Batch processing for large menus
- Transactional integrity for rollback capability
- Progress tracking and resumable syncs

### Phase 3: Data Migration Strategy

#### 3.1 Existing Data Migration
```sql
-- Step 1: Identify duplicate external_ids across restaurants
-- Step 2: Consolidate duplicates to single records
-- Step 3: Create restaurant linking records
-- Step 4: Migrate restaurant-specific customizations
-- Step 5: Validate data integrity
```

#### 3.2 Backward Compatibility
- Maintain existing API contracts during transition
- Gradual migration with fallback mechanisms
- Comprehensive testing with existing restaurants

### Phase 4: API Layer Updates

#### 4.1 Menu Query APIs
- Update menu fetching to use restaurant-specific view
- Maintain response format for frontend compatibility
- Add support for restaurant-specific overrides

#### 4.2 Restaurant Management APIs
- Add endpoints for setting restaurant-specific overrides
- Bulk menu customization capabilities
- Menu sharing status and conflict resolution

## Technical Specifications

### Database Changes
- **New Tables**: 5 linking tables + 1 sync log table
- **New Indexes**: 8 optimized indexes for performance  
- **New View**: 1 unified menu query view
- **Storage Impact**: ~30% reduction in duplicate menu data

### API Changes
- **Backward Compatible**: Existing APIs continue working
- **New Endpoints**: Restaurant-specific customization APIs
- **Performance**: 2-3x faster menu queries with proper indexing

### Sync Logic Changes
- **External ID Checking**: Before create, check if exists
- **Smart Linking**: Automatic restaurant-menu relationships
- **Conflict Handling**: Configurable resolution strategies

## Risk Assessment & Mitigation

### High Risk: Data Migration Complexity
- **Mitigation**: Comprehensive backup + rollback procedures
- **Testing**: Stage environment with production data copy
- **Validation**: Automated data integrity checks

### Medium Risk: Performance Impact
- **Mitigation**: Optimized indexing + query performance testing
- **Monitoring**: Database performance metrics during rollout
- **Scaling**: Connection pooling + query optimization

### Low Risk: API Compatibility
- **Mitigation**: Maintain existing API contracts
- **Testing**: Automated API regression testing
- **Documentation**: Clear migration guides for frontend teams

## Success Metrics

### Data Quality
- **Zero Duplicate External IDs**: Across all restaurants
- **Data Consistency**: 100% sync accuracy between POS and Ding
- **Override Functionality**: Restaurant customizations working correctly

### Performance
- **Menu Query Speed**: <200ms for typical restaurant menu
- **Sync Speed**: 50% faster than current implementation
- **Storage Efficiency**: 30% reduction in menu data storage

### Business Impact
- **Menu Updates**: Real-time sync across restaurant chains
- **Customization Flexibility**: Restaurant-specific pricing and availability
- **Operational Efficiency**: Simplified menu management for chains

## Implementation Timeline

### Week 1: Database Schema
- Create migration scripts
- Test in development environment
- Performance benchmark baseline

### Week 2: Menu Sync Service
- Implement smart external ID handling
- Add conflict resolution logic
- Unit and integration testing

### Week 3: Data Migration
- Migrate existing duplicate data
- Create restaurant linking records
- Validate data integrity

### Week 4: API Updates & Testing
- Update menu query endpoints
- Frontend integration testing
- Performance testing and optimization

### Week 5: Production Rollout
- Staged deployment to production
- Monitor system metrics
- Support restaurant onboarding

## Monitoring & Maintenance

### Key Metrics to Track
- Menu sync success/failure rates
- External ID conflict frequency
- Restaurant override usage patterns
- Database query performance
- API response times

### Alerting Setup
- Failed menu syncs
- Data integrity violations
- Performance degradation
- High conflict resolution frequency

## Future Enhancements

### Phase 6: Advanced Features
- **Menu Versioning**: Track historical menu changes
- **Bulk Operations**: Chain-wide menu updates
- **Analytics**: Menu performance insights
- **AI Recommendations**: Optimal menu configurations

### Phase 7: Multi-POS Support
- **Generic Framework**: Support multiple POS systems
- **Unified Menu Model**: Common menu abstraction layer
- **Cross-POS Migrations**: Move restaurants between POS systems

## Conclusion

This implementation provides a robust, scalable solution for handling shared external IDs while maintaining data integrity and enabling restaurant-specific customizations. The phased approach ensures minimal disruption to existing operations while delivering significant improvements in data consistency and system performance.

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-30  
**Next Review**: After Phase 1 completion 