const fs = require('fs');
const file = 'd:/Dhruvexa Technologies/VVS/admin-backend/prisma/schema.prisma';

let content = fs.readFileSync(file, 'utf8');

// The file might contain null bytes or utf16 issues at the end now due to powershell echo.
// Let's truncate everything after the ReportedUser model.
const reportedUserIndex = content.indexOf('model ReportedUser');
if (reportedUserIndex !== -1) {
  // Find the end of ReportedUser model
  const endOfReportedUser = content.indexOf('}', reportedUserIndex) + 1;
  content = content.substring(0, endOfReportedUser);
  
  // Clean up null bytes if any
  content = content.replace(/\x00/g, '');

  content += `\n\nmodel AdminAccount {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  mobile    String   @unique
  role      String
  password  String
  avatar    String?
  status    String   @default("Active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}\n`;

  fs.writeFileSync(file, content);
  console.log('Fixed schema.prisma');
} else {
  console.log('Could not find ReportedUser model');
}
