// Self-contained test file — run with: npx tsx src/__tests__/auth.test.ts

// Set env vars before any module that reads them (jwt.ts throws if missing)
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-min-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-min!!';

import { NextRequest, NextResponse } from 'next/server';

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✗ ${name}`);
    }
  }

  // ========================================================
  // SECTION 1: hashPassword and comparePassword
  // ========================================================
  console.log('\n--- hashPassword / comparePassword ---');

  // Dynamic import to ensure env vars are set before the module initializes
  const jwt = await import('../lib/jwt');

  const hash = await jwt.hashPassword('MySecureP@ssw0rd');
  assert(typeof hash === 'string' && hash.length > 0, 'hashPassword returns a non-empty string');
  assert(hash !== 'MySecureP@ssw0rd', 'hashPassword does not return the plain text password');

  const sameMatch = await jwt.comparePassword('MySecureP@ssw0rd', hash);
  assert(sameMatch === true, 'comparePassword returns true for correct password');

  const wrongMatch = await jwt.comparePassword('WrongPassword!', hash);
  assert(wrongMatch === false, 'comparePassword returns false for wrong password');

  const differentHash = await jwt.hashPassword('anotherP@ss1');
  assert(hash !== differentHash, 'hashPassword produces different hashes for different passwords');

  const crossMatch = await jwt.comparePassword('anotherP@ss1', hash);
  assert(crossMatch === false, 'comparePassword returns false when password matches different hash');

  // ========================================================
  // SECTION 2: validateBody from validations.ts
  // ========================================================
  console.log('\n--- validateBody ---');

  const { validateBody, loginSchema, registerSchema, assetCreateSchema } = await import('../lib/validations');

  // --- Login schema ---

  const validLogin = validateBody(loginSchema, {
    email: 'user@example.com',
    password: 'longpassword',
  });
  assert(validLogin.success === true, 'Valid login data passes');
  if (validLogin.success) {
    assert(validLogin.data.email === 'user@example.com', 'Valid login email is preserved');
  }

  const invalidEmail = validateBody(loginSchema, {
    email: 'not-an-email',
    password: 'longpassword',
  });
  assert(invalidEmail.success === false, 'Invalid email fails login validation');
  if (!invalidEmail.success) {
    assert(invalidEmail.error.includes('email') || invalidEmail.error.includes('Email'), 'Invalid email error message mentions email');
  }

  const shortPassword = validateBody(loginSchema, {
    email: 'user@example.com',
    password: 'short',
  });
  assert(shortPassword.success === false, 'Short password fails login validation');
  if (!shortPassword.success) {
    assert(shortPassword.error.includes('8'), 'Short password error mentions 8 characters');
  }

  // --- Register schema (password strength) ---

  const validRegister = validateBody(registerSchema, {
    tenantName: 'Acme Corp',
    tenantType: 'corporate',
    contactName: 'John Doe',
    contactEmail: 'john@acme.com',
    contactPhone: '+1234567890',
    country: 'US',
    name: 'John Doe',
    email: 'john@acme.com',
    password: 'SecureP@ssw0rd!',
  });
  assert(validRegister.success === true, 'Valid register data passes');

  // Missing uppercase
  const noUpper = validateBody(registerSchema, {
    tenantName: 'Acme Corp',
    tenantType: 'corporate',
    contactName: 'John',
    contactEmail: 'john@acme.com',
    contactPhone: '+1234567890',
    country: 'US',
    name: 'John',
    email: 'john@acme.com',
    password: 'lowercasep@ss1',
  });
  assert(noUpper.success === false, 'Password without uppercase fails');
  if (!noUpper.success) {
    assert(noUpper.error.includes('uppercase'), 'No uppercase error mentions uppercase');
  }

  // Missing lowercase
  const noLower = validateBody(registerSchema, {
    tenantName: 'Acme Corp',
    tenantType: 'corporate',
    contactName: 'John',
    contactEmail: 'john@acme.com',
    contactPhone: '+1234567890',
    country: 'US',
    name: 'John',
    email: 'john@acme.com',
    password: 'UPPERCASEP@SS1',
  });
  assert(noLower.success === false, 'Password without lowercase fails');
  if (!noLower.success) {
    assert(noLower.error.includes('lowercase'), 'No lowercase error mentions lowercase');
  }

  // Missing number
  const noNumber = validateBody(registerSchema, {
    tenantName: 'Acme Corp',
    tenantType: 'corporate',
    contactName: 'John',
    contactEmail: 'john@acme.com',
    contactPhone: '+1234567890',
    country: 'US',
    name: 'John',
    email: 'john@acme.com',
    password: 'NoNumberP@ssword',
  });
  assert(noNumber.success === false, 'Password without number fails');
  if (!noNumber.success) {
    assert(noNumber.error.includes('number'), 'No number error mentions number');
  }

  // Missing special character
  const noSpecial = validateBody(registerSchema, {
    tenantName: 'Acme Corp',
    tenantType: 'corporate',
    contactName: 'John',
    contactEmail: 'john@acme.com',
    contactPhone: '+1234567890',
    country: 'US',
    name: 'John',
    email: 'john@acme.com',
    password: 'NoSpecialPassword1',
  });
  assert(noSpecial.success === false, 'Password without special character fails');
  if (!noSpecial.success) {
    assert(noSpecial.error.includes('special'), 'No special char error mentions special character');
  }

  // --- Asset schema ---

  const validAsset = validateBody(assetCreateSchema, {
    name: 'Dell Laptop',
    categoryId: 'cat-123',
    locationId: 'loc-456',
  });
  assert(validAsset.success === true, 'Valid asset data passes');
  if (validAsset.success) {
    assert(validAsset.data.status === 'active', 'Default asset status is active');
    assert(validAsset.data.condition === 'new', 'Default asset condition is new');
  }

  const missingCategory = validateBody(assetCreateSchema, {
    name: 'Dell Laptop',
    locationId: 'loc-456',
  });
  assert(missingCategory.success === false, 'Missing categoryId fails asset validation');
  if (!missingCategory.success) {
    assert(missingCategory.error.includes('Category') || missingCategory.error.includes('string'), 'Missing category error mentions Category or string');
  }

  const missingLocation = validateBody(assetCreateSchema, {
    name: 'Dell Laptop',
    categoryId: 'cat-123',
  });
  assert(missingLocation.success === false, 'Missing locationId fails asset validation');
  if (!missingLocation.success) {
    assert(missingLocation.error.includes('Location') || missingLocation.error.includes('string'), 'Missing location error mentions Location or string');
  }

  const missingName = validateBody(assetCreateSchema, {
    categoryId: 'cat-123',
    locationId: 'loc-456',
  });
  assert(missingName.success === false, 'Missing name fails asset validation');

  // ========================================================
  // SECTION 3: getAuthContext and requirePermission
  // ========================================================
  console.log('\n--- getAuthContext / requirePermission ---');

  const { getAuthContext, requirePermission } = await import('../lib/auth-helpers');

  function makeRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest('http://localhost:3000/api/test', {
      headers: new Headers(headers),
    });
  }

  // Missing headers → 401
  const noHeadersReq = makeRequest({});
  const noHeadersResult = getAuthContext(noHeadersReq);
  assert(noHeadersResult instanceof NextResponse, 'Returns NextResponse when headers are missing');
  if (noHeadersResult instanceof NextResponse) {
    assert(noHeadersResult.status === 401, 'Returns 401 when auth headers are missing');
  }

  // Partial headers → 401
  const partialReq = makeRequest({ 'x-auth-user-id': 'u1' });
  const partialResult = getAuthContext(partialReq);
  assert(partialResult instanceof NextResponse, 'Returns NextResponse when only userId is set');
  if (partialResult instanceof NextResponse) {
    assert(partialResult.status === 401, 'Returns 401 for partial headers');
  }

  // Proper headers → returns context
  const goodReq = makeRequest({
    'x-auth-user-id': 'user-abc',
    'x-auth-tenant-id': 'tenant-xyz',
    'x-auth-role': 'admin',
  });
  const goodResult = getAuthContext(goodReq);
  assert(!(goodResult instanceof NextResponse), 'Returns context object when headers are present');
  if (!(goodResult instanceof NextResponse)) {
    assert(goodResult.userId === 'user-abc', 'Context has correct userId');
    assert(goodResult.tenantId === 'tenant-xyz', 'Context has correct tenantId');
    assert(goodResult.role === 'admin', 'Context has correct role');
    assert(goodResult.permissions.canCreate === true, 'Admin has canCreate permission');
    assert(goodResult.permissions.canDelete === true, 'Admin has canDelete permission');
  }

  // requirePermission: insufficient → 403
  const auditorReq = makeRequest({
    'x-auth-user-id': 'user-aud',
    'x-auth-tenant-id': 'tenant-xyz',
    'x-auth-role': 'auditor',
  });
  const auditorCtx = getAuthContext(auditorReq);
  if (!(auditorCtx instanceof NextResponse)) {
    const perm403 = requirePermission(auditorCtx, 'canCreate');
    assert(perm403 instanceof NextResponse, 'requirePermission returns NextResponse for insufficient perms');
    if (perm403 instanceof NextResponse) {
      assert(perm403.status === 403, 'requirePermission returns 403 for insufficient perms');
    }
  }

  // requirePermission: sufficient → null
  const adminCtx = getAuthContext(goodReq);
  if (!(adminCtx instanceof NextResponse)) {
    const permNull = requirePermission(adminCtx, 'canCreate');
    assert(permNull === null, 'requirePermission returns null for sufficient permissions (admin canCreate)');

    const permNull2 = requirePermission(adminCtx, 'canDelete');
    assert(permNull2 === null, 'requirePermission returns null for sufficient permissions (admin canDelete)');

    const permNull3 = requirePermission(adminCtx, 'canManageUsers');
    assert(permNull3 === null, 'requirePermission returns null for sufficient permissions (admin canManageUsers)');
  }

  // User role: has canCreate but not canDelete
  const userReq = makeRequest({
    'x-auth-user-id': 'user-reg',
    'x-auth-tenant-id': 'tenant-xyz',
    'x-auth-role': 'user',
  });
  const userCtx = getAuthContext(userReq);
  if (!(userCtx instanceof NextResponse)) {
    const userCanCreate = requirePermission(userCtx, 'canCreate');
    assert(userCanCreate === null, 'User role has canCreate permission');

    const userCanDelete = requirePermission(userCtx, 'canDelete');
    assert(userCanDelete instanceof NextResponse, 'User role does not have canDelete permission');
    if (userCanDelete instanceof NextResponse) {
      assert(userCanDelete.status === 403, 'User role canDelete returns 403');
    }
  }

  // ========================================================
  // Summary
  // ========================================================
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
