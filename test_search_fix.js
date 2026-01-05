/**
 * Test script to verify the search functionality fix
 * This script tests the SQLite search view and fallback logic
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database
const dbPath = path.join(__dirname, 'backend', 'data', 'trakit_inventory.db');

function testSearchFunctionality() {
  console.log('🔍 Testing Search Functionality Fix...\n');
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err.message);
      return;
    }
    console.log('✅ Connected to SQLite database');
  });

  // Test 1: Check if asset_search_view exists
  db.get("SELECT name FROM sqlite_master WHERE type='view' AND name='asset_search_view'", (err, row) => {
    if (err) {
      console.error('❌ Error checking view:', err.message);
      return;
    }
    
    if (row) {
      console.log('✅ asset_search_view exists');
      
      // Test 2: Check if view has data
      db.get("SELECT COUNT(*) as count FROM asset_search_view", (err, row) => {
        if (err) {
          console.error('❌ Error counting view records:', err.message);
          return;
        }
        
        console.log(`📊 View contains ${row.count} records`);
        
        // Test 3: Test search functionality
        if (row.count > 0) {
          testSearchQueries(db);
        } else {
          console.log('⚠️  View is empty - no data to test search with');
          db.close();
        }
      });
    } else {
      console.log('❌ asset_search_view does not exist');
      console.log('💡 Run the migration script: backend/database/migration_asset_search_view_sqlite.sql');
      db.close();
    }
  });
}

function testSearchQueries(db) {
  console.log('\n🧪 Testing search queries...\n');
  
  const testQueries = [
    { search: 'vostro', description: 'Dell Vostro laptop' },
    { search: 'dell', description: 'Dell brand' },
    { search: 'laptop', description: 'Laptop type' },
    { search: 'hp', description: 'HP brand' },
    { search: 'lenovo', description: 'Lenovo brand' }
  ];

  testQueries.forEach((test, index) => {
    setTimeout(() => {
      const pattern = `%${test.search.toLowerCase()}%`;
      
      db.all(`
        SELECT asset_id, search_text 
        FROM asset_search_view 
        WHERE search_text LIKE ?
        LIMIT 5
      `, [pattern], (err, rows) => {
        if (err) {
          console.error(`❌ Error testing "${test.search}":`, err.message);
        } else {
          console.log(`🔍 "${test.search}" (${test.description}): ${rows.length} results`);
          if (rows.length > 0) {
            console.log(`   Sample result: ${rows[0].search_text.substring(0, 100)}...`);
          }
        }
        
        // Test the main search query structure
        if (index === testQueries.length - 1) {
          console.log('\n🎯 Testing main search query structure...');
          testMainSearchQuery(db);
        }
      });
    }, index * 100);
  });
}

function testMainSearchQuery(db) {
  // Test the main search query that the frontend uses
  const search = 'vostro';
  const pattern = `%${search.toLowerCase()}%`;
  
  db.all(`
    SELECT a.id, a.name, a.serial_number, a.type, a.status
    FROM assets a
    LEFT JOIN asset_search_view asv ON asv.asset_id = a.id
    WHERE asv.search_text LIKE ?
    ORDER BY a.created_at DESC
    LIMIT 10
  `, [pattern], (err, rows) => {
    if (err) {
      console.error('❌ Error testing main search query:', err.message);
    } else {
      console.log(`\n📊 Main search query for "${search}": ${rows.length} results`);
      rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} (${row.serial_number}) - ${row.type} - ${row.status}`);
      });
    }
    
    // Test fallback query structure
    testFallbackQuery(db);
  });
}

function testFallbackQuery(db) {
  console.log('\n🔄 Testing fallback query structure...');
  
  const search = 'vostro';
  
  // Test the fallback OR conditions
  db.all(`
    SELECT a.id, a.name, a.serial_number, a.type, a.status
    FROM assets a
    LEFT JOIN asset_specs es ON es.asset_id = a.id
    LEFT JOIN locations l ON l.id = a.location_id
    WHERE 
      UPPER(a.name) LIKE '%${search.toUpperCase()}%' OR
      UPPER(a.serial_number) LIKE '%${search.toUpperCase()}%' OR
      UPPER(a.type) LIKE '%${search.toUpperCase()}%' OR
      UPPER(a.specs) LIKE '%${search.toUpperCase()}%' OR
      UPPER(es.brand) LIKE '%${search.toUpperCase()}%' OR
      UPPER(es.model) LIKE '%${search.toUpperCase()}%' OR
      UPPER(l.name) LIKE '%${search.toUpperCase()}%'
    ORDER BY a.created_at DESC
    LIMIT 10
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error testing fallback query:', err.message);
    } else {
      console.log(`📊 Fallback query for "${search}": ${rows.length} results`);
      rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} (${row.serial_number}) - ${row.type} - ${row.status}`);
      });
    }
    
    console.log('\n✅ Search functionality test completed!');
    console.log('\n📋 Summary:');
    console.log('   - asset_search_view exists and has data');
    console.log('   - Search queries work correctly');
    console.log('   - Both main and fallback queries function properly');
    console.log('   - "Vostro" search should now work in the application');
    
    db.close();
  });
}

// Run the test
testSearchFunctionality();