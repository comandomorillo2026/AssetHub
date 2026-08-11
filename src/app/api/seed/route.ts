import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

export async function POST() {
  try {
    // Check if demo tenant already exists
    const existingTenant = await db.tenant.findUnique({
      where: { slug: 'pos-municipal-corp' },
    });

    if (existingTenant) {
      return NextResponse.json({
        message: 'Demo data already exists. Use a fresh database to seed again.',
        tenantId: existingTenant.id,
      });
    }

    const passwordHash = createHash('sha256').update('demo123' + 'zeitgeist-salt-2024').digest('hex');

    // Create the tenant
    const tenant = await db.tenant.create({
      data: {
        name: 'Port of Spain Municipal Corporation',
        slug: 'pos-municipal-corp',
        type: 'government',
        country: 'Trinidad and Tobago',
        currency: 'TTD',
        users: {
          create: {
            name: 'Anisa Mohammed',
            email: 'admin@demo.com',
            passwordHash,
            role: 'admin',
          },
        },
      },
    });

    const adminUser = (await db.user.findFirst({
      where: { tenantId: tenant.id, role: 'admin' },
    }))!;

    // Create auditor user
    const auditor = await db.user.create({
      data: {
        name: 'Rajesh Maharaj',
        email: 'auditor@demo.com',
        passwordHash,
        role: 'auditor',
        tenantId: tenant.id,
      },
    });

    // Categories
    const categories = await Promise.all([
      db.category.create({
        data: { name: 'IT Equipment', code: 'ITEQ', color: '#10b981', icon: 'Monitor', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Furniture', code: 'FURN', color: '#f59e0b', icon: 'Armchair', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Vehicles', code: 'VEH', color: '#ef4444', icon: 'Car', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Office Equipment', code: 'OFFEQ', color: '#8b5cf6', icon: 'Printer', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Maintenance Tools', code: 'MAINT', color: '#06b6d4', icon: 'Wrench', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Safety Equipment', code: 'SAFE', color: '#ec4899', icon: 'Shield', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Kitchen Appliances', code: 'KITCH', color: '#84cc16', icon: 'CookingPot', tenantId: tenant.id },
      }),
      db.category.create({
        data: { name: 'Audio/Visual', code: 'AV', color: '#f97316', icon: 'Projector', tenantId: tenant.id },
      }),
    ]);

    // Locations with hierarchy
    const mainOffice = await db.location.create({
      data: {
        name: 'City Hall Main Office',
        code: 'CHM',
        address: '1 Knox Street, Port of Spain',
        tenantId: tenant.id,
      },
    });

    const itDept = await db.location.create({
      data: {
        name: 'IT Department',
        code: 'CHM-IT',
        address: '3rd Floor, City Hall',
        parentId: mainOffice.id,
        tenantId: tenant.id,
      },
    });

    const financeDept = await db.location.create({
      data: {
        name: 'Finance Department',
        code: 'CHM-FIN',
        address: '2nd Floor, City Hall',
        parentId: mainOffice.id,
        tenantId: tenant.id,
      },
    });

    const publicWorks = await db.location.create({
      data: {
        name: 'Public Works Depot',
        code: 'PWD',
        address: '100 Wrightson Road, Port of Spain',
        tenantId: tenant.id,
      },
    });

    const healthCenter = await db.location.create({
        data: {
            name: 'St. James Health Center',
            code: 'SJHC',
            address: '19 Western Main Road, St. James',
            tenantId: tenant.id,
        },
    });

    const library = await db.location.create({
      data: {
        name: 'Port of Spain Public Library',
        code: 'POSLIB',
        address: '23 Abercromby Street, Port of Spain',
        tenantId: tenant.id,
      },
    });

    // Assets
    const now = Date.now();
    let assetCounter = 1000;

    function makeQR() {
      const random4 = Math.floor(1000 + Math.random() * 9000);
      assetCounter++;
      return `AST-${now + assetCounter}-${random4}`;
    }

    const assets = await Promise.all([
      // IT Equipment
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'IT-2024-001', name: 'Dell OptiPlex 7090 Desktop', description: 'Core i7, 16GB RAM, 512GB SSD', serialNumber: 'DL7090-TT-84721', brand: 'Dell', model: 'OptiPlex 7090', purchaseDate: new Date('2024-01-15'), purchasePrice: 8500, currentValue: 7200, warrantyExpiry: new Date('2027-01-15'), status: 'active', condition: 'good', assignedTo: 'Anisa Mohammed', categoryId: categories[0].id, locationId: itDept.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'IT-2024-002', name: 'HP LaserJet Pro M404dn', description: 'Monochrome laser printer', serialNumber: 'HPM404-TT-33921', brand: 'HP', model: 'LaserJet Pro M404dn', purchaseDate: new Date('2023-06-10'), purchasePrice: 4200, currentValue: 3100, warrantyExpiry: new Date('2026-06-10'), status: 'active', condition: 'good', categoryId: categories[0].id, locationId: financeDept.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'IT-2024-003', name: 'Lenovo ThinkPad T14s', description: 'AMD Ryzen 7, 16GB RAM, 256GB SSD', serialNumber: 'LNV-T14S-TT-77201', brand: 'Lenovo', model: 'ThinkPad T14s', purchaseDate: new Date('2024-03-22'), purchasePrice: 12000, currentValue: 10800, warrantyExpiry: new Date('2027-03-22'), status: 'active', condition: 'new', assignedTo: 'Rajesh Maharaj', categoryId: categories[0].id, locationId: itDept.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'IT-2023-015', name: 'Cisco Catalyst 2960 Switch', description: '24-port managed switch', serialNumber: 'CSC-2960-TT-55412', brand: 'Cisco', model: 'Catalyst 2960-X', purchaseDate: new Date('2022-08-01'), purchasePrice: 6500, currentValue: 4200, warrantyExpiry: new Date('2025-08-01'), status: 'active', condition: 'fair', categoryId: categories[0].id, locationId: itDept.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'IT-2024-005', name: 'Samsung 55" Smart TV', description: 'Conference room display', serialNumber: 'SMG-55-TT-99182', brand: 'Samsung', model: 'UN55TU8000', purchaseDate: new Date('2024-02-14'), purchasePrice: 6800, currentValue: 6100, warrantyExpiry: new Date('2027-02-14'), status: 'active', condition: 'good', categoryId: categories[7].id, locationId: mainOffice.id, tenantId: tenant.id,
        },
      }),
      // Furniture
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'FUR-2023-001', name: 'Executive Office Desk', description: 'L-shaped mahogany desk', brand: 'OfficePro Caribbean', model: 'Executive L-Shape', purchaseDate: new Date('2023-01-20'), purchasePrice: 3500, currentValue: 2800, status: 'active', condition: 'good', categoryId: categories[1].id, locationId: mainOffice.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'FUR-2023-002', name: 'Ergonomic Office Chair', description: 'Adjustable lumbar support', brand: 'Herman Miller', model: 'Aeron', purchaseDate: new Date('2023-01-20'), purchasePrice: 4200, currentValue: 3500, status: 'active', condition: 'good', assignedTo: 'Anisa Mohammed', categoryId: categories[1].id, locationId: mainOffice.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'FUR-2022-010', name: 'Filing Cabinet (4-Drawer)', description: 'Steel, fireproof', brand: 'SentrySafe', model: 'FC-4D', purchaseDate: new Date('2022-05-15'), purchasePrice: 1800, currentValue: 1400, status: 'active', condition: 'fair', categoryId: categories[1].id, locationId: financeDept.id, tenantId: tenant.id,
        },
      }),
      // Vehicles
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'VEH-2021-001', name: 'Toyota Hilux 4x4 Pickup', description: 'Municipal works pickup truck', serialNumber: 'TOY-HILUX-TT-8821MN', brand: 'Toyota', model: 'Hilux 2.8L 4x4', purchaseDate: new Date('2021-11-10'), purchasePrice: 385000, currentValue: 310000, warrantyExpiry: new Date('2024-11-10'), status: 'active', condition: 'fair', assignedTo: 'Public Works Division', categoryId: categories[2].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'VEH-2022-001', name: 'Nissan Caravan Van', description: '15-passenger staff transport', serialNumber: 'NSS-CARAVAN-TT-4410KN', brand: 'Nissan', model: 'Caravan E25', purchaseDate: new Date('2022-03-05'), purchasePrice: 420000, currentValue: 355000, warrantyExpiry: new Date('2025-03-05'), status: 'active', condition: 'good', assignedTo: 'Fleet Pool', categoryId: categories[2].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'VEH-2019-003', name: 'John Deere Gator Utility Vehicle', description: 'Parks and recreation utility vehicle', serialNumber: 'JD-GATOR-TT-7721AB', brand: 'John Deere', model: 'Gator TX 4x2', purchaseDate: new Date('2019-07-20'), purchasePrice: 95000, currentValue: 55000, status: 'maintenance', condition: 'poor', assignedTo: 'Parks Division', categoryId: categories[2].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      // Office Equipment
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'OFF-2024-001', name: 'Kyocera ECOSYS M5526cdn', description: 'Color MFP copier/scanner/fax', serialNumber: 'KYC-M5526-TT-66291', brand: 'Kyocera', model: 'ECOSYS M5526cdn', purchaseDate: new Date('2024-04-01'), purchasePrice: 9800, currentValue: 9000, warrantyExpiry: new Date('2027-04-01'), status: 'active', condition: 'new', categoryId: categories[3].id, locationId: mainOffice.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'OFF-2023-005', name: 'Ricoh IM C3000', description: 'Color laser multifunction printer', serialNumber: 'RCH-IMC3-TT-22418', brand: 'Ricoh', model: 'IM C3000', purchaseDate: new Date('2023-09-12'), purchasePrice: 15000, currentValue: 12500, warrantyExpiry: new Date('2026-09-12'), status: 'active', condition: 'good', categoryId: categories[3].id, locationId: library.id, tenantId: tenant.id,
        },
      }),
      // Maintenance Tools
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'MNT-2022-001', name: 'Honda Generator EU22i', description: 'Portable inverter generator 2200W', serialNumber: 'HND-EU22-TT-88412', brand: 'Honda', model: 'EU22i', purchaseDate: new Date('2022-02-28'), purchasePrice: 8500, currentValue: 6500, status: 'active', condition: 'good', categoryId: categories[4].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'MNT-2023-003', name: 'DeWalt Pressure Washer', description: '3400 PSI gas pressure washer', serialNumber: 'DWT-PW34-TT-33271', brand: 'DeWalt', model: 'DWPW3425', purchaseDate: new Date('2023-04-18'), purchasePrice: 5200, currentValue: 3900, status: 'active', condition: 'fair', categoryId: categories[4].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'MNT-2021-007', name: 'Bosch Rotary Hammer Drill', description: 'GBH 2-28 DFV', serialNumber: 'BSC-GBH2-TT-11932', brand: 'Bosch', model: 'GBH 2-28 DFV', purchaseDate: new Date('2021-06-10'), purchasePrice: 2200, currentValue: 1200, status: 'inactive', condition: 'poor', categoryId: categories[4].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      // Safety Equipment
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'SFE-2024-001', name: 'First Aid Kit (Large)', description: '144-piece industrial first aid station', brand: 'Medique', model: 'M4050', purchaseDate: new Date('2024-01-10'), purchasePrice: 850, currentValue: 800, status: 'active', condition: 'new', categoryId: categories[5].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'SFE-2023-002', name: 'Fire Extinguisher ABC 10lb', description: 'Multi-purpose dry chemical', brand: 'Amerex', model: 'B417T', purchaseDate: new Date('2023-03-15'), purchasePrice: 450, currentValue: 380, status: 'active', condition: 'good', categoryId: categories[5].id, locationId: healthCenter.id, tenantId: tenant.id,
        },
      }),
      // Kitchen Appliances
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'KIT-2023-001', name: 'Vulcan Commercial Range', description: '6-burner gas range with oven', serialNumber: 'VLC-6BR-TT-55291', brand: 'Vulcan', model: 'VRC36-6B', purchaseDate: new Date('2023-08-20'), purchasePrice: 18000, currentValue: 15500, status: 'active', condition: 'good', categoryId: categories[6].id, locationId: healthCenter.id, tenantId: tenant.id,
        },
      }),
      // Audio/Visual
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'AV-2023-001', name: 'Epson PowerLite Projector', description: 'WUXGA 3LCD projector', serialNumber: 'EPS-PLW-TT-44821', brand: 'Epson', model: 'PowerLite 2250U', purchaseDate: new Date('2023-10-05'), purchasePrice: 7200, currentValue: 5800, warrantyExpiry: new Date('2026-10-05'), status: 'active', condition: 'good', categoryId: categories[7].id, locationId: library.id, tenantId: tenant.id,
        },
      }),
      // A lost/stolen/disposed asset for variety
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'IT-2020-008', name: 'Acer Aspire 3 Laptop', description: 'Stolen from vehicle', serialNumber: 'ACR-ASP3-TT-99012', brand: 'Acer', model: 'Aspire 3 A315', purchaseDate: new Date('2020-05-12'), purchasePrice: 5500, currentValue: 1500, status: 'stolen', condition: 'good', notes: 'Reported stolen on Feb 14, 2024 from Nissan Caravan', categoryId: categories[0].id, locationId: publicWorks.id, tenantId: tenant.id,
        },
      }),
      db.asset.create({
        data: {
          qrCode: makeQR(), tagNumber: 'FUR-2018-004', name: 'Reception Desk', description: 'L-shaped reception counter - replaced', purchaseDate: new Date('2018-01-15'), purchasePrice: 6000, currentValue: 1000, status: 'disposed', condition: 'poor', notes: 'Replaced during 2024 renovation', categoryId: categories[1].id, locationId: mainOffice.id, tenantId: tenant.id,
        },
      }),
    ]);

    // Create some audit logs
    await Promise.all([
      db.auditLog.create({
        data: { action: 'created', details: 'Asset registered during initial inventory', assetId: assets[0].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'created', details: 'Asset registered during initial inventory', assetId: assets[1].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'created', details: 'Asset registered during initial inventory', assetId: assets[2].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'assigned', details: 'Assigned to Anisa Mohammed', assetId: assets[0].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'assigned', details: 'Assigned to Rajesh Maharaj', assetId: assets[2].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'status_changed', details: 'Status changed from active to maintenance', assetId: assets[10].id, userId: auditor.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'status_changed', details: 'Status changed from active to stolen', assetId: assets[20].id, userId: auditor.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'status_changed', details: 'Status changed from active to disposed', assetId: assets[21].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'location_changed', details: 'Moved from IT Department to Finance Department', assetId: assets[1].id, userId: adminUser.id, tenantId: tenant.id },
      }),
      db.auditLog.create({
        data: { action: 'scanned', details: 'Scanned during Q1 2024 inventory check', assetId: assets[4].id, userId: auditor.id, tenantId: tenant.id },
      }),
    ]);

    // Create sample maintenance records
    const maintenanceRecords = await Promise.all([
      db.maintenance.create({
        data: {
          tenantId: tenant.id,
          assetId: assets[10].id, // John Deere Gator
          type: 'corrective',
          status: 'in_progress',
          title: 'Engine Overhaul - Gator Utility Vehicle',
          description: 'Engine knocking and reduced power output. Requires full engine overhaul and oil seal replacement.',
          scheduledDate: new Date('2024-06-15'),
          cost: 8500,
          vendor: 'Caribbean Heavy Equipment Ltd.',
          vendorContact: '+1-868-623-4455',
          performedBy: 'Mechanic: Dave Singh',
          notes: 'Parts ordered from supplier. Expected 3-day turnaround.',
        },
      }),
      db.maintenance.create({
        data: {
          tenantId: tenant.id,
          assetId: assets[8].id, // Toyota Hilux
          type: 'preventive',
          status: 'scheduled',
          title: 'Annual Service - Hilux Pickup',
          description: 'Scheduled 50,000km service including oil change, brake inspection, tire rotation, and air filter replacement.',
          scheduledDate: new Date('2024-08-01'),
          cost: 3200,
          vendor: 'Toyota Trinidad & Tobago',
          vendorContact: '+1-868-662-8800',
          performedBy: null,
          notes: 'Fleet maintenance schedule Q3 2024.',
        },
      }),
      db.maintenance.create({
        data: {
          tenantId: tenant.id,
          assetId: assets[0].id, // Dell OptiPlex
          type: 'preventive',
          status: 'completed',
          title: 'Hardware Upgrade - RAM & SSD',
          description: 'Upgraded from 8GB to 16GB RAM and replaced 256GB HDD with 512GB SSD for improved performance.',
          scheduledDate: new Date('2024-03-10'),
          completedDate: new Date('2024-03-12'),
          cost: 1800,
          vendor: 'Computer World T&T',
          vendorContact: '+1-868-625-1100',
          performedBy: 'IT Team: Anisa Mohammed',
          notes: 'Performance improvement confirmed. Boot time reduced from 45s to 12s.',
        },
      }),
      db.maintenance.create({
        data: {
          tenantId: tenant.id,
          assetId: assets[3].id, // Cisco Switch
          type: 'corrective',
          status: 'completed',
          title: 'Port Replacement - Cisco Switch',
          description: 'Ports 20-24 not functioning after power surge. Replaced damaged module and installed surge protector.',
          scheduledDate: new Date('2024-05-20'),
          completedDate: new Date('2024-05-21'),
          cost: 2200,
          vendor: 'Cisco Partner Caribbean',
          performedBy: 'IT Vendor: TechConnect Ltd.',
          notes: 'Surge protector installed on all network equipment racks.',
        },
      }),
      db.maintenance.create({
        data: {
          tenantId: tenant.id,
          assetId: assets[15].id, // Honda Generator
          type: 'preventive',
          status: 'scheduled',
          title: 'Generator Maintenance & Load Test',
          description: 'Quarterly maintenance including oil change, air filter cleaning, spark plug check, and full load test.',
          scheduledDate: new Date('2024-09-15'),
          cost: 600,
          vendor: null,
          performedBy: 'Facilities Team',
          notes: 'Critical backup power equipment. Priority maintenance.',
        },
      }),
    ]);

    // Create sample notifications
    const notifications = await Promise.all([
      db.notification.create({
        data: {
          tenantId: tenant.id,
          userId: null, // broadcast
          type: 'system',
          title: 'Welcome to AssetHub',
          message: 'Your organization has been set up with AssetHub. Start by exploring your dashboard and reviewing your asset inventory.',
          isRead: true,
        },
      }),
      db.notification.create({
        data: {
          tenantId: tenant.id,
          userId: null,
          type: 'warranty_expiring',
          title: 'Warranty Expiring Soon',
          message: 'Cisco Catalyst 2960 Switch (IT-2023-015) warranty expires on Aug 1, 2025. Consider extending or planning for replacement.',
          data: JSON.stringify({ assetId: assets[3].id, type: 'warranty' }),
        },
      }),
      db.notification.create({
        data: {
          tenantId: tenant.id,
          userId: null,
          type: 'maintenance_due',
          title: 'Scheduled Maintenance Next Week',
          message: 'Toyota Hilux (VEH-2021-001) is due for annual service on Aug 1, 2024. Ensure vehicle is available at Public Works Depot.',
          data: JSON.stringify({ assetId: assets[8].id, type: 'maintenance' }),
        },
      }),
      db.notification.create({
        data: {
          tenantId: tenant.id,
          userId: null,
          type: 'maintenance_due',
          title: 'Maintenance In Progress',
          message: 'John Deere Gator (VEH-2019-003) engine overhaul is currently in progress. Estimated completion: Jun 18, 2024.',
          data: JSON.stringify({ assetId: assets[10].id, type: 'maintenance' }),
        },
      }),
      db.notification.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          type: 'custom',
          title: 'Monthly Asset Report Ready',
          message: 'Your July 2024 asset management report has been generated. Total assets: ' + assets.length + '. Review it in the Reports section.',
          data: JSON.stringify({ type: 'report', period: '2024-07' }),
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        type: tenant.type,
      },
      user: {
        email: 'admin@demo.com',
        password: 'demo123',
        name: 'Anisa Mohammed',
        role: 'admin',
      },
      stats: {
        categories: categories.length,
        locations: 6,
        assets: assets.length,
        auditLogs: 10,
        maintenanceRecords: maintenanceRecords.length,
        notifications: notifications.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
