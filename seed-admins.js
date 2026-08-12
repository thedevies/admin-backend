const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = [
    {
      name: 'Satish Hande',
      email: 'satish.hande@vvsdhruvexa.in',
      mobile: '8668599969',
      role: 'Super Administrator',
      password: 'Sathish.handeCEO@dhruvexa2026',
      status: 'Active'
    },
    {
      name: 'Shivraj Taware',
      email: 'shivraj.taware@vvsdhruvexa.in',
      mobile: '9527341104',
      role: 'Super Administrator',
      password: 'Shivraj.tawareCTO@dhruvexa2026',
      status: 'Active'
    }
  ];

  for (const admin of admins) {
    const existing = await prisma.adminAccount.findUnique({
      where: { email: admin.email }
    });
    
    if (existing) {
      await prisma.adminAccount.update({
        where: { email: admin.email },
        data: {
          password: admin.password,
          mobile: admin.mobile,
          role: admin.role,
          name: admin.name
        }
      });
      console.log(`Updated admin: ${admin.email}`);
    } else {
      await prisma.adminAccount.create({
        data: admin
      });
      console.log(`Created admin: ${admin.email}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
