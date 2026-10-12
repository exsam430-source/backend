import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import pool from './config/database.js'

dotenv.config()

var seedAdmin = async function () {
  console.log('=================================')
  console.log('MeerabLuxe Jewellery - Admin Seeder')
  console.log('=================================')

  try {
    // ── Wait for DB connection ──
    console.log('Connecting to database...')
    var conn = await pool.getConnection()
    console.log('✅ Database connected!')
    conn.release()

    // ── Admin credentials ──
    var adminData = {
      name:     'MeerabLuxe Jewellery Admin',
      email:    'adminahmad@luxe.com',
      password: 'owner@ahmad26Talha',        // ← Change this after first login!
      role:     'admin',
    }

    console.log('\nAdmin to be created:')
    console.log('Email   :', adminData.email)
    console.log('Password:', adminData.password)
    console.log('Role    :', adminData.role)

    // ── Check if admin already exists ──
    var checkResult = await pool.query(
      'SELECT id, email FROM admins WHERE email = ? LIMIT 1',
      [adminData.email]
    )
    var existingAdmins = checkResult[0]

    if (existingAdmins && existingAdmins.length > 0) {
      console.log('\n⚠️  Admin already exists with this email!')
      console.log('Existing admin ID:', existingAdmins[0].id)
      console.log('\nDo you want to reset password? Updating password...')

      var salt          = await bcrypt.genSalt(10)
      var hashedPassword = await bcrypt.hash(adminData.password, salt)

      await pool.query(
        'UPDATE admins SET password = ?, name = ?, updated_at = NOW() WHERE email = ?',
        [hashedPassword, adminData.name, adminData.email]
      )

      console.log('✅ Admin password reset successfully!')
      console.log('\n─────────────────────────────────')
      console.log('LOGIN CREDENTIALS:')
      console.log('Email   :', adminData.email)
      console.log('Password:', adminData.password)
      console.log('─────────────────────────────────')

    } else {
      // ── Create new admin ──
      var salt          = await bcrypt.genSalt(10)
      var hashedPassword = await bcrypt.hash(adminData.password, salt)

      var insertResult = await pool.query(
        `INSERT INTO admins
         (name, email, password, role, isActive, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          adminData.name,
          adminData.email,
          hashedPassword,
          adminData.role,
        ]
      )

      var insertRows = insertResult[0]
      console.log('\n✅ Admin created successfully!')
      console.log('Admin ID:', insertRows.insertId)
      console.log('\n─────────────────────────────────')
      console.log('LOGIN CREDENTIALS:')
      console.log('Email   :', adminData.email)
      console.log('Password:', adminData.password)
      console.log('─────────────────────────────────')
    }

    // ── Verify admin was created ──
    var verifyResult = await pool.query(
      'SELECT id, name, email, role, isActive, created_at FROM admins WHERE email = ?',
      [adminData.email]
    )
    var verifyRows = verifyResult[0]

    if (verifyRows && verifyRows[0]) {
      console.log('\n✅ Verification successful:')
      console.log('ID      :', verifyRows[0].id)
      console.log('Name    :', verifyRows[0].name)
      console.log('Email   :', verifyRows[0].email)
      console.log('Role    :', verifyRows[0].role)
      console.log('Active  :', verifyRows[0].isActive ? 'Yes' : 'No')
      console.log('Created :', verifyRows[0].created_at)
    }

    console.log('\n=================================')
    console.log('✅ Admin seeding complete!')
    console.log('=================================')
    console.log('\n⚠️  IMPORTANT: Change password after first login!')
    console.log('Admin Panel: https://yoursubdomain.rbjewellry.pk/admin')
    console.log('=================================\n')

    process.exit(0)

  } catch (error) {
    console.error('\n❌ Seeder failed:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  }
}

seedAdmin()