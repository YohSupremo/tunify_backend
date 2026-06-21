const bcrypt = require('bcryptjs');
const hash = '$2b$10$NtkwMo/JUVxNnEsd0twKdew/n7RNPZwrXxGbjyIsPoHsSXOFz2kjC';

const passwords = ['password123', 'admin', 'admin123', 'adminpassword', 'password', 'tunify', 'tunify123', '12345678', '123456'];

for (const p of passwords) {
  if (bcrypt.compareSync(p, hash)) {
    console.log(`FOUND! Password is: ${p}`);
  }
}
